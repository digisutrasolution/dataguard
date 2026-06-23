import jwt from 'jsonwebtoken';
import { permsForRole, type Permission, type RoleName } from './rbac.js';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const EXPIRES = '12h';

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
