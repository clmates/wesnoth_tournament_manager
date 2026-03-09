import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';
import { checkUserIsForumModerator } from '../services/phpbbAuth.js';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    req.username = decoded.username;
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
      req.username = decoded.username;
    } catch (error) {
      // Token is invalid, but we continue anyway
    }
  }

  next();
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { query } = require('../config/database');
  const result = await query('SELECT id FROM users_extension WHERE id = ? AND is_admin = 1', [req.userId]);

  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  next();
};

export const moderatorOrAdminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId || !req.username) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { query } = require('../config/database');
  const result = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);

  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const isAdmin = result.rows[0].is_admin;
  if (isAdmin) return next();

  const isModerator = await checkUserIsForumModerator(req.username);
  if (isModerator) return next();

  return res.status(403).json({ error: 'Not authorized' });
};
