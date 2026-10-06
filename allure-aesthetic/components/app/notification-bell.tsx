"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Bell, CheckCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"
import type { Database, AppRole } from "@/lib/types/database.types"

type Notification = Database["public"]["Tables"]["notifications"]["Row"]

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "دلوقتي"
  if (min < 60) return `منذ ${min} د`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `منذ ${hr} س`
  return `منذ ${Math.floor(hr / 24)} ي`
}

export function NotificationBell({
  userId,
  role,
}: {
  userId: string
  role: AppRole
}) {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Unread count + realtime
  useEffect(() => {
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(({ count: n }) => setCount(n ?? 0))

    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => setCount((c) => c + 1),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
    setItems(data ?? [])
    setLoading(false)
  }, [supabase, userId])

  // Fetch on open
  useEffect(() => {
    if (open) fetchItems()
  }, [open, fetchItems])

  // Click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
      ),
    )
    setCount((c) => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null)
    setItems((prev) =>
      prev.map((n) => ({
        ...n,
        read_at: n.read_at ?? new Date().toISOString(),
      })),
    )
    setCount(0)
  }

  const handleClick = (n: Notification) => {
    if (!n.read_at) markRead(n.id)
    const path = role === "branch" ? "/branch" : "/dashboard/tickets"
    router.push(path)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
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

      {open && (
        <div className="absolute top-full mt-2 end-0 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
            <span className="text-sm font-semibold text-foreground">
              الإشعارات
            </span>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
              >
                <CheckCheck size={14} />
                تعليم الكل كمقروء
              </button>
            )}
          </div>

          {/* Items */}
          {loading && items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              جاري التحميل...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              مفيش إشعارات
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-start px-4 py-3 hover:bg-muted transition-colors flex items-start gap-3",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    {!n.read_at && (
                      <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", n.read_at && "ps-5")}>
                      <p className="text-sm font-medium text-foreground truncate">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
