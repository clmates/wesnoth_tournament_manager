import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for registration endpoint
 * Prevents spam account creation and bot attacks
 * Limits: 5 attempts per 15 minutes per IP
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts per window
  message: 'Too many registration attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,       // Disable `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    // Use X-Forwarded-For for production (behind proxy), fallback to ip
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  },
  handler: (req, res) => {
    console.warn(`Registration rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many registration attempts',
      message: 'Please try again after 15 minutes',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Rate limiter for login endpoint
 * Prevents brute force password attacks
 * Limits: 10 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per window
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  handler: (req, res) => {
    console.warn(`Login rate limit exceeded for IP: ${req.ip}, attempted user: ${req.body?.nickname}`);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * General rate limiter for API endpoints
 * Prevents resource exhaustion and API abuse
 * Limits: 30 requests per minute per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 30,                    // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  handler: (req, res) => {
    console.warn(`General rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down your requests',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

/**
 * Strict rate limiter for search endpoints
 * Prevents user enumeration and information gathering
 * Limits: 10 requests per minute per IP
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 10,                    // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test';
  },
  handler: (req, res) => {
    console.warn(`Search rate limit exceeded for IP: ${req.ip}, query: ${req.params?.searchQuery}`);
    res.status(429).json({
      error: 'Too many search requests',
      message: 'Please slow down your searches',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

export default {
  registerLimiter,
  loginLimiter,
  generalLimiter,
  searchLimiter
};
