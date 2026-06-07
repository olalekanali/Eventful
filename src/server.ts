import { createApp } from './app';
import { connectDatabase } from './config/database';
import { config } from './config';
import { logger } from './utils/logger';
import { remindersService } from './services/reminders.service';

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    const app = createApp();

    // Start the reminders cron worker
    remindersService.startCron();

    const server = app.listen(config.port, () => {
      logger.info(`🚀 ${config.appName} running on ${config.appUrl}`);
      logger.info(`📦 Environment: ${config.nodeEnv}`);
    });

    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      // Force exit after 10s
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });
  } catch (err: any) {
    logger.error('Failed to start application', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

bootstrap();
