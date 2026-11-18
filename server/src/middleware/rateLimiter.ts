import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

export const runRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 runs per user per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.id || req.ip || 'anonymous';
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Execution rate limit exceeded: Maximum 10 runs per minute allowed.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

