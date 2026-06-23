// User repository: Postgres when the DB is active, in-memory Map otherwise.
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { dbActive, q } from '../../db/pool.js';
import type { RoleName } from './rbac.js';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: RoleName;
  customerId: string | null;
  totpSecret: string | null;
  twofaEnabled: boolean;
  createdAt: string;
}

function rowToUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role,
    customerId: r.customer_id,
    totpSecret: r.totp_secret,
    twofaEnabled: r.twofa_enabled,
    createdAt: r.created_at,
  };
}

// ---- in-memory fallback (used only when DB is inactive) ----
const mem = new Map<string, User>();
function seedMem(email: string, password: string, role: RoleName, customerId: string | null) {
  mem.set(email.toLowerCase(), {
    id: randomUUID(),
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    customerId,
    totpSecret: null,
    twofaEnabled: false,
    createdAt: new Date().toISOString(),
  });
}
seedMem('admin@dataguard.io', 'admin123', 'admin', null);
seedMem('owner@acme.com', 'owner123', 'customer_owner', 'demo-customer');

export async function findByEmail(email: string): Promise<User | undefined> {
  const e = email.toLowerCase();
  if (dbActive()) {
    const { rows } = await q('SELECT * FROM users WHERE email = $1', [e]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }
  return mem.get(e);
}

export async function createUser(input: {
  email: string;
  password: string;
  role: RoleName;
  customerId: string | null;
}): Promise<User> {
  const email = input.email.toLowerCase();
  const hash = bcrypt.hashSync(input.password, 10);
  if (dbActive()) {
    try {
      const { rows } = await q(
        `INSERT INTO users (email, password_hash, role, customer_id)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [email, hash, input.role, input.customerId],
      );
      return rowToUser(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') throw new Error('EMAIL_TAKEN'); // unique_violation
      throw e;
    }
  }
  if (mem.has(email)) throw new Error('EMAIL_TAKEN');
  const user: User = {
    id: randomUUID(), email, passwordHash: hash, role: input.role,
    customerId: input.customerId, totpSecret: null, twofaEnabled: false,
    createdAt: new Date().toISOString(),
  };
  mem.set(email, user);
  return user;
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

export async function setTotp(email: string, secret: string | null, enabled: boolean): Promise<void> {
  const e = email.toLowerCase();
  if (dbActive()) {
    await q('UPDATE users SET totp_secret = $2, twofa_enabled = $3 WHERE email = $1', [e, secret, enabled]);
    return;
  }
  const u = mem.get(e);
  if (u) { u.totpSecret = secret; u.twofaEnabled = enabled; }
}
