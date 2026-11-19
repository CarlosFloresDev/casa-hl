import { Toaster as Sonner } from 'sonner';

/** Montar una sola vez por página (persiste entre navegaciones del panel). */
export default function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      containerAriaLabel="Notificaciones"
      className="admin-toaster"
      toastOptions={{ closeButtonAriaLabel: 'Cerrar notificación', style: { fontFamily: 'var(--font-sans)', borderRadius: '14px' } }}
    />
  );
}
