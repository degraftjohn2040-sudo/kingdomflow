import { z } from 'zod';
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'datetime-local' | 'number' | 'textarea' | 'select';
  required?: boolean;
  max?: number;
  options?: string[];
  relation?: 'members' | 'departments' | 'groups' | 'events' | 'visitors';
  min?: number;
  step?: string;
};
export type Module = {
  title: string;
  singular: string;
  description: string;
  table: string;
  read: string;
  write: string;
  create?: string;
  feature?: string;
  fields: Field[];
  columns: string[];
  search: string[];
  status?: string[];
};
const names: Field[] = [
  { key: 'first_name', label: 'First name', required: true, max: 100 },
  { key: 'last_name', label: 'Last name', required: true, max: 100 },
];
const contact: Field[] = [
  { key: 'email', label: 'Email', type: 'email', max: 254 },
  { key: 'phone', label: 'Phone', type: 'tel', max: 40 },
];
const notes: Field = { key: 'notes', label: 'Notes', type: 'textarea', max: 4000 };
const name: Field = { key: 'name', label: 'Name', required: true, max: 150 };
const title: Field = { key: 'title', label: 'Title', required: true, max: 150 };
const active: Field = {
  key: 'status',
  label: 'Status',
  type: 'select',
  required: true,
  options: ['active', 'archived'],
};
export const modules: Record<string, Module> = {
  members: {
    title: 'Members',
    singular: 'member',
    description: 'Know your people. Care for every part of their journey.',
    table: 'members',
    read: 'members.read',
    write: 'members.update',
    create: 'members.create',
    columns: ['first_name', 'last_name', 'email', 'phone', 'status'],
    search: ['first_name', 'last_name'],
    status: ['active', 'inactive', 'archived'],
    fields: [
      ...names,
      ...contact,
      {
        key: 'gender',
        label: 'Gender',
        type: 'select',
        options: ['female', 'male', 'not_specified'],
      },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
      { key: 'address', label: 'Address', max: 1000 },
      { key: 'occupation', label: 'Occupation', max: 150 },
      {
        key: 'marital_status',
        label: 'Marital status',
        type: 'select',
        options: ['single', 'married', 'widowed', 'divorced', 'not_specified'],
      },
      { key: 'membership_date', label: 'Membership date', type: 'date', required: true },
      { ...active, options: ['active', 'inactive', 'archived'] },
      { key: 'department_id', label: 'Department', relation: 'departments' },
      { key: 'group_id', label: 'Group', relation: 'groups' },
      { key: 'emergency_contact', label: 'Emergency contact', max: 500 },
      notes,
    ],
  },
  visitors: {
    title: 'Visitors',
    singular: 'visitor',
    description: 'Turn a first welcome into a lasting connection.',
    table: 'visitors',
    read: 'visitors.read',
    write: 'visitors.manage',
    columns: ['first_name', 'last_name', 'first_visit_date', 'assigned_worker', 'status'],
    search: ['first_name', 'last_name'],
    status: ['new', 'contacted', 'scheduled', 'joined', 'closed'],
    fields: [
      ...names,
      ...contact,
      { key: 'first_visit_date', label: 'First visit', type: 'date', required: true },
      { key: 'invited_by', label: 'Invited by', relation: 'members' },
      { key: 'event_id', label: 'Event attended', relation: 'events' },
      { key: 'assigned_worker', label: 'Assigned worker (name)', max: 150 },
      {
        key: 'status',
        label: 'Follow-up status',
        type: 'select',
        required: true,
        options: ['new', 'contacted', 'scheduled', 'joined', 'closed'],
      },
      { key: 'next_follow_up', label: 'Next follow-up date', type: 'date' },
      { key: 'next_action', label: 'Next action', max: 1000 },
      notes,
    ],
  },
  departments: {
    title: 'Departments',
    singular: 'department',
    description: 'Organize the teams that make ministry possible.',
    table: 'departments',
    read: 'departments.read',
    write: 'departments.manage',
    columns: ['name', 'leader_name', 'status'],
    search: ['name'],
    fields: [
      name,
      { key: 'description', label: 'Description', type: 'textarea', max: 4000 },
      { key: 'leader_name', label: 'Leader (name)', max: 150 },
      active,
    ],
  },
  groups: {
    title: 'Groups',
    singular: 'group',
    description: 'Create space for community, discipleship, and growth.',
    table: 'groups',
    read: 'groups.read',
    write: 'groups.manage',
    columns: ['name', 'group_type', 'leader_name', 'meeting_schedule', 'status'],
    search: ['name'],
    fields: [
      name,
      {
        key: 'group_type',
        label: 'Group type',
        type: 'select',
        required: true,
        options: ['small_group', 'cell', 'bible_study', 'campus', 'fellowship', 'discipleship'],
      },
      { key: 'leader_name', label: 'Leader (name)', max: 150 },
      { key: 'meeting_schedule', label: 'Meeting schedule', max: 500 },
      active,
      notes,
    ],
  },
  events: {
    title: 'Events',
    singular: 'event',
    description: 'Plan the moments that bring your community together.',
    table: 'events',
    read: 'events.read',
    write: 'events.manage',
    columns: ['title', 'venue', 'starts_at', 'status'],
    search: ['title'],
    fields: [
      title,
      { key: 'description', label: 'Description', type: 'textarea', max: 4000 },
      { key: 'venue', label: 'Venue', max: 300 },
      { key: 'starts_at', label: 'Starts at (UTC)', type: 'datetime-local', required: true },
      { key: 'ends_at', label: 'Ends at (UTC)', type: 'datetime-local', required: true },
      { key: 'organizer', label: 'Organizer (name)', max: 150 },
      { key: 'capacity', label: 'Capacity', type: 'number', min: 1 },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: ['scheduled', 'completed', 'cancelled'],
      },
    ],
  },
  followups: {
    title: 'Follow-ups',
    singular: 'follow-up',
    description: 'Make the next conversation count.',
    table: 'followups',
    read: 'followups.read',
    write: 'followups.manage',
    columns: ['title', 'assigned_worker', 'next_follow_up', 'status'],
    search: ['title'],
    fields: [
      title,
      { key: 'visitor_id', label: 'Visitor', relation: 'visitors' },
      { key: 'member_id', label: 'Member', relation: 'members' },
      { key: 'assigned_worker', label: 'Assigned worker (name)', max: 150 },
      { key: 'next_follow_up', label: 'Next follow-up', type: 'date', required: true },
      {
        key: 'status',
        label: 'Pipeline stage',
        type: 'select',
        required: true,
        options: [
          'new',
          'contacted',
          'required',
          'scheduled',
          'visited',
          'joined_group',
          'joined_church',
          'needs_attention',
          'closed',
        ],
      },
      {
        key: 'contact_attempts',
        label: 'Contact attempts',
        type: 'number',
        required: true,
        min: 0,
        max: 10000,
      },
      notes,
    ],
  },
  'prayer-requests': {
    title: 'Prayer requests',
    singular: 'prayer request',
    description: 'Care with compassion. Protect what is shared in confidence.',
    table: 'prayer_requests',
    read: 'prayer.read',
    write: 'prayer.manage',
    columns: ['title', 'category', 'confidentiality', 'status'],
    search: ['title'],
    fields: [
      title,
      { key: 'requester', label: 'Requester', max: 150 },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: ['general', 'health', 'family', 'work', 'thanksgiving'],
      },
      { key: 'details', label: 'Prayer details', type: 'textarea', required: true, max: 4000 },
      {
        key: 'confidentiality',
        label: 'Visibility',
        type: 'select',
        required: true,
        options: ['leadership', 'team'],
      },
      { key: 'assigned_team', label: 'Assigned team (name)', max: 150 },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: ['open', 'praying', 'answered', 'closed'],
      },
      { key: 'testimony', label: 'Testimony', type: 'textarea', max: 4000 },
    ],
  },
  volunteers: {
    title: 'Volunteers',
    singular: 'volunteer',
    description: 'Support the people who generously serve.',
    table: 'volunteers',
    read: 'volunteers.read',
    write: 'volunteers.manage',
    columns: ['member_id', 'skills', 'assignment', 'status'],
    search: ['skills'],
    fields: [
      { key: 'member_id', label: 'Member', required: true, relation: 'members' },
      { key: 'skills', label: 'Skills', max: 1000 },
      { key: 'availability', label: 'Availability', max: 1000 },
      { key: 'assignment', label: 'Assignment', max: 1000 },
      { key: 'service_schedule', label: 'Service schedule', max: 1000 },
      { ...active, options: ['active', 'unavailable', 'archived'] },
    ],
  },
  contributions: {
    title: 'Contributions',
    singular: 'contribution',
    description:
      'Accurate stewardship, recorded with care. Ledger entries are not provider-verified payments.',
    table: 'contributions',
    read: 'finance.read',
    write: 'finance.manage',
    feature: 'finance',
    columns: ['contribution_date', 'contribution_type', 'amount', 'currency', 'payment_method'],
    search: ['reference'],
    fields: [
      { key: 'member_id', label: 'Member (optional)', relation: 'members' },
      {
        key: 'amount',
        label: 'Amount (GHS)',
        type: 'number',
        required: true,
        min: 0.01,
        step: '0.01',
        max: 9999999999.99,
      },
      {
        key: 'contribution_type',
        label: 'Type',
        type: 'select',
        required: true,
        options: ['tithe', 'offering', 'donation', 'pledge', 'fundraising', 'special'],
      },
      {
        key: 'payment_method',
        label: 'Payment method',
        type: 'select',
        required: true,
        options: ['cash', 'mobile_money', 'bank', 'card', 'other'],
      },
      { key: 'reference', label: 'Reference', max: 150 },
      { key: 'contribution_date', label: 'Date', type: 'date', required: true },
      notes,
    ],
  },
  attendance: {
    title: 'Attendance',
    singular: 'session',
    description: 'Record participation. Understand who needs a little extra care.',
    table: 'attendance_sessions',
    read: 'attendance.read',
    write: 'attendance.manage',
    columns: ['title', 'session_type', 'session_date'],
    search: ['title'],
    fields: [
      title,
      { key: 'session_date', label: 'Session date', type: 'date', required: true },
      {
        key: 'session_type',
        label: 'Session type',
        type: 'select',
        required: true,
        options: ['service', 'meeting', 'event', 'group', 'department'],
      },
      { key: 'event_id', label: 'Event (event sessions only)', relation: 'events' },
      { key: 'group_id', label: 'Group (group sessions only)', relation: 'groups' },
      {
        key: 'department_id',
        label: 'Department (department sessions only)',
        relation: 'departments',
      },
    ],
  },
};
export function getModule(slug: string): Module | undefined {
  return Object.hasOwn(modules, slug) ? modules[slug] : undefined;
}
export function moduleSchema(module: Module) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of module.fields) {
    let base: z.ZodType;
    if (f.relation) base = z.uuid();
    else if (f.options) base = z.enum(f.options as [string, ...string[]]);
    else if (f.type === 'number') {
      let n = z.coerce
        .number()
        .min(f.min ?? 0)
        .max(f.max ?? 2147483647);
      if (f.step !== '0.01') n = n.int();
      else
        n = n.refine(
          (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
          'Use at most two decimal places.',
        );
      base = n;
    } else if (f.type === 'email') base = z.email().max(254);
    else if (f.type === 'date')
      base = z.iso
        .date()
        .refine((v) => v >= '1900-01-01' && v <= '2200-12-31', 'Date is out of range.');
    else if (f.type === 'datetime-local')
      base = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
        .refine(
          (v) =>
            z.iso.date().safeParse(v.slice(0, 10)).success &&
            Number(v.slice(11, 13)) < 24 &&
            Number(v.slice(14, 16)) < 60 &&
            (!v.slice(17, 19) || Number(v.slice(17, 19)) < 60),
          'Invalid date.',
        )
        .transform((v) => new Date(v + 'Z').toISOString());
    else if (f.type === 'tel')
      base = z
        .string()
        .max(40)
        .regex(/^[+\d\s().-]+$/, 'Invalid phone number.');
    else
      base = z
        .string()
        .trim()
        .min(f.required ? 1 : 0)
        .max(f.max ?? 150);
    shape[f.key] = z.preprocess(
      (v) =>
        v === '' || v === undefined || v === null ? null : typeof v === 'string' ? v.trim() : v,
      f.required ? base : base.nullable(),
    );
  }
  return z
    .object(shape)
    .strict()
    .superRefine((v, ctx) => {
      if (v.starts_at && v.ends_at && String(v.ends_at) < String(v.starts_at))
        ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'End must be after start.' });
      if (v.date_of_birth && String(v.date_of_birth) > new Date().toISOString().slice(0, 10))
        ctx.addIssue({
          code: 'custom',
          path: ['date_of_birth'],
          message: 'Birth date cannot be in the future.',
        });
      if (module.table === 'attendance_sessions') {
        const expected: Record<string, string> = {
          event: 'event_id',
          group: 'group_id',
          department: 'department_id',
        };
        for (const key of ['event_id', 'group_id', 'department_id']) {
          if (key === expected[String(v.session_type)] ? !v[key] : Boolean(v[key]))
            ctx.addIssue({
              code: 'custom',
              path: [key],
              message:
                key === expected[String(v.session_type)]
                  ? 'Select the linked record for this session type.'
                  : 'Leave this empty for the selected session type.',
            });
        }
      }
    });
}
