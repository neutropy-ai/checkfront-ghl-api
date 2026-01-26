import { z } from "zod"

/**
 * Signup form validation schema
 *
 * Note: Password fields are optional because:
 * - Mode A: Don't collect passwords (HighLevel handles authentication)
 * - Mode B: Don't collect passwords (IdP handles authentication)
 *
 * Only enable password collection if you have a specific use case.
 */
export const signupSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(80, "First name is too long")
    .trim(),

  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(80, "Last name is too long")
    .trim(),

  email: z
    .string()
    .email("Please enter a valid email address")
    .max(254, "Email is too long")
    .toLowerCase()
    .trim(),

  // Optional: Only validated if password fields are enabled
  password: z.string().optional(),
  confirmPassword: z.string().optional()
})

export type SignupInput = z.infer<typeof signupSchema>

/**
 * Login form validation schema (for Mode B IdP flow)
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(254, "Email is too long")
    .toLowerCase()
    .trim()
})

export type LoginInput = z.infer<typeof loginSchema>
