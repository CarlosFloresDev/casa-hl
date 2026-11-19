import type { BadgeTone } from '@/components/ui/Badge';
import type { ReservationStatus } from '@/lib/domain/catalog';
import type { PaymentState } from '@/lib/domain/pricing';

export const STATUS_TONE: Record<ReservationStatus, BadgeTone> = {
  confirmada: 'pine',
  en_casa: 'ink',
  finalizada: 'neutral',
  cancelada: 'danger',
};

export const PAYMENT_TONE: Record<PaymentState, BadgeTone> = {
  pendiente: 'danger',
  parcial: 'marigold',
  pagado: 'pine',
};

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  pendiente: 'Sin pagos',
  parcial: 'Con saldo',
  pagado: 'Pagado',
};
