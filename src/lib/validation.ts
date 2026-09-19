import { z } from 'zod';
export const email = z.email().max(254).trim();
export const password = z.string().min(12, 'Use at least 12 characters.').max(128);
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const registerSchema = z.object({ email, password });
export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  organization_type: z.enum(['church', 'ministry', 'fellowship', 'campus', 'network', 'other']),
  country: z.string().trim().min(2).max(100),
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid IANA timezone, such as Africa/Accra.'),
  email: z.union([email, z.literal('')]),
  phone: z
    .string()
    .max(40)
    .regex(/^[+\d\s().-]*$/, 'Enter a valid phone number.'),
  administrator_name: z.string().trim().min(2).max(150),
});
export const uuid = z.uuid();
export type ActionResult = { error?: string; success?: string; id?: string };
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Operation Failed. Please try again.';
}
export function databaseError(code?: string): string {
  if (code === '42501')
    return 'Permission Required: your role or subscription does not allow this operation.';
  if (code === '23505') return 'A record with these unique details already exists.';
  if (code === '23503') return 'The linked record is unavailable or belongs to another workspace.';
  if (code === '23514' || code === '22007' || code === '22008')
    return 'Validation failed. Check the values and dates you entered.';
  if (code === 'PGRST116') return 'Record not found or you no longer have access.';
  return 'Operation Failed. Check the database configuration or try again.';
}
