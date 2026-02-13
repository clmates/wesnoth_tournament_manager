import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { PasswordPolicy, User } from '../types/index.js';

const SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string): string => {
  const secret = (process.env.JWT_SECRET || 'your-secret-key') as string;
  return jwt.sign({ userId }, secret, {
    expiresIn: (process.env.JWT_EXPIRATION || '7d') as string,
  } as any);
};

export const generateTokenWithUsername = (username: string, userId: number): string => {
  const secret = (process.env.JWT_SECRET || 'your-secret-key') as string;
  // Store userId as numeric ID for backwards compatibility
  // The middleware will use this as the primary identifier
  return jwt.sign({ userId: userId.toString(), username }, secret, {
    expiresIn: (process.env.JWT_EXPIRATION || '7d') as string,
  } as any);
};

export const verifyToken = (token: string): any => {
  const secret = (process.env.JWT_SECRET || 'your-secret-key') as string;
  return jwt.verify(token, secret);
};

export const validatePassword = async (password: string, userId?: string): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  const result = await query('SELECT * FROM password_policy LIMIT 1');
  const policy: PasswordPolicy = result.rows[0];

  if (password.length < policy.min_length) {
    errors.push(`Password must be at least ${policy.min_length} characters long`);
  }
  if (policy.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (policy.require_lowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (policy.require_numbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (policy.require_symbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check if password was used before
  if (userId) {
    const historyResult = await query(
      `SELECT * FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, policy.previous_passwords_count]
    );

    for (const row of historyResult.rows) {
      const matches = await comparePasswords(password, row.password_hash);
      if (matches) {
        errors.push(`Password cannot be one of the last ${policy.previous_passwords_count} passwords`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const calculateELO = (currentELO: number, opponentELO: number, won: boolean, K = 32): number => {
  const expected = 1 / (1 + Math.pow(10, (opponentELO - currentELO) / 400));
  const score = won ? 1 : 0;
  return Math.round(K * (score - expected));
};

export const getUserLevel = (eloRating: number): string => {
  if (eloRating < 1400) return 'Novato';
  if (eloRating < 1600) return 'Iniciado';
  if (eloRating < 1800) return 'Veterano';
  if (eloRating < 2000) return 'Experto';
  return 'Maestro';
};
