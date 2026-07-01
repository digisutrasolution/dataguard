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
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  role: RoleName;
  twofaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
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
    isActive: r.is_active ?? true,
    lastLoginAt: r.last_login_at ?? null,
    createdAt: r.created_at,
  };
}
function toMember(u: User): TeamMember {
  return { id: u.id, email: u.email, role: u.role, twofaEnabled: u.twofaEnabled, isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt };
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
    isActive: true,
    lastLoginAt: null,
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
    isActive: true, lastLoginAt: null, createdAt: new Date().toISOString(),
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

export async function setLastLogin(email: string): Promise<void> {
  const e = email.toLowerCase();
  if (dbActive()) { await q('UPDATE users SET last_login_at = now() WHERE email = $1', [e]).catch(() => {}); return; }
  const u = mem.get(e);
  if (u) u.lastLoginAt = new Date().toISOString();
}

// ---- Team management (scoped to a customer) ----
export async function listByCustomer(customerId: string): Promise<TeamMember[]> {
  if (dbActive()) {
    const { rows } = await q('SELECT * FROM users WHERE customer_id = $1 ORDER BY created_at', [customerId]);
    return rows.map(rowToUser).map(toMember);
  }
  return [...mem.values()].filter((u) => u.customerId === customerId).map(toMember);
}

export async function getMember(id: string, customerId: string): Promise<TeamMember | null> {
  if (dbActive()) {
    const { rows } = await q('SELECT * FROM users WHERE id = $1 AND customer_id = $2', [id, customerId]);
    return rows[0] ? toMember(rowToUser(rows[0])) : null;
  }
  const u = [...mem.values()].find((x) => x.id === id && x.customerId === customerId);
  return u ? toMember(u) : null;
}

export async function updateMember(id: string, customerId: string, patch: { role?: RoleName; isActive?: boolean }): Promise<TeamMember | null> {
  if (dbActive()) {
    const { rows } = await q(
      `UPDATE users SET role = COALESCE($3, role), is_active = COALESCE($4, is_active)
       WHERE id = $1 AND customer_id = $2 RETURNING *`,
      [id, customerId, patch.role ?? null, patch.isActive ?? null]);
    return rows[0] ? toMember(rowToUser(rows[0])) : null;
  }
  const u = [...mem.values()].find((x) => x.id === id && x.customerId === customerId);
  if (!u) return null;
  if (patch.role !== undefined) u.role = patch.role;
  if (patch.isActive !== undefined) u.isActive = patch.isActive;
  return toMember(u);
}
