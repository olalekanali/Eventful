import PDFDocument from 'pdfkit';
import { TicketDocument } from '../models/ticket.model';
import { IEvent } from '../models/event.model';

export interface PdfTicketInput {
  ticket: TicketDocument;
  event: Pick<
    IEvent,
    | 'title'
    | 'description'
    | 'venue'
    | 'address'
    | 'city'
    | 'country'
    | 'startDate'
    | 'endDate'
    | 'currency'
  >;
  recipientName: string;
  qrImageDataUrl: string;
}

class PdfService {
  /**
   * Builds a polished PDF ticket and returns it as a Buffer.
   */
  async generateTicketPdf(input: PdfTicketInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 40, bottom: 40, left: 50, right: 50 },
          info: {
            Title: `Ticket - ${input.event.title}`,
            Author: 'Eventful',
            Subject: 'Event Ticket',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const PRIMARY = '#1c1917';
        const ACCENT = '#ea580c';
        const MUTED = '#78716c';
        const BORDER = '#e7e5e4';

        // === Header bar ===
        doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY);
        doc
          .fillColor('#ffffff')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('Eventful', 50, 30);
        doc
          .fillColor('#a8a29e')
          .fontSize(10)
          .font('Helvetica')
          .text('Your passport to unforgettable moments', 50, 56);

        // Ticket number stamp top-right
        doc
          .fillColor('#ffffff')
          .fontSize(9)
          .text('TICKET NO.', 400, 30, { width: 145, align: 'right' });
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text(input.ticket.ticketNumber, 400, 44, {
            width: 145,
            align: 'right',
          });

        // === Hero ===
        let y = 110;
        doc
          .fillColor(ACCENT)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('YOUR TICKET IS CONFIRMED', 50, y, { characterSpacing: 1.2 });

        y += 22;
        doc
          .fillColor(PRIMARY)
          .fontSize(28)
          .font('Helvetica-Bold')
          .text(input.event.title, 50, y, { width: 495 });

        y = doc.y + 6;
        doc
          .fillColor(MUTED)
          .fontSize(11)
          .font('Helvetica')
          .text(`Issued to ${input.recipientName}`, 50, y);

        // === Event info card ===
        y = doc.y + 30;
        const cardTop = y;
        const cardLeft = 50;
        const cardWidth = 495;
        doc
          .roundedRect(cardLeft, cardTop, cardWidth, 170, 8)
          .lineWidth(1)
          .strokeColor(BORDER)
          .stroke();

        const labelAt = (yPos: number, x: number, label: string, width = 200) => {
          doc
            .fillColor(MUTED)
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(label, x, yPos, { characterSpacing: 1, width });
        };
        const valueAt = (
          yPos: number,
          x: number,
          value: string,
          opts: { bold?: boolean; size?: number; width?: number; align?: any } = {},
        ) => {
          doc
            .fillColor(PRIMARY)
            .fontSize(opts.size || 11)
            .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
            .text(value, x, yPos, { width: opts.width || cardWidth - 40, align: opts.align });
        };

        labelAt(cardTop + 18, cardLeft + 20, 'WHEN');
        const startStr = new Date(input.event.startDate).toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'short',
        });
        valueAt(cardTop + 31, cardLeft + 20, startStr, { bold: true });

        labelAt(cardTop + 70, cardLeft + 20, 'WHERE');
        valueAt(cardTop + 83, cardLeft + 20, input.event.venue, { bold: true });
        const locParts = [input.event.address, input.event.city, input.event.country].filter(Boolean) as string[];
        if (locParts.length) {
          doc
            .fillColor(MUTED)
            .fontSize(10)
            .font('Helvetica')
            .text(locParts.join(', '), cardLeft + 20, cardTop + 100, {
              width: cardWidth - 40,
            });
        }

        labelAt(cardTop + 130, cardLeft + 20, 'QUANTITY');
        valueAt(cardTop + 143, cardLeft + 20, `${input.ticket.quantity} ticket(s)`);

        labelAt(cardTop + 130, cardLeft + cardWidth - 130, 'TOTAL PAID', 110);
        valueAt(
          cardTop + 143,
          cardLeft + cardWidth - 130,
          `${input.event.currency} ${Number(input.ticket.totalAmount).toLocaleString()}`,
          { bold: true, size: 13, width: 110, align: 'right' },
        );

        // === QR section ===
        y = cardTop + 200;
        doc
          .moveTo(50, y)
          .lineTo(545, y)
          .dash(3, { space: 3 })
          .strokeColor(BORDER)
          .stroke()
          .undash();

        y += 25;
        doc
          .fillColor(PRIMARY)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Scan at entrance', 50, y);
        doc
          .fillColor(MUTED)
          .fontSize(10)
          .font('Helvetica')
          .text(
            'Present this QR code at the venue for fast admission.',
            50,
            y + 20,
            { width: 280 },
          );

        const base64 = input.qrImageDataUrl.replace(
          /^data:image\/[a-z]+;base64,/,
          '',
        );
        const qrBuffer = Buffer.from(base64, 'base64');
        doc.image(qrBuffer, 380, y - 10, { width: 165, height: 165 });

        // === About section ===
        y += 180;
        if (input.event.description) {
          doc
            .fillColor(MUTED)
            .fontSize(8)
            .font('Helvetica-Bold')
            .text('ABOUT THIS EVENT', 50, y, { characterSpacing: 1 });
          const truncated =
            input.event.description.length > 600
              ? input.event.description.slice(0, 600) + '...'
              : input.event.description;
          doc
            .fillColor(PRIMARY)
            .fontSize(10)
            .font('Helvetica')
            .text(truncated, 50, y + 14, {
              width: 495,
              align: 'justify',
              lineGap: 2,
            });
        }

        // === Footer ===
        const footerY = doc.page.height - 60;
        doc
          .moveTo(50, footerY)
          .lineTo(545, footerY)
          .undash()
          .lineWidth(0.5)
          .strokeColor(BORDER)
          .stroke();
        doc
          .fillColor(MUTED)
          .fontSize(8)
          .font('Helvetica')
          .text(
            'This ticket is non-transferable. Present a valid ID matching the purchaser if requested. ' +
              'Lost or duplicated QR codes will be invalidated on first scan.',
            50,
            footerY + 10,
            { width: 495, align: 'center' },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const pdfService = new PdfService();
