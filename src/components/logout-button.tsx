'use client';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '@/app/auth/actions';
export function LogoutButton() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="logout-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const result = await logout();
            setError(result.error ?? '');
          } catch {
            setError('Logout could not be confirmed. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={17} />
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && (
        <small role="alert" className="error">
          {error}
        </small>
      )}
    </>
  );
}
