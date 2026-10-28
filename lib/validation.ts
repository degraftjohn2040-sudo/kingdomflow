import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z
  .object({
    fullName: trimmed(120).min(2, "Enter your full name"),
    email: emailSchema,
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const onboardingSchema = z.object({
  name: trimmed(120).min(2, "Enter your church or ministry name"),
  organizationType: z.enum(["church", "fellowship", "ministry", "network", "other"]),
  country: trimmed(80).min(2),
  city: optionalText(80),
  timezone: trimmed(60).min(1),
  currency: trimmed(3).min(3),
  denomination: optionalText(100),
  phone: optionalText(25),
  email: z.union([emailSchema, z.literal("")]).optional(),
  fullName: trimmed(120).min(2, "Enter your full name"),
  branchName: optionalText(120),
  departments: z.string().optional(),
  requestKey: z.string().uuid(),
});

export const memberSchema = z.object({
  first_name: trimmed(80).min(1, "First name is required"),
  last_name: trimmed(80).min(1, "Last name is required"),
  email: z.union([emailSchema, z.literal("")]).optional(),
  phone: optionalText(30),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  marital_status: z.enum(["single", "married", "widowed", "divorced", ""]).optional(),
  date_of_birth: z.union([z.string().date(), z.literal("")]).optional(),
  address: optionalText(240),
  city: optionalText(80),
  branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  status: z.enum(["active", "inactive", "visitor", "transferred"]).default("active"),
  joined_on: z.union([z.string().date(), z.literal("")]).optional(),
});

export const branchSchema = z.object({
  name: trimmed(120).min(2, "Branch name is required"),
  city: optionalText(80),
  address: optionalText(240),
  phone: optionalText(30),
  email: z.union([emailSchema, z.literal("")]).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const departmentSchema = z.object({
  name: trimmed(80).min(2, "Department name is required"),
  type: z.enum(["department", "fellowship", "choir", "outreach", "followup", "prayer", "other"]).default("department"),
  description: optionalText(400),
  branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  leader_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const eventSchema = z
  .object({
    title: trimmed(140).min(2, "Event title is required"),
    description: optionalText(1500),
    type: z.enum(["service", "prayer", "fellowship", "conference", "outreach", "department", "counselling", "other"]),
    start_time: z.string().min(1, "Choose a start time"),
    end_time: z.string().min(1, "Choose an end time"),
    location: optionalText(160),
    branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
    capacity: z.union([z.coerce.number().int().min(1).max(100000), z.literal("")]).optional(),
    status: z.enum(["scheduled", "cancelled", "completed"]).default("scheduled"),
  })
  .refine((data) => new Date(data.end_time) > new Date(data.start_time), {
    message: "End time must be after the start time",
    path: ["end_time"],
  });

export const sessionSchema = z.object({
  title: trimmed(120).min(2, "Give this session a name"),
  session_date: z.string().date(),
  event_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
});

export const contributionSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero").max(100_000_000),
  category: z.enum(["offering", "tithe", "seed", "donation", "pledge", "building_fund", "welfare", "other"]),
  payment_method: z.enum(["cash", "mobile_money", "bank_transfer", "card", "cheque"]).default("cash"),
  given_at: z.string().date(),
  branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  member_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  reference: optionalText(80),
  notes: optionalText(400),
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero").max(100_000_000),
  category: trimmed(80).min(2, "Choose a category"),
  description: trimmed(240).min(2, "Describe the expense"),
  payment_method: z.enum(["cash", "mobile_money", "bank_transfer", "card", "cheque"]).default("cash"),
  incurred_at: z.string().date(),
  branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  reference: optionalText(80),
});

export const visitorSchema = z.object({
  first_name: trimmed(80).min(1, "First name is required"),
  last_name: trimmed(80).min(1, "Last name is required"),
  email: z.union([emailSchema, z.literal("")]).optional(),
  phone: optionalText(30),
  visit_date: z.string().date(),
  branch_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  invited_by: optionalText(120),
  how_heard: optionalText(120),
  consent_given: z.coerce.boolean().default(true),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum([
    "senior_pastor",
    "pastor",
    "admin",
    "secretary",
    "finance_officer",
    "department_leader",
    "followup_officer",
    "viewer",
  ]),
});

export const orgSettingsSchema = z.object({
  name: trimmed(120).min(2, "Organization name is required"),
  description: optionalText(600),
  phone: optionalText(30),
  email: z.union([emailSchema, z.literal("")]).optional(),
  website: optionalText(160),
  address: optionalText(240),
  city: optionalText(80),
  currency: trimmed(3).min(3),
  timezone: trimmed(60).min(1),
});

export const followupSchema = z.object({
  title: trimmed(140).min(2, "Give the follow-up a title"),
  type: z.enum(["visitor", "member", "pastoral", "prayer", "other"]),
  description: optionalText(800),
  assigned_to: z.union([z.string().uuid(), z.literal("")]).optional(),
  member_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: z.union([z.string().date(), z.literal("")]).optional(),
});

export type FieldErrors = Record<string, string>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
