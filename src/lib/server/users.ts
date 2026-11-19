import { and, asc, count, eq, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type User } from '../db/schema';
import type { UserRole } from '../domain/catalog';
import { DomainError } from './errors';
import { hashPassword, verifyPassword } from './password';

export type SessionUser = Pick<User, 'id' | 'username' | 'name' | 'role'>;

function toSessionUser(u: User): SessionUser {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}

// Hash fijo para igualar el tiempo de respuesta cuando el usuario no existe.
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username.trim().toLowerCase()),
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) return null;
  return toSessionUser(user);
}

export async function getActiveUser(id: string): Promise<SessionUser | null> {
  const user = await db.query.users.findFirst({ where: and(eq(users.id, id), eq(users.active, true)) });
  return user ? toSessionUser(user) : null;
}

export async function listUsers(): Promise<(SessionUser & { active: boolean })[]> {
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return rows.map((u) => ({ ...toSessionUser(u), active: u.active }));
}

export async function createUser(input: {
  username: string;
  name: string;
  password: string;
  role: UserRole;
}): Promise<void> {
  const username = input.username.trim().toLowerCase();
  const exists = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (exists) throw new DomainError('CONFLICT', `El usuario "${username}" ya existe.`);
  await db.insert(users).values({
    username,
    name: input.name.trim(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
  });
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new DomainError('BAD_REQUEST', 'La contraseña actual no es correcta.');
  }
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
}

export async function setUserActive(actorId: string, userId: string, active: boolean): Promise<void> {
  if (actorId === userId) throw new DomainError('BAD_REQUEST', 'No puedes desactivar tu propio usuario.');
  if (!active) {
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (target?.role === 'admin') {
      const [row] = await db
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.active, true), ne(users.id, userId)));
      if ((row?.total ?? 0) === 0) {
        throw new DomainError('BAD_REQUEST', 'Debe quedar al menos un administrador activo.');
      }
    }
  }
  await db.update(users).set({ active }).where(eq(users.id, userId));
}
