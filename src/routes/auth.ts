import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDb } from '../db/database';
import { AppError } from '../utils/errors';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/token', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as {
      id: string; username: string; password_hash: string; role: string;
    } | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }

    const secret = process.env.JWT_SECRET || 'super-secret-jwt-key';
    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    res.json({ token, token_type: 'Bearer', expires_in: 86400 });
  } catch (err) {
    next(err);
  }
});

export default router;
