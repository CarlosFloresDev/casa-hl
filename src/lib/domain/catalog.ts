/**
 * Catálogos del dominio. Son la única fuente de verdad para valores enumerados:
 * el esquema de base de datos, la validación (zod) y la interfaz los importan desde aquí.
 */

export const ROOM_TYPES = [
  'Simple',
  'Matrimonial',
  'Doble',
  'Triple / Familiar',
  'Minidepartamento',
  'Departamento completo',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const AMENITIES = {
  bano_privado: 'Baño privado con agua caliente',
  bano_compartido: 'Baño compartido con agua caliente',
  wifi: 'Wi-Fi de alta velocidad',
  tv: 'Smart TV / cable',
  cocina: 'Cocina equipada',
  desayuno: 'Desayuno incluido',
  toallas: 'Toallas y kit de aseo',
  escritorio: 'Escritorio de trabajo',
  ventana_calle: 'Ventana a la calle',
} as const;
export type AmenityKey = keyof typeof AMENITIES;
export const AMENITY_KEYS = Object.keys(AMENITIES) as [AmenityKey, ...AmenityKey[]];

/** Fotos disponibles en src/assets/images para asignar a una habitación. */
export const ROOM_IMAGES = {
  'room-simple': 'Simple luminosa',
  'room-matrimonial': 'Matrimonial cálida',
  'room-doble': 'Dos camas',
  'room-familiar': 'Familiar acogedora',
  'room-minidepartamento': 'Minidepartamento con sala',
  'room-departamento': 'Departamento amplio',
  'room-suite': 'Matrimonial superior',
  'hero-habitacion': 'Habitación con jardín',
} as const;
export type RoomImageKey = keyof typeof ROOM_IMAGES;
export const ROOM_IMAGE_KEYS = Object.keys(ROOM_IMAGES) as [RoomImageKey, ...RoomImageKey[]];

export const PAYMENT_METHODS = {
  yape_plin: 'Yape / Plin',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta (POS)',
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const PAYMENT_METHOD_KEYS = Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]];

export const PAYMENT_KINDS = {
  adelanto: 'Adelanto',
  saldo: 'Saldo',
  otro: 'Otro',
} as const;
export type PaymentKind = keyof typeof PAYMENT_KINDS;
export const PAYMENT_KIND_KEYS = Object.keys(PAYMENT_KINDS) as [PaymentKind, ...PaymentKind[]];

export const RESERVATION_STATUSES = {
  confirmada: 'Confirmada',
  en_casa: 'En casa',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
} as const;
export type ReservationStatus = keyof typeof RESERVATION_STATUSES;
export const RESERVATION_STATUS_KEYS = Object.keys(RESERVATION_STATUSES) as [
  ReservationStatus,
  ...ReservationStatus[],
];

export const RESERVATION_SOURCES = {
  directa: 'Directa',
  web: 'Sitio web',
  whatsapp: 'WhatsApp',
  cotizacion: 'Cotización',
} as const;
export type ReservationSource = keyof typeof RESERVATION_SOURCES;
export const RESERVATION_SOURCE_KEYS = Object.keys(RESERVATION_SOURCES) as [
  ReservationSource,
  ...ReservationSource[],
];

export const EXPENSE_CATEGORIES = [
  'Limpieza e insumos',
  'Servicios básicos',
  'Mantenimiento',
  'Lavandería',
  'Desayunos',
  'Otros',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INQUIRY_STATUSES = {
  nueva: 'Nueva',
  contactada: 'Contactada',
  convertida: 'Convertida en reserva',
  descartada: 'Descartada',
} as const;
export type InquiryStatus = keyof typeof INQUIRY_STATUSES;
export const INQUIRY_STATUS_KEYS = Object.keys(INQUIRY_STATUSES) as [InquiryStatus, ...InquiryStatus[]];

export const USER_ROLES = {
  admin: 'Administrador',
  staff: 'Recepción',
} as const;
export type UserRole = keyof typeof USER_ROLES;
export const USER_ROLE_KEYS = Object.keys(USER_ROLES) as [UserRole, ...UserRole[]];

/**
 * Servicios adicionales cotizables. `per: 'night'` se multiplica por noches;
 * `per: 'stay'` es un cobro único por estadía. Montos en céntimos.
 */
export const EXTRAS = {
  desayuno: { label: 'Desayuno', amountCents: 1500, per: 'night' },
  cochera: { label: 'Cochera', amountCents: 1000, per: 'night' },
  recojo: { label: 'Recojo del terminal', amountCents: 2000, per: 'stay' },
  toallas: { label: 'Juego extra de toallas', amountCents: 1000, per: 'stay' },
} as const satisfies Record<string, { label: string; amountCents: number; per: 'night' | 'stay' }>;
export type ExtraKey = keyof typeof EXTRAS;
export const EXTRA_KEYS = Object.keys(EXTRAS) as [ExtraKey, ...ExtraKey[]];

/** Porcentaje de adelanto requerido para confirmar una reserva. */
export const DEPOSIT_RATE = 0.5;
