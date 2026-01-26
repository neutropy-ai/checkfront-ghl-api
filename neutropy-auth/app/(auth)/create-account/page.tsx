"use client"

import { useMemo, useState } from "react"
import { AuthCard } from "@/components/auth/AuthCard"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { PasswordFields } from "@/components/auth/PasswordFields"
import { config } from "@/lib/config"
import { passwordRules } from "@/lib/password"

interface FormStatus {
  ok: boolean
  message: string
}

/**
 * Create Account Page
 *
 * Collects user information for account provisioning.
 *
 * Two onboarding strategies are supported:
 *
 * Option 1 (Manual - Recommended):
 * - Collects name and email
 * - Sends to webhook (Zapier/Make/n8n) for manual processing
 * - Admin creates user in HighLevel and sends invite
 *
 * Option 2 (Automated):
 * - Collects name and email
 * - Automatically provisions sub-account and user via HighLevel API
 * - Requires verified API endpoints and Agency Pro plan
 *
 * Note: Password fields are optional and disabled by default.
 * Authentication is handled by HighLevel (Mode A) or IdP (Mode B).
 */
export default function CreateAccountPage() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<FormStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const rules = useMemo(
    () => passwordRules(password, confirmPassword),
    [password, confirmPassword]
  )

  const subtitle =
    config.signupStrategy === "manual"
      ? "Create an account request. We'll set up your workspace and send an invite."
      : "Create your account. We'll provision your workspace automatically."

  async function handleSubmit() {
    setStatus(null)
    setLoading(true)

    try {
      // Validate required fields
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        setStatus({ ok: false, message: "Please fill in all required fields." })
        return
      }

      // Validate password if fields are enabled
      if (config.enablePasswordFields) {
        const allRulesOk =
          rules.lengthOk && rules.hasNumber && rules.hasSpecial && rules.match
        if (!allRulesOk) {
          setStatus({
            ok: false,
            message: "Please meet all password requirements."
          })
          return
        }
      }

      // Build request body
      const body: Record<string, string> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim()
      }

      if (config.enablePasswordFields && password) {
        body.password = password
        body.confirmPassword = confirmPassword
      }

      // Submit to API
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to create account")
      }

      setStatus({
        ok: true,
        message: data.message ?? "Account request submitted successfully!"
      })

      // Clear form on success
      setFirstName("")
      setLastName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong"
      setStatus({ ok: false, message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Create an account" subtitle={subtitle}>
      <div className="grid gap-5">
        {/* Name fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            required
          />
          <Input
            label="Last name"
            name="lastName"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            required
          />
        </div>

        {/* Email field */}
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />

        {/* Password fields (optional, disabled by default) */}
        <PasswordFields
          enabled={config.enablePasswordFields}
          password={password}
          confirm={confirmPassword}
          onPassword={setPassword}
          onConfirm={setConfirmPassword}
        />

        {/* Status message */}
        {status && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              status.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            role="status"
            aria-live="polite"
          >
            {status.message}
          </div>
        )}

        {/* Submit button */}
        <Button
          fullWidth
          variant="primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Submitting..." : "Get Started Today"}
        </Button>

        {/* Sign in link */}
        <p className="text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-700"
          >
            Sign in here
          </a>
        </p>

        {/* Security note */}
        <p className="text-center text-xs text-zinc-500">
          {config.enablePasswordFields
            ? "Passwords are never sent to HighLevel from this page. Authentication is via SSO or HighLevel-hosted login."
            : "You'll set your access credentials securely via invite or SSO."}
        </p>
      </div>
    </AuthCard>
  )
}
