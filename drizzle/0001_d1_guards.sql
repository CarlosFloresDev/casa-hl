-- Include finished stays: only cancelled reservations release their dates.
CREATE TRIGGER reservations_no_overlap_insert BEFORE INSERT ON reservations
WHEN NEW.status <> 'cancelada' AND EXISTS (
  SELECT 1 FROM reservations WHERE room_id = NEW.room_id AND status <> 'cancelada'
    AND check_in < NEW.check_out AND check_out > NEW.check_in
)
BEGIN SELECT RAISE(ABORT, 'reservation_overlap'); END;
--> statement-breakpoint
CREATE TRIGGER reservations_no_overlap_update BEFORE UPDATE OF room_id, check_in, check_out, status ON reservations
WHEN NEW.status <> 'cancelada' AND EXISTS (
  SELECT 1 FROM reservations WHERE room_id = NEW.room_id AND id <> NEW.id AND status <> 'cancelada'
    AND check_in < NEW.check_out AND check_out > NEW.check_in
)
BEGIN SELECT RAISE(ABORT, 'reservation_overlap'); END;
--> statement-breakpoint
CREATE TRIGGER payments_guard_insert BEFORE INSERT ON payments
WHEN NEW.amount_cents <= 0 OR NOT EXISTS (
  SELECT 1 FROM reservations r WHERE r.id = NEW.reservation_id AND r.status <> 'cancelada'
    AND NEW.amount_cents + (SELECT coalesce(sum(amount_cents), 0) FROM payments WHERE reservation_id = r.id) <= r.total_cents
)
BEGIN SELECT RAISE(ABORT, 'payment_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER reservations_paid_guard BEFORE UPDATE OF total_cents ON reservations
WHEN NEW.total_cents < (SELECT coalesce(sum(amount_cents), 0) FROM payments WHERE reservation_id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'reservation_total_below_paid'); END;
--> statement-breakpoint
CREATE TRIGGER reservations_checkin_guard BEFORE UPDATE OF status ON reservations
WHEN NEW.status = 'en_casa' AND NEW.check_in > date('now', '-5 hours')
BEGIN SELECT RAISE(ABORT, 'reservation_early_checkin'); END;
