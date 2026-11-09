import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { json as bodyJson } from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

import { resolvers } from './graphql/resolvers/index';
import { createDataLoaders } from './graphql/dataloaders';
import { getAuthContext } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errors';
import authRouter from './routes/auth';
import eventsRouter from './routes/events';
import venuesRouter from './routes/venues';
import ticketsRouter from './routes/tickets';
import categoriesRouter from './routes/categories';

export async function createApp() {
  const app = express();

  // ── Apollo Server ──────────────────────────────────────────────────────────
  const typeDefsPath = path.join(__dirname, '../docs/schema.graphql');
  const typeDefs     = fs.readFileSync(typeDefsPath, 'utf8');

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
    formatError: (formattedError, error) => {
      // Translate AppErrors into structured GraphQL extensions
      const cause = (error as { originalError?: { code?: string; httpStatus?: number } }).originalError;
      if (cause?.code) {
        return {
          ...formattedError,
          extensions: {
            ...formattedError.extensions,
            code: cause.code,
            http: { status: cause.httpStatus ?? 400 },
          },
        };
      }
      return formattedError;
    },
  });

  await apolloServer.start();

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'TicketSphere Events API', timestamp: new Date().toISOString() });
  });

  // ── REST API (all under /api/v1) ───────────────────────────────────────────
  app.use('/api/', rateLimiter);
  app.use('/api/v1/auth',       authRouter);
  app.use('/api/v1/events',     eventsRouter);
  app.use('/api/v1/venues',     venuesRouter);
  app.use('/api/v1/tickets',    ticketsRouter);
  app.use('/api/v1/categories', categoriesRouter);

  // ── Swagger UI ─────────────────────────────────────────────────────────────
  const openapiPath = path.join(__dirname, '../docs/openapi.yaml');
  const openapiDoc  = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as object;
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc, {
    explorer: true,
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'TicketSphere API Docs',
  }));

  // ── GraphQL (with rate limiting) ───────────────────────────────────────────
  app.use('/graphql', rateLimiter, cors(), bodyJson(), expressMiddleware(apolloServer, {
    context: async ({ req }) => ({
      user: await getAuthContext(req),
      dataloaders: createDataLoaders(),
    }),
  }));

  // ── Static UI (served after all API routes) ───────────────────────────────
  const uiDist = path.join(__dirname, '../ui/dist');
  if (fs.existsSync(uiDist)) {
    app.use(express.static(uiDist));
    // SPA fallback — serves index.html for any path not already handled
    app.get(/^(?!\/api|\/graphql|\/docs|\/health).*/, (_req, res) => {
      res.sendFile(path.join(uiDist, 'index.html'));
    });
  }

  // ── Error handler (must be last) ───────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
