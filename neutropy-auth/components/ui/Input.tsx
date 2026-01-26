"use client"

import { useId } from "react"
import { cn } from "@/components/ui/cn"

interface InputProps {
  label: string
  name: string
  type?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  error?: string
  autoComplete?: string
}

export function Input({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  error,
  autoComplete
}: InputProps) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-800"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn(
          "w-full rounded-xl border bg-white px-4 py-3 text-sm text-zinc-900",
          "shadow-sm outline-none transition-all duration-200",
          "placeholder:text-zinc-400",
          "focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10",
          "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500",
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-500/15"
            : "border-zinc-200"
        )}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
