import { query } from '../config/database.js';
import { Request, Response } from 'express';
import { AuthRequest } from './auth.js';

export interface AuditLogEntry {
  event_type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'REGISTRATION' | 'ADMIN_ACTION' | 'SECURITY_EVENT';
  user_id?: string;
  username?: string;
  ip_address: string;
  user_agent?: string;
  details: Record<string, any>;
  timestamp?: Date;
}

/**
 * Log security audit events to database
 */
export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    await query(
      `INSERT INTO audit_logs (event_type, user_id, username, ip_address, user_agent, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        entry.event_type,
        entry.user_id || null,
        entry.username || null,
        entry.ip_address,
        entry.user_agent || null,
        JSON.stringify(entry.details)
      ]
    );

    // Also log to console for real-time monitoring
    console.log(`[AUDIT] ${entry.event_type}:`, {
      user: entry.username || entry.user_id || 'ANONYMOUS',
      ip: entry.ip_address,
      details: entry.details
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging shouldn't break the application
  }
}

/**
 * Get user's IP address (handles proxies)
 */
export function getUserIP(req: Request | AuthRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Get user agent
 */
export function getUserAgent(req: Request | AuthRequest): string {
  return (req.headers['user-agent'] as string) || 'unknown';
}

export default {
  logAuditEvent,
  getUserIP,
  getUserAgent
};
