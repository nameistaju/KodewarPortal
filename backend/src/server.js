import 'dotenv/config';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { runDevelopmentBootstrap } from './utils/devBootstrap.js';
import logger from './utils/logger.js';
import { ensureUploadDirectories } from './services/uploadService.js';
import { startAutoCloseScheduler, stopAutoCloseScheduler } from './services/attendanceAutoCloseService.js';
import { startChatCleanupScheduler, stopChatCleanupScheduler } from './services/chatCleanupScheduler.js';

const PORT = env.port;
let server;

const startServer = async () => {
  await ensureUploadDirectories();
  await connectDB();
  await runDevelopmentBootstrap();
  startAutoCloseScheduler();
  startChatCleanupScheduler();

  server = app.listen(PORT, () => {
    logger.info('KODEWAR API started', {
      port: PORT,
      nodeEnv: env.nodeEnv
    });
  });
};

const shutdown = async (signal) => {
  logger.info('Shutdown signal received', { signal });
  stopAutoCloseScheduler();
  stopChatCleanupScheduler();

  if (server) {
    server.close(async () => {
      await disconnectDB();
      logger.info('Server shut down gracefully');
      process.exit(0);
    });
    return;
  }

  await disconnectDB();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('Failed to start server', {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});
