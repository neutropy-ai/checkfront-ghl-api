import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Neutropy | Sign in",
  description: "Access your Neutropy workspace."
}

/**
 * Auth Layout
 *
 * Provides a consistent, premium visual treatment for authentication pages:
 * - Light background with subtle gradient overlay
 * - Centered card layout
 * - Mobile-responsive padding
 */
export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Subtle gradient overlay for visual depth */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `
            radial-gradient(60% 40% at 50% 0%, rgba(0, 245, 212, 0.08), transparent 60%),
            radial-gradient(60% 40% at 80% 20%, rgba(0, 153, 255, 0.06), transparent 60%)
          `
        }}
        aria-hidden="true"
      />

      {/* Main content area */}
      <main className="relative mx-auto flex min-h-screen max-w-[1080px] items-center justify-center px-4 py-10 sm:py-16">
        {children}
      </main>
    </div>
  )
}
