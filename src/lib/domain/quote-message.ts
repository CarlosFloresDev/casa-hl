import { SITE } from '../../config/site';
import { formatDate } from './dates';
import { formatMoney } from './money';
import type { Quote } from './pricing';

/** Texto de cotización listo para WhatsApp (formato con *negritas* de WhatsApp). */
export function quoteMessage(opts: {
  clientName?: string;
  quote: Quote;
  checkIn: string;
  checkOut: string;
  guests?: number;
  /** "staff": lo envía el hospedaje al cliente. "guest": lo envía el cliente al hospedaje. */
  from: 'staff' | 'guest';
}): string {
  const { quote, checkIn, checkOut } = opts;
  const nights = `${quote.nights} ${quote.nights === 1 ? 'noche' : 'noches'}`;
  const lines: string[] = [];

  if (opts.from === 'staff') {
    lines.push(`Hola${opts.clientName ? ` ${opts.clientName.split(' ')[0]}` : ''}, te saludamos de *${SITE.name}*. Esta es tu cotización:`);
  } else {
    lines.push(`Hola, quisiera reservar en *${SITE.name}*.`);
    if (opts.clientName) lines.push(`Mi nombre es ${opts.clientName}.`);
  }
  lines.push('');
  lines.push(`*Fechas:* ${formatDate(checkIn)} al ${formatDate(checkOut)} (${nights})`);
  if (opts.guests) lines.push(`*Personas:* ${opts.guests}`);
  lines.push('*Habitaciones:*');
  for (const l of quote.roomLines) lines.push(`• ${l.label}: ${formatMoney(l.amountCents)}`);
  if (quote.discountCents > 0) lines.push(`*Descuento ${quote.discountPct}%:* −${formatMoney(quote.discountCents)}`);
  for (const l of quote.extraLines) lines.push(`• ${l.label}: ${formatMoney(l.amountCents)}`);
  lines.push('');
  lines.push(`*Total:* ${formatMoney(quote.totalCents)}`);
  lines.push(`*Adelanto para confirmar (50%):* ${formatMoney(quote.depositCents)}`);
  lines.push('');
  lines.push(
    opts.from === 'staff'
      ? `El saldo se paga al ingresar. Ingreso desde las ${SITE.checkInTime} y salida hasta las ${SITE.checkOutTime}. Quedamos atentos para separar tu habitación.`
      : '¿Me confirman la disponibilidad y cómo enviar el adelanto?',
  );
  return lines.join('\n');
}
