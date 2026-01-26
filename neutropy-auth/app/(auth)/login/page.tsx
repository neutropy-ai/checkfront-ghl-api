"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { AuthCard } from "@/components/auth/AuthCard"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { config } from "@/lib/config"

/**
 * Login Page
 *
 * Supports two authentication modes:
 *
 * Mode A (Whitelabel Redirect):
 * - Displays Neutropy-branded UI
 * - Redirects user to HighLevel whitelabel login at app.neutropy.ai
 * - Simplest and safest approach
 *
 * Mode B (OIDC SSO):
 * - Authenticates via IdP (Auth0/Okta/Entra) using Auth.js
 * - After IdP login, redirects to HighLevel whitelabel domain
 * - Best UX (seamless single sign-on)
 */
export default function LoginPage() {
  const mode = config.authMode
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const subtitle =
    mode === "A"
      ? "You'll continue to the secure Neutropy portal to sign in."
      : "Sign in with your organization's SSO to continue."

  async function handleContinue() {
    // Mode A: Direct redirect to HighLevel whitelabel login
    if (mode === "A") {
      window.location.assign(config.ghlAppUrl)
      return
    }

    // Mode B: Authenticate via IdP, then redirect to HighLevel
    setLoading(true)
    try {
      await signIn(undefined, { callbackUrl: config.ghlAppUrl })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Sign in" subtitle={subtitle}>
      <div className="grid gap-5">
        {/* Email field - informational in Mode A, used for IdP routing in Mode B */}
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />

        {/* Password field - display only, authentication happens elsewhere */}
        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            disabled={true}
            autoComplete="current-password"
          />
          <p className="mt-2 text-xs text-zinc-500">
            {mode === "A"
              ? "You'll enter your password on the secure Neutropy portal."
              : "Password entry is handled by your SSO provider."}
          </p>
        </div>

        {/* Forgot password link */}
        <div className="flex items-center justify-end">
          <a
            href={config.forgotPasswordUrl}
            className="text-sm text-zinc-600 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900"
          >
            Forgot password?
          </a>
        </div>

        {/* Primary CTA */}
        <Button
          fullWidth
          variant="primary"
          onClick={handleContinue}
          disabled={loading}
        >
          {loading ? "Continuing..." : "Continue"}
        </Button>

        {/* Create account link */}
        <p className="text-center text-sm text-zinc-600">
          New here?{" "}
          <a
            href="/create-account"
            className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-700"
          >
            Create an account
          </a>
        </p>
      </div>
    </AuthCard>
  )
}
