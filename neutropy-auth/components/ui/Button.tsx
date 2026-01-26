import { cn } from "@/components/ui/cn"

interface ButtonProps {
  children: React.ReactNode
  type?: "button" | "submit"
  fullWidth?: boolean
  variant?: "primary" | "ghost"
  disabled?: boolean
  onClick?: () => void
}

export function Button({
  children,
  type = "button",
  fullWidth = false,
  variant = "primary",
  disabled = false,
  onClick
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        fullWidth && "w-full",
        variant === "primary" &&
          "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950",
        variant === "ghost" &&
          "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      {children}
    </button>
  )
}
