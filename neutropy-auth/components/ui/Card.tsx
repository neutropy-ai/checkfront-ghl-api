import { cn } from "@/components/ui/cn"

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-soft ring-1 ring-black/5",
        className
      )}
    >
      {children}
    </div>
  )
}
