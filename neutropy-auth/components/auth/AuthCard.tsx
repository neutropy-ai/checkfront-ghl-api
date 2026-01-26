import { Card } from "@/components/ui/Card"
import { NeutropyMark } from "@/components/NeutropyMark"

interface AuthCardProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Card className="w-full max-w-[520px] p-8 sm:p-10">
      <div className="flex flex-col items-center text-center">
        <NeutropyMark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-600">
          {subtitle}
        </p>
      </div>

      <div className="mt-8">{children}</div>
    </Card>
  )
}
