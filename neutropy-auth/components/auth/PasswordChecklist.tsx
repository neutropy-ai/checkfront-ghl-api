"use client"

import { cn } from "@/components/ui/cn"

interface ChipProps {
  ok: boolean
  text: string
}

function Chip({ ok, text }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200",
          ok ? "bg-emerald-600 text-white" : "bg-zinc-300 text-white"
        )}
        aria-hidden="true"
      >
        {ok ? "\u2713" : "\u2022"}
      </span>
      {text}
    </span>
  )
}

interface PasswordChecklistProps {
  lengthOk: boolean
  hasSpecial: boolean
  hasNumber: boolean
  match: boolean
}

export function PasswordChecklist({
  lengthOk,
  hasSpecial,
  hasNumber,
  match
}: PasswordChecklistProps) {
  return (
    <div className="mt-5" role="status" aria-live="polite">
      <p className="sr-only">Password requirements status</p>
      <div className="flex flex-wrap gap-2">
        <Chip ok={lengthOk} text="8+ characters" />
        <Chip ok={hasSpecial} text="1 special character" />
        <Chip ok={hasNumber} text="1 number" />
        <Chip ok={match} text="Passwords match" />
      </div>
    </div>
  )
}
