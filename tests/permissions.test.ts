import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, can, canAny, type Permission, type Role } from "@/lib/permissions";

const READ_ONLY: Permission[] = [
  "org.view",
  "branch.view",
  "member.view",
  "attendance.view",
  "event.view",
  "department.view",
  "report.view",
  "prayer.view",
  "form.view",
];

describe("role/permission matrix", () => {
  it("defines permissions for every role and no unknown permission", () => {
    const catalog = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role], `missing matrix for ${role}`).toBeDefined();
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(catalog.has(permission), `${role} grants unknown permission ${permission}`).toBe(true);
      }
    }
  });

  it("gives the owner every permission", () => {
    expect(new Set(ROLE_PERMISSIONS.owner)).toEqual(new Set(PERMISSIONS));
  });

  it("keeps the viewer read-only", () => {
    for (const permission of ROLE_PERMISSIONS.viewer) {
      expect(READ_ONLY, `viewer should not hold ${permission}`).toContain(permission);
    }
  });

  it("never lets an administrator or secretary see money or pastoral notes", () => {
    for (const role of ["admin", "secretary"] as Role[]) {
      expect(can(ROLE_PERMISSIONS[role], "finance.view")).toBe(false);
      expect(can(ROLE_PERMISSIONS[role], "finance.manage")).toBe(false);
    }
  });

  it("gives finance officers money but not member editing or staff management", () => {
    expect(can(ROLE_PERMISSIONS.finance_officer, "finance.manage")).toBe(true);
    expect(can(ROLE_PERMISSIONS.finance_officer, "member.update")).toBe(false);
    expect(can(ROLE_PERMISSIONS.finance_officer, "staff.manage")).toBe(false);
    expect(can(ROLE_PERMISSIONS.finance_officer, "member.notes.view")).toBe(false);
  });

  it("separates viewing pastoral notes from editing members", () => {
    expect(can(ROLE_PERMISSIONS.pastor, "member.notes.view")).toBe(true);
    expect(can(ROLE_PERMISSIONS.secretary, "member.notes.view")).toBe(false);
    expect(can(ROLE_PERMISSIONS.viewer, "member.notes.view")).toBe(false);
  });

  it("keeps audit logs to owner, admin and senior pastor only", () => {
    const withAudit = ROLES.filter((role) => can(ROLE_PERMISSIONS[role], "org.audit_logs"));
    expect(withAudit.sort()).toEqual(["admin", "owner", "senior_pastor"]);
  });

  it("only the owner can change the plan", () => {
    const withPlan = ROLES.filter((role) => can(ROLE_PERMISSIONS[role], "plan.manage"));
    expect(withPlan).toEqual(["owner"]);
  });

  it("every staff-facing role can reach at least the dashboard", () => {
    for (const role of ROLES) {
      expect(canAny(ROLE_PERMISSIONS[role], ["org.view"])).toBe(true);
    }
  });
});
