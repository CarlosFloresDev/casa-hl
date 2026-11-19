const ITERATIONS = 100000;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      key,
      256,
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ['pbkdf2', ITERATIONS, encode(salt), encode(await derive(password, salt))].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || parts[1] !== String(ITERATIONS)) return false;
  try {
    const salt = decode(parts[2]!);
    const expected = decode(parts[3]!);
    if (
      salt.length !== 16 ||
      expected.length !== 32 ||
      encode(salt) !== parts[2] ||
      encode(expected) !== parts[3]
    )
      return false;
    const actual = await derive(password, salt);
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual[i]! ^ expected[i]!;
    return difference === 0;
  } catch {
    return false;
  }
}
