import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from './http.js';

// Simple two-account auth with a signed session cookie.
//
//   admin / $ADMIN_PASSWORD  -> role "admin"  (can add/delete transactions, refresh recs)
//   user  / $VIEWER_PASSWORD -> role "user"   (read-only)
//
// Auth is ENABLED only when at least one password env var is set. With none set
// (local dev, tests), every request is treated as admin so existing workflows
// keep working. In production (render.yaml) the passwords are required.

export type Role = 'admin' | 'user';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      role?: Role;
    }
  }
}

const COOKIE_NAME = 'vg_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Read env at call time (not import time) so tests and platforms can set them late.
function adminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD || undefined;
}
function viewerPassword(): string | undefined {
  return process.env.VIEWER_PASSWORD || undefined;
}
function sessionSecret(): string {
  return process.env.SESSION_SECRET || 'vganalyzer-dev-secret';
}

export function authEnabled(): boolean {
  return Boolean(adminPassword() || viewerPassword());
}

export function authenticate(username: string, password: string): Role | null {
  // Usernames are case-insensitive and whitespace-tolerant (mobile keyboards
  // autocapitalize, autofill adds spaces). Passwords stay exact.
  const user = username.trim().toLowerCase();
  const admin = adminPassword();
  const viewer = viewerPassword();
  if (admin && user === 'admin' && timingSafeEq(password, admin)) return 'admin';
  if (viewer && user === 'user' && timingSafeEq(password, viewer)) return 'user';
  return null;
}

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function sign(data: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
}

export function createSessionToken(role: Role, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ role, exp: now + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): Role | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (!timingSafeEq(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { role?: string; exp?: number };
    if (data.role !== 'admin' && data.role !== 'user') return null;
    if (typeof data.exp !== 'number' || data.exp < now) return null;
    return data.role;
  } catch {
    return null;
  }
}

function tokenFromRequest(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function setSessionCookie(res: Response, token: string | null): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  if (token === null) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
  } else {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax${secure}`,
    );
  }
}

// Require a valid session on all /api routes (no-op when auth is disabled).
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!authEnabled()) {
    req.role = 'admin';
    return next();
  }
  const role = verifySessionToken(tokenFromRequest(req));
  if (!role) return next(new HttpError(401, 'Not signed in.'));
  req.role = role;
  next();
}

// Require the admin role for mutating endpoints.
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.role !== 'admin') return next(new HttpError(403, 'Admin access required.'));
  next();
}

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export function authRouter(): Router {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Username and password are required.');
      const role = authenticate(parsed.data.username, parsed.data.password);
      if (!role) throw new HttpError(401, 'Invalid username or password.');
      setSessionCookie(res, createSessionToken(role));
      res.json({ role, authEnabled: true });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (_req, res) => {
      setSessionCookie(res, null);
      res.status(204).end();
    }),
  );

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      if (!authEnabled()) {
        res.json({ role: 'admin', authEnabled: false });
        return;
      }
      const role = verifySessionToken(tokenFromRequest(req));
      if (!role) throw new HttpError(401, 'Not signed in.');
      res.json({ role, authEnabled: true });
    }),
  );

  return router;
}
