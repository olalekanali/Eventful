import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  paid_at: string;
  customer: { email: string };
  metadata?: any;
}

class PaystackService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.paystack.baseUrl,
      headers: {
        Authorization: `Bearer ${config.paystack.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async initialize(input: {
    email: string;
    amount: number;
    currency?: string;
    reference: string;
    metadata?: Record<string, any>;
    callbackUrl?: string;
  }): Promise<PaystackInitResponse> {
    try {
      const { data } = await this.client.post('/transaction/initialize', {
        email: input.email,
        amount: Math.round(input.amount * 100), // Paystack expects kobo
        currency: input.currency || 'NGN',
        reference: input.reference,
        metadata: input.metadata,
        callback_url: input.callbackUrl || config.paystack.callbackUrl,
      });

      if (!data?.status) {
        throw new AppError(
          data?.message || 'Failed to initialize payment',
          502,
        );
      }
      return data.data;
    } catch (err: any) {
      logger.error('Paystack initialize failed', {
        error: err.response?.data || err.message,
      });
      throw new AppError(
        err.response?.data?.message || 'Payment initialization failed',
        502,
      );
    }
  }

  async verify(reference: string): Promise<PaystackVerifyResponse> {
    try {
      const { data } = await this.client.get(
        `/transaction/verify/${reference}`,
      );
      if (!data?.status) {
        throw new AppError(
          data?.message || 'Failed to verify payment',
          502,
        );
      }
      return data.data;
    } catch (err: any) {
      logger.error('Paystack verify failed', {
        error: err.response?.data || err.message,
      });
      throw new AppError(
        err.response?.data?.message || 'Payment verification failed',
        502,
      );
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const hash = crypto
      .createHmac('sha512', config.paystack.secretKey)
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }
}

export const paystackService = new PaystackService();
