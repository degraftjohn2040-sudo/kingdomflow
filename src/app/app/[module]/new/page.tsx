import { notFound } from 'next/navigation';
import { getModule } from '@/lib/modules';
import { allowed } from '@/lib/auth';
import { relationOptions } from '@/lib/records';
import { RecordForm } from '@/components/record-form';
import { PageHeader, PermissionState } from '@/components/states';
export default async function NewRecord({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const definition = getModule(slug);
  if (!definition) notFound();
  if (!(await allowed(definition.create ?? definition.write))) return <PermissionState />;
  const options = await relationOptions(definition);
  return (
    <>
      <PageHeader
        title={`Add ${definition.singular}`}
        description="Required fields are marked with an asterisk. Your changes are saved only after database confirmation."
      />
      <section className="panel form-panel">
        <RecordForm slug={slug} module={definition} options={options} />
      </section>
    </>
  );
}
