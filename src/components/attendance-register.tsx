'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordAttendance } from '@/app/app/actions';
import { Button } from './ui/button';
import type { ActionResult } from '@/lib/validation';
type Member = { id: string; first_name: string; last_name: string };
export function AttendanceRegister({
  sessionId,
  members,
  existing,
}: {
  sessionId: string;
  members: Member[];
  existing: Record<string, string>;
}) {
  const [statuses, setStatuses] = useState(existing);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult>({});
  const router = useRouter();
  return (
    <div>
      <div className="attendance-toolbar">
        <p>Only marked members are saved. Unmarked is not the same as absent.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatuses(Object.fromEntries(members.map((m) => [m.id, 'present'])))}
        >
          Mark this page present
        </Button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setResult({});
          try {
            const r = await recordAttendance({
              sessionId,
              records: members
                .filter((m) => statuses[m.id])
                .map((m) => ({ member_id: m.id, status: statuses[m.id] })),
            });
            setResult(r);
            if (r.success) router.refresh();
          } catch {
            setResult({ error: 'Network error. Attendance could not be confirmed.' });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.first_name} {m.last_name}
                  </td>
                  <td>
                    <select
                      aria-label={`Attendance for ${m.first_name} ${m.last_name}`}
                      value={statuses[m.id] ?? ''}
                      onChange={(e) => setStatuses({ ...statuses, [m.id]: e.target.value })}
                    >
                      {!existing[m.id] && <option value="">Not marked</option>}
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.error && (
          <p className="notice danger" role="alert">
            {result.error}
          </p>
        )}
        {result.success && (
          <p className="notice success" role="status">
            {result.success}
          </p>
        )}
        <div className="form-panel">
          <Button type="submit" disabled={busy || !members.length}>
            {busy ? 'Saving attendance…' : 'Save attendance'}
          </Button>
        </div>
      </form>
    </div>
  );
}
