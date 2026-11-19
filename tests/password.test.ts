import { describe, expect, it } from 'vitest';
import { pbkdf2Sync } from 'node:crypto';
import { hashPassword, verifyPassword } from '../src/lib/server/password';

describe('PBKDF2 passwords', () => {
  it('uses SHA256, 100000 iterations, a random 16-byte salt and 32-byte hash', async () => {
    const stored = await hashPassword('contraseña');
    const [algorithm, iterations, salt, hash] = stored.split('$');
    expect([algorithm, iterations]).toEqual(['pbkdf2', '100000']);
    expect(Buffer.from(salt!, 'base64')).toHaveLength(16);
    expect(hash).toBe(
      pbkdf2Sync('contraseña', Buffer.from(salt!, 'base64'), 100000, 32, 'sha256').toString(
        'base64',
      ),
    );
    expect(await hashPassword('contraseña')).not.toBe(stored);
    expect(await verifyPassword('contraseña', stored)).toBe(true);
    expect(await verifyPassword('incorrecta', stored)).toBe(false);
  });
  it('preserves NFKC normalization', async () => {
    expect(await verifyPassword('é', await hashPassword('e\u0301'))).toBe(true);
  });
  it.each([
    'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    '',
    'pbkdf2$1$abc$def',
    'pbkdf2$100000$!!!$!!!',
    'pbkdf2$100000$YQ==$Yg==',
    'pbkdf2$100000$a$b$extra',
  ])('rejects unsupported or malformed hashes: %s', async (hash) => {
    expect(await verifyPassword('password', hash)).toBe(false);
  });
});
