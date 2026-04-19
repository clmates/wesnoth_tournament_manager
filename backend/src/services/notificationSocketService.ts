import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/auth.js';

export interface ClientNotification {
  type: 'schedule_proposal' | 'schedule_confirmed' | 'schedule_cancelled' | 'error' | 'success';
  title: string;
  message: string;
  matchId?: string;
  action?: 'confirm' | 'view' | 'cancel';
  timestamp?: string;
}

export class NotificationService {
  private io: SocketServer;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Setup Socket.IO connection handlers
   */
  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`📡 Socket connected: ${socket.id}`);

      // Authenticate user
      socket.on('auth', (token: string) => {
        try {
          const decoded = verifyToken(token);
          const userId = decoded.userId;

          // Register this socket for the user
          if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
          }
          this.userSockets.get(userId)!.add(socket.id);

          // Store userId on socket for later reference
          (socket as any).userId = userId;

          console.log(`✅ User authenticated: ${userId} (socket: ${socket.id})`);
          socket.emit('auth:success');
        } catch (error) {
          console.error('❌ Auth failed:', error);
          socket.emit('auth:error', 'Invalid token');
        }
      });

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        const userId = (socket as any).userId;
        if (userId) {
          const sockets = this.userSockets.get(userId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.userSockets.delete(userId);
            }
          }
        }
        console.log(`📡 Socket disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId: string, notification: ClientNotification) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) {
      console.log(`⚠️  No active sockets for user ${userId}, notification will be missed`);
      return;
    }

    sockets.forEach((socketId) => {
      this.io.to(socketId).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    });

    console.log(`📬 Notification sent to ${userId}: ${notification.title}`);
  }

  /**
   * Send notification to multiple users
   */
  notifyUsers(userIds: string[], notification: ClientNotification) {
    userIds.forEach((userId) => this.notifyUser(userId, notification));
  }

  /**
   * Broadcast to all connected clients (useful for announcements)
   */
  broadcastNotification(notification: ClientNotification) {
    this.io.emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
    console.log(`📢 Broadcast notification: ${notification.title}`);
  }
}

// Singleton instance
let notificationService: NotificationService | null = null;

export function initializeNotificationService(io: SocketServer): NotificationService {
  notificationService = new NotificationService(io);
  console.log('🔔 Notification service initialized');
  return notificationService;
}

export function getNotificationService(): NotificationService | null {
  return notificationService;
}
