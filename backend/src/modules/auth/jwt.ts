import jwt from 'jsonwebtoken';
import { permsForRole, type Permission, type RoleName } from './rbac.js';

const DEV_FALLBACK = 'dev-secret-change-me';
const SECRET = process.env.JWT_SECRET ?? DEV_FALLBACK;
const EXPIRES = '12h';

// Refuse to boot in production with a missing/default signing secret.
if (process.env.NODE_ENV === 'production' && (SECRET === DEV_FALLBACK || SECRET.length < 16)) {
  throw new Error('JWT_SECRET must be set to a strong value (>=16 chars) in production.');
}
if (SECRET === DEV_FALLBACK) {
  console.warn('[auth] WARNING: using the default dev JWT secret. Set JWT_SECRET before deploying.');
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: RoleName;
  customerId: string | null;
  perms: Permission[];
}

export function signToken(p: Omit<TokenPayload, 'perms'>): string {
  const payload: TokenPayload = { ...p, perms: permsForRole(p.role) };
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
