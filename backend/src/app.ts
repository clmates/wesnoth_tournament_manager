import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import matchRoutes from './routes/matches.js';
import tournamentRoutes from './routes/tournaments.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import statisticsRoutes from './routes/statistics.js';
import playerStatisticsRoutes from './routes/player-statistics.js';
import { generalLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration - allow both Netlify and Cloudflare URLs
const baseAllowedOrigins = [
  'https://wesnoth-tournament-manager.netlify.app',    // Netlify (old)
  'https://wesnoth-tournament-manager.pages.dev',       // Cloudflare Pages (production)
  'https://main.wesnoth-tournament-manager.pages.dev',  // Cloudflare Pages preview (main branch)
  'https://wesnoth.playranked.org',                     // PlayRanked custom domain
  'http://localhost:3000',                              // Local backend
  'http://localhost:5173'                               // Local frontend (Vite)
];

// Add dynamic frontend URL from environment (for PR previews)
const dynamicFrontendUrl = process.env.frontend_url;
const allowedOrigins = dynamicFrontendUrl ? [...baseAllowedOrigins, dynamicFrontendUrl] : baseAllowedOrigins;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Allow requests with no origin (like mobile apps or curl requests)
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      // Exact match
      callback(null, true);
    } else if (dynamicFrontendUrl && dynamicFrontendUrl.includes('*')) {
      // Wildcard pattern support for frontend_url (e.g., *.wesnoth-tournament-manager.pages.dev)
      const pattern = dynamicFrontendUrl.replace(/\*/g, '[a-z0-9]+');
      const regex = new RegExp(`^https://${pattern}$`);
      if (regex.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (replays)
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));
console.log(`📁 Serving uploads from: ${uploadsPath}`);

// Apply general rate limiting to all API routes (except specific endpoints with stricter limits)
app.use('/api/', generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/player-statistics', playerStatisticsRoutes);

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
