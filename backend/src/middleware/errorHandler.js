import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

const formatValidationError = (error) => ({
  message: 'Validation failed',
  details: Object.values(error.errors).map((item) => ({
    field: item.path,
    message: item.message
  }))
});

const normalizeError = (error) => {
  const msg = error.message || '';
  if (
    error.code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('relation "public.hr_') ||
    msg.includes('Could not find the table')
  ) {
    const tableMatch = msg.match(/(?:table 'public\.|relation "public\.)([a-zA-Z0-9_]+)/i) || msg.match(/public\.([a-zA-Z0-9_]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'required tables';
    const appErr = new AppError(
      `Database setup required: Table 'public.${tableName}' was not found in the Supabase schema cache. Please execute the consolidated migration script in Supabase SQL Editor.`,
      503
    );
    appErr.code = 'SCHEMA_MIGRATION_PENDING';
    appErr.table = tableName;
    appErr.migrationFile = 'backend/src/db/migrations/000_stage_b2_consolidated_migration.sql';
    return appErr;
  }

  if (error.message === 'Not allowed by CORS') {
    return new AppError('Origin is not allowed by CORS policy', 403);
  }

  if (error.name === 'MulterError') {
    return new AppError(error.message, 400);
  }

  if (error.name === 'ValidationError') {
    const formatted = formatValidationError(error);
    return new AppError(formatted.message, 400, formatted.details);
  }

  if (error.name === 'CastError') {
    return new AppError(`Invalid ${error.path}: ${error.value}`, 400);
  }

  if (error.code === 11000) {
    const fields = Object.keys(error.keyValue || {}).join(', ');
    return new AppError(`Duplicate value for field(s): ${fields}`, 409);
  }

  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid authentication token', 401);
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError('Authentication token has expired', 401);
  }

  return error;
};

export const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

export const errorHandler = (error, _req, res, _next) => {
  const normalizedError = normalizeError(error);

  const statusCode = normalizedError.statusCode || 500;
  const response = {
    success: false,
    message:
      normalizedError.isOperational || process.env.NODE_ENV !== 'production'
        ? normalizedError.message
        : 'Something went wrong'
  };

  if (normalizedError.code) {
    response.code = normalizedError.code;
  }

  if (normalizedError.table) {
    response.table = normalizedError.table;
  }

  if (normalizedError.migrationFile) {
    response.migrationFile = normalizedError.migrationFile;
  }

  if (normalizedError.details) {
    response.details = normalizedError.details;
  }

  if (process.env.NODE_ENV !== 'production') {
    response.stack = normalizedError.stack;
  }

  if (statusCode >= 500) {
    logger.error(normalizedError.message, {
      stack: normalizedError.stack
    });
  }

  return res.status(statusCode).json(response);
};
