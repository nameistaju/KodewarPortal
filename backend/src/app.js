import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import { env, isProduction } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { sanitizeMiddleware } from './middleware/security.js';

const app = express();

app.get('/api/health', async (req, res) => {
  const startTime = process.hrtime();
  let mongoStatus = 'DISCONNECTED';
  let activeEmployees = 0;

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      mongoStatus = 'CONNECTED';
      const Employee = mongoose.model('Employee');
      activeEmployees = await Employee.countDocuments({ status: 'ACTIVE' });
    }
  } catch {
    mongoStatus = 'ERROR';
  }

  const diff = process.hrtime(startTime);
  const responseTimeMs = `${Math.round(diff[0] * 1000 + diff[1] / 1e6)}ms`;

  res.status(200).json({
    success: true,
    status: 'UP',
    mongoStatus,
    uptime: process.uptime(),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    timezone: env.organizationTimezone,
    responseTime: responseTimeMs,
    memoryUsage: process.memoryUsage(),
    stats: {
      activeEmployees
    }
  });
});

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), interest-cohort=()');
  next();
});

const matchOrigin = (origin, allowedOrigins) => {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return allowedOrigins.some((allowed) => {
    if (allowed.includes('*')) {
      const escaped = allowed.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      const regexStr = '^' + escaped.replace(/\*/g, '[a-zA-Z0-9-]+') + '$';
      const regex = new RegExp(regexStr);
      return regex.test(origin);
    }
    return false;
  });
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !isProduction || matchOrigin(origin, env.clientOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(sanitizeMiddleware);
app.use(compression());
app.use(requestLogger);

app.use('/uploads', express.static(path.resolve(env.uploadRoot), {
  dotfiles: 'deny',
  index: false,
  fallthrough: false,
  maxAge: isProduction ? '30d' : 0,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', isProduction ? 'public, max-age=2592000, immutable' : 'no-store');
  }
}));

app.use('/api', apiLimiter);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'KODEWAR API is healthy'
  });
});

app.get('/ready', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;

  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'KODEWAR API is ready' : 'Database connection is not ready',
    data: {
      databaseReady: ready
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
