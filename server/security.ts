import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import type { Express, Request, Response, NextFunction } from "express";

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, you would whitelist specific domains
    // For now, allow localhost and common development origins
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:3000',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:3000',
    ];

    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Rate limiting configurations
const createLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for static assets
      return req.path.startsWith('/assets') ||
        req.path.endsWith('.js') ||
        req.path.endsWith('.css') ||
        req.path.endsWith('.png') ||
        req.path.endsWith('.jpg') ||
        req.path.endsWith('.ico');
    },
  });
};

// General API rate limiter: 100 requests per minute
export const apiLimiter = createLimiter(
  60 * 1000, // 1 minute
  100,
  'Too many requests, please try again later.'
);

// Upload rate limiter: 20 uploads per 15 minutes
export const uploadLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  20,
  'Too many uploads, please wait before uploading again.'
);

// Download rate limiter: 30 downloads per 15 minutes
export const downloadLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  30,
  'Too many download requests, please wait.'
);

// Social media analyze rate limiter: 30 requests per minute (more strict due to external API calls)
export const analyzeLimiter = createLimiter(
  60 * 1000, // 1 minute
  30,
  'Too many analyze requests, please slow down.'
);

// Conversion rate limiter: 10 conversions per 10 minutes
export const conversionLimiter = createLimiter(
  10 * 60 * 1000, // 10 minutes
  10,
  'Too many conversion requests, please wait.'
);

// Request size limiter middleware
export const requestSizeLimiter = (maxSizeKB: number = 10240) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = maxSizeKB * 1024;

    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: `Request too large. Maximum size is ${maxSizeKB}KB.`
      });
    }
    next();
  };
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  // Sanitize body parameters (for non-file routes)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
};

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  // Remove null bytes and other potentially harmful characters
  return str
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = Array.isArray(obj[key])
        ? obj[key].map((item: any) => typeof item === 'string' ? sanitizeString(item) : item)
        : sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
}

// Security headers middleware using Helmet
export function setupSecurity(app: Express) {
  // Enable CORS
  app.use(cors(corsOptions));

  // Helmet security headers
  /* Helmet disabled temporarily for HTTP debugging
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for React dev mode
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false, // Required for loading external images
      crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
      hsts: false, // Disable HSTS for HTTP sites
    })
  );
  */

  // Prevent clickjacking
  app.use(helmet.frameguard({ action: 'deny' }));

  // Hide X-Powered-By header
  app.disable('x-powered-by');

  // Add custom security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    next();
  });

  // Apply general rate limiting to all API routes
  app.use('/api', apiLimiter);

  // Apply input sanitization
  app.use(sanitizeInput);
}

// Security logging middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Log suspicious requests
  if (req.path.includes('..') ||
    req.path.includes('<script') ||
    req.path.includes('%3Cscript')) {
    console.warn(`[Security] Suspicious request from ${ip}: ${req.method} ${req.path}`);
  }

  next();
};
