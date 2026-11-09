import { eventResolvers } from './events';
import { venueResolvers } from './venues';
import { ticketResolvers } from './tickets';
import { GraphQLScalarType, Kind } from 'graphql';

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 UTC date-time string.',
  serialize(value: unknown) {
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
  },
  parseValue(value: unknown) {
    if (typeof value === 'string') return value;
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return ast.value;
    return null;
  },
});

export const resolvers = {
  DateTime: DateTimeScalar,

  Query: {
    ...eventResolvers.Query,
    ...venueResolvers.Query,
    ...ticketResolvers.Query,
  },

  Mutation: {
    ...eventResolvers.Mutation,
    ...venueResolvers.Mutation,
    ...ticketResolvers.Mutation,
  },

  Event:  eventResolvers.Event,
  Venue:  venueResolvers.Venue,
  Ticket: ticketResolvers.Ticket,
};
