import path from 'path';
import express, { Application } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';

import { config, isProduction } from './config';
import { logger } from './utils/logger';
import { attachUser } from './middlewares/auth.middleware';
import { flashMiddleware } from './middlewares/flash.middleware';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import router from './routes';
import webhookRouter from './routes/webhooks.routes';

export function createApp(): Application {
  const app = express();

  // Trust proxy when behind load balancer (Render, Heroku, etc.)
  app.set('trust proxy', 1);

  // Views
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');

  // Static files
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
  // User-uploaded banners live in process.cwd()/uploads (outside dist so they survive rebuilds)
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), { maxAge: '7d' }),
  );

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'https:'],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://rsms.me'],
          'font-src': ["'self'", 'data:', 'https://rsms.me'],
          'connect-src': ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    morgan(isProduction ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http?.(msg.trim()) || logger.info(msg.trim()) },
    }),
  );

  // Rate limiting (global, soft)
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Webhooks need the RAW body — mount BEFORE the JSON parser
  app.use('/webhooks', webhookRouter);

  // Body parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(methodOverride('_method'));

  // Sessions backed by MongoDB
  app.use(
    session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
      store: MongoStore.create({
        mongoUrl: config.mongodbUri,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24 * 7,
      }),
    }),
  );

  // App-level locals available in every view
  app.use(flashMiddleware);
  app.use(attachUser);
  app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.currentUrl = req.originalUrl;
    res.locals.appName = config.appName;
    res.locals.appUrl = config.appUrl;
    res.locals.flash = res.locals.flash; // already set by flashMiddleware
    next();
  });

  // All routes
  app.use('/', router);

  // 404 + error handling (must be LAST)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
