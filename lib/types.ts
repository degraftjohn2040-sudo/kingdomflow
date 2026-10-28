export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  country: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  plan: string;
  status: string;
  denomination: string | null;
  organization_type: string | null;
  onboarding_complete: boolean;
  contact_count: number;
};

export type Membership = {
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  branch_ids: string[] | null;
  full_name: string | null;
  email: string | null;
};

export type AuthContext = {
  user: { id: string; email: string; fullName: string; avatarUrl: string | null };
  organizations: Array<{ id: string; name: string; slug: string; role: string; timezone: string; currency: string }>;
  activeOrg: Organization | null;
  membership: Membership | null;
  permissions: string[];
  role: string | null;
  isPlatformAdmin: boolean;
};

export type MemberRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  city: string | null;
  status: string;
  join_date: string | null;
  joined_on: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  created_at: string;
  archived_at: string | null;
};

export type BranchRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_main: boolean;
  status: string;
};

export type DepartmentRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  branch_id: string | null;
  leader_id: string | null;
  status: string;
};

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location: string | null;
  branch_id: string | null;
  capacity: number | null;
  organizer_id: string | null;
};

export type SessionRow = {
  id: string;
  title: string;
  session_date: string;
  event_id: string | null;
  branch_id: string | null;
  qr_expires_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type WorkspaceSummary = {
  members_total: number;
  members_active: number;
  members_new: number;
  visitors: number;
  sessions: number;
  attendance_present: number;
  open_followups: number;
  open_tasks: number;
  upcoming_events: number;
  branches: number;
  departments: number;
  team: number;
  contributions_total: number | null;
  expenses_total: number | null;
  can_finance: boolean;
  attendance_trend: Array<{ day: string; present: number }>;
};

export type PlatformOrganization = {
  id: string;
  name: string;
  organization_type: string | null;
  country: string | null;
  timezone: string;
  status: string;
  contact_count: number;
  created_at: string;
  plan_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  team_size: number;
};

export type PlatformOverview = {
  organizations_count: number;
  profiles_count: number;
  members_count: number;
  active_subscriptions: number;
  organizations: PlatformOrganization[];
  recent_activity: Array<{
    id: string;
    action: string;
    resource_type: string | null;
    created_at: string;
    organization_name: string | null;
  }>;
};
