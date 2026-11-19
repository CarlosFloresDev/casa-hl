/**
 * Datos del negocio que aparecen en el sitio público, comprobantes y mensajes de WhatsApp.
 * Edita este archivo con la información real del hospedaje.
 */
export const SITE = {
  name: 'Casa Hospedaje H&L',
  shortName: 'H&L',
  tagline: 'Hospedaje familiar, limpio y tranquilo',
  description:
    'Habitaciones simples, matrimoniales, familiares y minidepartamentos con baño privado, agua caliente y Wi-Fi. Reserva con el 50% de adelanto.',
  /** Número de WhatsApp con código de país, solo dígitos. */
  whatsapp: '51951234567',
  phoneDisplay: '+51 951 234 567',
  email: 'reservas@casahl.pe',
  address: 'Av. Principal 123',
  city: 'Perú',
  /** URL de "insertar mapa" de Google Maps (opcional). Déjala vacía para ocultar el mapa. */
  mapEmbedUrl: '',
  mapLink: 'https://maps.google.com/?q=Casa+Hospedaje+H%26L',
  checkInTime: '13:00',
  checkOutTime: '11:00',
  social: {
    facebook: '',
    instagram: '',
  },
} as const;

export function whatsappLink(text: string, phone: string = SITE.whatsapp): string {
  const digits = phone.replace(/\D/g, '');
  const target = digits.length === 9 ? `51${digits}` : digits;
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}
