// Auth flows: register, login (with optional TOTP), 2FA setup/enable/disable.
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import {
  createUser,
  findByEmail,
  setTotp,
  verifyPassword,
  type User,
} from './users.js';
import { signToken } from './jwt.js';

const ISSUER = 'DataGuard Solutions';

export interface PublicUser {
  id: string;
  email: string;
  role: string;
  customerId: string | null;
  twofaEnabled: boolean;
}
function toPublic(u: User): PublicUser {
  return { id: u.id, email: u.email, role: u.role, customerId: u.customerId, twofaEnabled: u.twofaEnabled };
}

// New customer self-signup → creates the customer's owner user.
export async function register(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
  const user = await createUser({
    email,
    password,
    role: 'customer_owner',
    customerId: `cust-${randomUUID().slice(0, 8)}`,
  });
  const token = signToken({ sub: user.id, email: user.email, role: user.role, customerId: user.customerId });
  return { token, user: toPublic(user) };
}

export type LoginResult =
  | { ok: true; token: string; user: PublicUser }
  | { ok: false; reason: 'invalid_credentials' }
  | { ok: false; reason: 'twofa_required' }
  | { ok: false; reason: 'twofa_invalid' };

export async function login(email: string, password: string, totp?: string): Promise<LoginResult> {
  const user = await findByEmail(email);
  if (!user || !verifyPassword(user, password)) return { ok: false, reason: 'invalid_credentials' };

  if (user.twofaEnabled && user.totpSecret) {
    if (!totp) return { ok: false, reason: 'twofa_required' };
    if (!authenticator.verify({ token: totp, secret: user.totpSecret }))
      return { ok: false, reason: 'twofa_invalid' };
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role, customerId: user.customerId });
  return { ok: true, token, user: toPublic(user) };
}

export async function me(email: string): Promise<PublicUser | null> {
  const u = await findByEmail(email);
  return u ? toPublic(u) : null;
}

// Step 1: generate a secret + otpauth URL (for the authenticator app QR).
export async function setup2fa(email: string): Promise<{ secret: string; otpauth: string }> {
  const secret = authenticator.generateSecret();
  await setTotp(email, secret, false); // stored but disabled until verified
  const otpauth = authenticator.keyuri(email, ISSUER, secret);
  return { secret, otpauth };
}

// Step 2: confirm a code from the app to enable 2FA.
export async function enable2fa(email: string, totp: string): Promise<boolean> {
  const u = await findByEmail(email);
  if (!u || !u.totpSecret) return false;
  if (!authenticator.verify({ token: totp, secret: u.totpSecret })) return false;
  await setTotp(email, u.totpSecret, true);
  return true;
}

export async function disable2fa(email: string): Promise<void> {
  await setTotp(email, null, false);
}
