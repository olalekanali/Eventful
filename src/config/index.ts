import dotenv from 'dotenv';

dotenv.config();

interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  appName: string;
  appUrl: string;

  mongodbUri: string;

  session: {
    secret: string;
  };

  jwt: {
    secret: string;
    expiresIn: string;
  };

  paystack: {
    secretKey: string;
    publicKey: string;
    baseUrl: string;
    callbackUrl: string;
  };

  mail: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };

  rateLimit: {
    windowMs: number;
    max: number;
  };
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config: Config = {
  nodeEnv: (process.env.NODE_ENV as Config['nodeEnv']) || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'Eventful',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  mongodbUri: required('MONGODB_URI'),

  session: {
    secret: required('SESSION_SECRET', 'change-this-in-production'),
  },

  jwt: {
    secret: required('JWT_SECRET', 'change-this-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    callbackUrl:
      process.env.PAYSTACK_CALLBACK_URL ||
      'http://localhost:3000/payments/verify',
  },

  mail: {
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER || '',
    password: process.env.MAIL_PASSWORD || '',
    from: process.env.MAIL_FROM || 'Eventful <no-reply@eventful.app>',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
