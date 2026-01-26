export function NeutropyMark() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-soft ring-1 ring-black/5">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-zinc-800"
      >
        {/* Neutropy mark: abstract neural/flow symbol */}
        <path
          d="M7 12c0-3 2-5 5-5 2.2 0 4.1 1.1 5 2.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M17 12c0 3-2 5-5 5-2.2 0-4.1-1.1-5-2.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="7" r="1.5" fill="currentColor" />
        <circle cx="12" cy="17" r="1.5" fill="currentColor" />
      </svg>
    </div>
  )
}
