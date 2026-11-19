import { mkdirSync, writeFileSync } from 'node:fs';
import { hashPassword } from '../src/lib/server/password.ts';

if (!process.env.ADMIN_PASSWORD)
  throw new Error('ADMIN_PASSWORD es obligatoria; no se generó seed.sql.');
const quote = (value: unknown): string =>
  typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const statements: string[] = [];
const insert = (table: string, values: Record<string, unknown>) => {
  statements.push(
    'INSERT OR IGNORE INTO ' +
      table +
      ' (' +
      Object.keys(values).join(', ') +
      ') VALUES (' +
      Object.values(values).map(quote).join(', ') +
      ');',
  );
};
insert('users', {
  id: crypto.randomUUID(),
  username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
  name: process.env.ADMIN_NAME || 'Administración H&L',
  role: 'admin',
  password_hash: await hashPassword(process.env.ADMIN_PASSWORD),
});
const rooms = [
  {
    number: '101',
    slug: '101-simple',
    name: 'Simple',
    floor: 1,
    type: 'Simple',
    capacity: 1,
    priceCents: 6000,
    amenities: ['bano_privado', 'wifi', 'tv', 'toallas'],
    description: 'Cama de plaza y media, escritorio y luz natural. Pensada para viajes de trabajo.',
    image: 'room-simple',
    sortOrder: 10,
  },
  {
    number: '102',
    slug: '102-matrimonial',
    name: 'Matrimonial',
    floor: 1,
    type: 'Matrimonial',
    capacity: 2,
    priceCents: 8000,
    amenities: ['bano_privado', 'wifi', 'tv', 'toallas'],
    description: 'Cama de dos plazas, ropa de cama de algodón y ventana hacia el patio interior.',
    image: 'room-matrimonial',
    sortOrder: 20,
  },
  {
    number: '201',
    slug: '201-doble',
    name: 'Doble',
    floor: 2,
    type: 'Doble',
    capacity: 2,
    priceCents: 9000,
    amenities: ['bano_privado', 'wifi', 'tv', 'toallas', 'escritorio'],
    description: 'Dos camas de plaza y media. Ideal para amigos, colegas o padre e hijo.',
    image: 'room-doble',
    sortOrder: 30,
  },
  {
    number: '202',
    slug: '202-familiar',
    name: 'Familiar',
    floor: 2,
    type: 'Triple / Familiar',
    capacity: 4,
    priceCents: 12000,
    amenities: ['bano_privado', 'wifi', 'tv', 'toallas'],
    description:
      'Cama de dos plazas y dos camas individuales. Espacio para que la familia descanse junta.',
    image: 'room-familiar',
    sortOrder: 40,
  },
  {
    number: '301',
    slug: '301-minidepartamento',
    name: 'Minidepartamento',
    floor: 3,
    type: 'Minidepartamento',
    capacity: 3,
    priceCents: 15000,
    amenities: ['bano_privado', 'wifi', 'tv', 'cocina', 'toallas'],
    description: 'Dormitorio, sala con sofá y kitchenette equipada. Para estadías de varios días.',
    image: 'room-minidepartamento',
    sortOrder: 50,
  },
];

for (const room of rooms) {
  insert(
    'rooms',
    Object.fromEntries(
      Object.entries({ id: crypto.randomUUID(), ...room }).map(([key, value]) => [
        key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()),
        Array.isArray(value) ? JSON.stringify(value) : value,
      ]),
    ),
  );
}
mkdirSync('data', { recursive: true });
writeFileSync('data/seed.sql', statements.join('\n') + '\n');
console.log('data/seed.sql generado (administrador y 5 habitaciones; idempotente).');
