import { allowed } from '@/lib/auth';
import { PageHeader, PermissionState, Unavailable } from '@/components/states';
export default async function AI() {
  if (!(await allowed('ai.use'))) return <PermissionState />;
  return (
    <>
      <PageHeader
        title="KingdomFlow AI"
        description="Administrative assistance, guided by your leadership."
      />
      <Unavailable
        title="AI Integration Not Connected"
        description="The provider adapter, authorized data tools, and usage metering are not enabled in this release. No ministry data is sent to an AI provider."
      />
      <div className="notice">
        AI-generated administrative recommendations should always be reviewed by ministry
        leadership.
      </div>
    </>
  );
}
