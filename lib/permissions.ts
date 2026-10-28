/**
 * Permission catalog. The database is the authority (public.role_permissions);
 * this module mirrors it for UI affordances only. Never treat it as a security boundary.
 */

export const ROLES = [
  "owner",
  "senior_pastor",
  "pastor",
  "admin",
  "secretary",
  "finance_officer",
  "department_leader",
  "followup_officer",
  "viewer",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Organization Owner",
  senior_pastor: "Senior Pastor",
  pastor: "Pastor",
  admin: "Administrator",
  secretary: "Secretary",
  finance_officer: "Finance Officer",
  department_leader: "Department Leader",
  followup_officer: "Follow-Up Officer",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control of the organization, staff, billing and settings.",
  senior_pastor: "Organization-wide ministry oversight and leadership.",
  pastor: "Member care, attendance and ministry activity in assigned branches.",
  admin: "Operational management across members, events and departments.",
  secretary: "Member records, attendance, events and meeting administration.",
  finance_officer: "Giving, expenses, reconciliation and financial reports.",
  department_leader: "Assigned department members, activities and reports.",
  followup_officer: "Visitor follow-up and pastoral-care tasks.",
  viewer: "Read-only access to authorized information.",
};

export const PERMISSIONS = [
  "org.view",
  "org.manage",
  "org.audit_logs",
  "plan.manage",
  "branch.view",
  "branch.manage",
  "member.view",
  "member.create",
  "member.update",
  "member.archive",
  "member.export",
  "member.import",
  "member.notes.view",
  "member.notes.manage",
  "staff.view",
  "staff.manage",
  "attendance.view",
  "attendance.manage",
  "event.view",
  "event.manage",
  "form.view",
  "form.manage",
  "finance.view",
  "finance.manage",
  "department.view",
  "department.manage",
  "report.view",
  "report.export",
  "communication.view",
  "communication.manage",
  "followup.view",
  "followup.manage",
  "visitor.view",
  "visitor.manage",
  "task.view",
  "task.manage",
  "prayer.view",
  "prayer.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Mirrors public.role_permissions. Used for rendering; the database still enforces. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [
    "org.view", "org.manage", "org.audit_logs", "branch.view", "branch.manage",
    "member.view", "member.create", "member.update", "member.archive", "member.export",
    "member.import", "member.notes.view", "member.notes.manage", "staff.view", "staff.manage",
    "attendance.view", "attendance.manage", "event.view", "event.manage", "form.view",
    "form.manage", "department.view", "department.manage", "report.view", "report.export",
    "communication.view", "communication.manage", "followup.view", "followup.manage",
    "visitor.view", "visitor.manage", "task.view", "task.manage", "prayer.view", "prayer.manage",
  ],
  senior_pastor: [
    "org.view", "org.audit_logs", "branch.view", "branch.manage", "member.view", "member.create",
    "member.update", "member.archive", "member.export", "member.import", "member.notes.view",
    "member.notes.manage", "staff.view", "staff.manage", "attendance.view", "attendance.manage",
    "event.view", "event.manage", "form.view", "form.manage", "finance.view", "department.view",
    "department.manage", "report.view", "report.export", "communication.view",
    "communication.manage", "followup.view", "followup.manage", "visitor.view", "visitor.manage",
    "task.view", "task.manage", "prayer.view", "prayer.manage",
  ],
  pastor: [
    "org.view", "branch.view", "member.view", "member.create", "member.update",
    "member.notes.view", "member.notes.manage", "member.export", "staff.view", "attendance.view",
    "attendance.manage", "event.view", "event.manage", "form.view", "form.manage",
    "department.view", "report.view", "communication.view", "followup.view", "followup.manage",
    "visitor.view", "visitor.manage", "task.view", "task.manage", "prayer.view", "prayer.manage",
  ],
  secretary: [
    "org.view", "branch.view", "member.view", "member.create", "member.update", "member.import",
    "member.export", "staff.view", "attendance.view", "attendance.manage", "event.view",
    "event.manage", "form.view", "form.manage", "department.view", "report.view",
    "communication.view", "communication.manage", "task.view", "task.manage", "prayer.view",
    "followup.view", "visitor.view",
  ],
  finance_officer: [
    "org.view", "branch.view", "finance.view", "finance.manage", "member.view", "report.view",
    "report.export", "event.view",
  ],
  department_leader: [
    "org.view", "branch.view", "member.view", "attendance.view", "attendance.manage", "event.view",
    "event.manage", "department.view", "report.view", "communication.view", "task.view",
    "task.manage", "followup.view", "prayer.view", "form.view",
  ],
  followup_officer: [
    "org.view", "branch.view", "member.view", "member.update", "member.notes.view",
    "member.notes.manage", "visitor.view", "visitor.manage", "followup.view", "followup.manage",
    "task.view", "task.manage", "prayer.view", "attendance.view", "report.view",
  ],
  viewer: [
    "org.view", "branch.view", "member.view", "attendance.view", "event.view",
    "department.view", "report.view", "prayer.view", "form.view",
  ],
};

export function can(perms: readonly string[], permission: Permission) {
  return perms.includes(permission);
}

export function canAny(perms: readonly string[], required: Permission[]) {
  return required.some((p) => perms.includes(p));
}
