import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import matchRoutes from './routes/matches.js';
import tournamentRoutes from './routes/tournaments.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import { generalLimiter } from './middleware/rateLimiter.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all API routes (except specific endpoints with stricter limits)
app.use('/api/', generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler - MUST be last
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.path,
    method: req.method,
  });
});

// 404 handler - catch all unmatched routes
app.use((req: express.Request, res: express.Response) => {
  console.error('404 - Route not found:', req.method, req.path);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

export default app;
