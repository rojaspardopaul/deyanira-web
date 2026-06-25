// Adaptador de renderizado del recibo. Carga los datos del salón y reutiliza
// lib/receipts/receiptHtml.renderReceiptHtml.

import prisma from '../../../shared/database/prisma';
import type { ReciboRenderer } from '../domain/ports/ReciboRenderer';
import type { ReciboPersistido } from '../domain/ports/ReciboRepositorio';

/* eslint-disable @typescript-eslint/no-var-requires */
const { renderReceiptHtml } = require('../../../lib/receipts/receiptHtml') as {
  renderReceiptHtml: (datos: { receipt: unknown; salon: unknown }) => string;
};

export class ReciboRendererLib implements ReciboRenderer {
  async html(recibo: ReciboPersistido): Promise<string> {
    const salon = await prisma.setting
      .findFirst({
        select: {
          salonName: true, address: true, district: true, city: true,
          phone: true, whatsapp: true, logoUrl: true,
        },
      })
      .catch(() => null);
    return renderReceiptHtml({ receipt: recibo, salon: salon || {} });
  }
}
