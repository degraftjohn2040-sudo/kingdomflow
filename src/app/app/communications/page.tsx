import { allowed } from '@/lib/auth';
import { PageHeader, PermissionState, Unavailable } from '@/components/states';
export default async function Communications() {
  if (!(await allowed('communications.send'))) return <PermissionState />;
  return (
    <>
      <PageHeader
        title="Communications"
        description="Thoughtful communication, meaningful connection."
      />
      <Unavailable
        title="WhatsApp Integration Not Connected"
        description="Meta WhatsApp Cloud API sending, delivery webhooks, message templates, and email campaigns are not enabled in this release. No messages can be sent here yet."
      />
    </>
  );
}
