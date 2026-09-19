'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { convertVisitor } from '@/app/app/actions';
import { Button } from './ui/button';
export function ConvertVisitor({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          if (
            !confirm(
              'Create a member from this visitor? Their contact details and notes will be copied.',
            )
          )
            return;
          setBusy(true);
          try {
            const result = await convertVisitor(id);
            if (result.id) {
              router.push(`/app/members/${result.id}`);
              router.refresh();
            } else setError(result.error ?? 'Conversion failed.');
          } catch {
            setError('Network error. Check this visitor before retrying.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Converting…' : 'Convert to member'}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
