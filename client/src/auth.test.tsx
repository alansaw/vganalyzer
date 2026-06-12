import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import { AuthGate, useAuth } from './auth';

// Consumer that proves the gate is open and exercises logout.
function Inside() {
  const { auth, logout } = useAuth();
  return (
    <div>
      <div>INSIDE role={auth.role}</div>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}

describe('AuthGate', () => {
  let loggedIn: boolean;

  beforeEach(() => {
    loggedIn = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = String(url);
        if (u.includes('/auth/me')) {
          return loggedIn
            ? new Response(JSON.stringify({ role: 'admin', authEnabled: true }), { status: 200 })
            : new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });
        }
        if (u.includes('/auth/login') && init?.method === 'POST') {
          loggedIn = true;
          return new Response(JSON.stringify({ role: 'admin', authEnabled: true }), { status: 200 });
        }
        if (u.includes('/auth/logout') && init?.method === 'POST') {
          loggedIn = false;
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ error: 'unexpected ' + u }), { status: 500 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('signs in (gate opens to the app) and signs out (gate closes to login)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AuthGate>
        <Inside />
      </AuthGate>,
    );

    // Not signed in -> login page, app hidden.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.queryByText(/INSIDE/)).not.toBeInTheDocument();

    // Sign in -> app appears WITHOUT a reload (the bug being regression-tested).
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('INSIDE role=admin')).toBeInTheDocument());

    // Sign out -> login page returns immediately.
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.queryByText(/INSIDE/)).not.toBeInTheDocument();
  });
});
