export interface PasswordRules {
  lengthOk: boolean
  hasNumber: boolean
  hasSpecial: boolean
  match: boolean
}

/**
 * Validate password against security requirements
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 number
 * - At least 1 special character
 * - Passwords must match (for confirmation)
 */
export function passwordRules(password: string, confirm: string): PasswordRules {
  const lengthOk = password.length >= 8
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const match = password.length > 0 && password === confirm

  return { lengthOk, hasNumber, hasSpecial, match }
}

/**
 * Check if all password rules are satisfied
 */
export function isPasswordValid(password: string, confirm: string): boolean {
  const rules = passwordRules(password, confirm)
  return rules.lengthOk && rules.hasNumber && rules.hasSpecial && rules.match
}
