"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { passwordRules } from "@/lib/password"
import { PasswordChecklist } from "@/components/auth/PasswordChecklist"

interface PasswordFieldsProps {
  enabled: boolean
  password: string
  confirm: string
  onPassword: (value: string) => void
  onConfirm: (value: string) => void
}

export function PasswordFields({
  enabled,
  password,
  confirm,
  onPassword,
  onConfirm
}: PasswordFieldsProps) {
  const [showPassword, setShowPassword] = useState(false)

  const rules = useMemo(
    () => passwordRules(password, confirm),
    [password, confirm]
  )

  if (!enabled) return null

  return (
    <div className="mt-4 space-y-4">
      <div className="relative">
        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Create a strong password"
          value={password}
          onChange={onPassword}
          autoComplete="new-password"
        />
        <div className="absolute right-1 top-[30px]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? "Hide" : "Show"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Input
          label="Confirm Password"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          placeholder="Confirm your password"
          value={confirm}
          onChange={onConfirm}
          autoComplete="new-password"
        />
      </div>

      <PasswordChecklist
        lengthOk={rules.lengthOk}
        hasNumber={rules.hasNumber}
        hasSpecial={rules.hasSpecial}
        match={rules.match}
      />
    </div>
  )
}
