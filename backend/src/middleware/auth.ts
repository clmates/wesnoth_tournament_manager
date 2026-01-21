import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional auth middleware - extracts user ID if token is provided, but doesn't fail if missing
export const optionalAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
    } catch (error) {
      // Token is invalid, but we continue anyway
      // This middleware is optional, so we don't fail
    }
  }

  next();
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { query } = require('../config/database');
  const result = await query('SELECT id FROM users WHERE id = $1 AND is_admin = true', [req.userId]);

  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  next();
};
