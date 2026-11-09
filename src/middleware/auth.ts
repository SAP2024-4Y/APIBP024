import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database';
import { AppError } from '../utils/errors';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('AUTH_REQUIRED'));
  }
  const token = header.slice(7);
  try {
    const secret = process.env.JWT_SECRET || 'super-secret-jwt-key';
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new AppError('AUTH_INVALID_TOKEN'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError('AUTH_REQUIRED'));
    if (!roles.includes(req.user.role)) return next(new AppError('FORBIDDEN'));
    next();
  };
}

/** Extracts user from JWT without throwing — used by GraphQL context. */
export async function getAuthContext(req: Request): Promise<JwtPayload | null> {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    const secret = process.env.JWT_SECRET || 'super-secret-jwt-key';
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

/** Verify a user id still exists in DB (cheap single-row lookup). */
export function verifyUserExists(userId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  return !!row;
}
