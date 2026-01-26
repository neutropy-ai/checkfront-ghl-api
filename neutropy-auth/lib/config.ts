export type AuthMode = "A" | "B"
export type SignupStrategy = "manual" | "highlevel"

/**
 * Application configuration
 *
 * Mode A: Whitelabel redirect - Users are redirected to HighLevel's hosted login
 * Mode B: OIDC SSO - Users authenticate via IdP, then land in HighLevel seamlessly
 */
export const config = {
  /**
   * Authentication mode
   * - "A": Redirect to HighLevel whitelabel login (simplest, recommended for quick launch)
   * - "B": OIDC SSO via Auth0/Okta/Entra (best UX, requires IdP + HighLevel SSO setup)
   */
  authMode: (process.env.NEXT_PUBLIC_AUTH_MODE ?? "A") as AuthMode,

  /**
   * HighLevel whitelabel app URL
   * This is where users will be redirected after authentication
   */
  ghlAppUrl: process.env.NEXT_PUBLIC_GHL_APP_URL ?? "https://app.neutropy.ai",

  /**
   * Forgot password destination
   * - Mode A: Usually HighLevel-hosted reset flow on your whitelabel domain
   * - Mode B: IdP-managed reset flow (recommended to point to your IdP hosted reset URL)
   *
   * VERIFY: Check the exact reset URL for your HighLevel whitelabel setup
   */
  forgotPasswordUrl:
    process.env.NEXT_PUBLIC_FORGOT_PASSWORD_URL ?? "https://app.neutropy.ai",

  /**
   * Enable password fields on create-account page
   *
   * Recommended: Keep this false for most setups
   * - Mode A: Don't collect passwords (HighLevel handles auth)
   * - Mode B: Don't collect passwords (IdP handles auth)
   *
   * Only enable if you have a specific use case that requires collecting passwords
   */
  enablePasswordFields:
    process.env.NEXT_PUBLIC_ENABLE_PASSWORD_FIELDS === "true",

  /**
   * Signup strategy
   * - "manual": Send signup data to webhook for manual processing (safer)
   * - "highlevel": Automated provisioning via HighLevel API (requires verification)
   */
  signupStrategy: (process.env.NEXT_PUBLIC_SIGNUP_STRATEGY ??
    "manual") as SignupStrategy
} as const
