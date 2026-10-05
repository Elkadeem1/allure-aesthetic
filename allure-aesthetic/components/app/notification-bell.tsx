"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function NotificationBell({ userId }: { userId: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(({ count: n }) => setCount(n ?? 0))

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => setCount((c) => c + 1)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <button
      className="relative flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label="الإشعارات"
    >
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute -top-0.5 -start-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none tabular">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}
