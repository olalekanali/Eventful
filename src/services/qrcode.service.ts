import QRCode from 'qrcode';
import crypto from 'crypto';
import { config } from '../config';

export interface QrPayload {
  ticketId: string;
  eventId: string;
  userId: string;
  signature: string;
}

class QrCodeService {
  private readonly secret = config.jwt.secret;

  async generate(input: {
    ticketId: string;
    eventId: string;
    userId: string;
  }): Promise<{ payload: string; image: string; signature: string }> {
    const signature = this.sign(input);
    const payload: QrPayload = { ...input, signature };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const image = await QRCode.toDataURL(encoded, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
    });

    return { payload: encoded, image, signature };
  }

  verify(encoded: string): QrPayload {
    let decoded: QrPayload;
    try {
      decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Malformed QR payload');
    }

    if (!decoded?.ticketId || !decoded?.eventId || !decoded?.userId) {
      throw new Error('Incomplete QR payload');
    }

    const expected = this.sign({
      ticketId: decoded.ticketId,
      eventId: decoded.eventId,
      userId: decoded.userId,
    });

    if (
      expected.length !== decoded.signature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(decoded.signature),
      )
    ) {
      throw new Error('Invalid QR signature');
    }

    return decoded;
  }

  private sign(input: {
    ticketId: string;
    eventId: string;
    userId: string;
  }): string {
    const data = `${input.ticketId}:${input.eventId}:${input.userId}`;
    return crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');
  }
}

export const qrCodeService = new QrCodeService();
