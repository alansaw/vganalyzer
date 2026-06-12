import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authEnabled,
  authenticate,
  createSessionToken,
  verifySessionToken,
} from '../../src/auth.js';

describe('auth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'admin-secret';
    process.env.VIEWER_PASSWORD = 'viewer-secret';
    process.env.SESSION_SECRET = 'test-secret';
  });
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.VIEWER_PASSWORD;
    delete process.env.SESSION_SECRET;
  });

  it('is disabled when no passwords are configured', () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.VIEWER_PASSWORD;
    expect(authEnabled()).toBe(false);
  });

  it('maps the two accounts to their roles', () => {
    expect(authenticate('admin', 'admin-secret')).toBe('admin');
    expect(authenticate('user', 'viewer-secret')).toBe('user');
    expect(authenticate('admin', 'wrong')).toBeNull();
    expect(authenticate('user', 'admin-secret')).toBeNull();
    expect(authenticate('someone', 'admin-secret')).toBeNull();
  });

  it('accepts case/whitespace variants of the username (mobile autocapitalize), not the password', () => {
    expect(authenticate('Admin', 'admin-secret')).toBe('admin');
    expect(authenticate('  ADMIN  ', 'admin-secret')).toBe('admin');
    expect(authenticate('User', 'viewer-secret')).toBe('user');
    expect(authenticate('admin', 'Admin-secret')).toBeNull(); // password stays exact
  });

  it('round-trips a valid session token', () => {
    const token = createSessionToken('admin');
    expect(verifySessionToken(token)).toBe('admin');
    expect(verifySessionToken(createSessionToken('user'))).toBe('user');
  });

  it('rejects tampered tokens', () => {
    const token = createSessionToken('user');
    const [payload] = token.split('.');
    // Forge an admin payload but keep the old signature.
    const forged = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + 10_000 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${token.split('.')[1]}`)).toBeNull();
    expect(verifySessionToken(`${payload}.bad-signature`)).toBeNull();
    expect(verifySessionToken('garbage')).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = createSessionToken('admin', Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = createSessionToken('admin');
    process.env.SESSION_SECRET = 'rotated-secret';
    expect(verifySessionToken(token)).toBeNull();
  });
});
