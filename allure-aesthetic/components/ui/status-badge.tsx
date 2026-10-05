import { cn } from "cn"

type TicketStatus = "confirmed" | "open" | "request" | "notice" | "breach"

const CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; pulse?: boolean }> = {
  confirmed: { label: "مؤكد",  bg: "var(--status-confirmed-bg)",  text: "var(--status-confirmed)" },
  open:      { label: "مفتوح", bg: "var(--status-open-bg)",       text: "var(--status-open)" },
  request:   { label: "طلب",   bg: "var(--status-request-bg)",    text: "var(--status-request)" },
  notice:    { label: "إشعار", bg: "var(--status-notice-bg)",     text: "var(--status-notice)" },
  breach:    { label: "تعدّى SLA", bg: "var(--status-breach-bg)", text: "var(--status-breach)", pulse: true },
}

interface StatusBadgeProps {
  status: TicketStatus
  className?: string
  label?: string
}

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const cfg = CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        cfg.pulse && "animate-sla-pulse",
        className
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span
        className="inline-block size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.text }}
      />
      {label ?? cfg.label}
    </span>
  )
}
