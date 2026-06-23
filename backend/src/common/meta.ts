import type { Request } from 'express';

// Extract client IP + device (user-agent) for activity/audit logging.
export function reqMeta(req: Request): { ip: string; device: string } {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  const ip = fwd || req.ip || req.socket.remoteAddress || 'unknown';
  const device = (req.headers['user-agent'] as string | undefined)?.slice(0, 200) || 'unknown';
  return { ip, device };
}
