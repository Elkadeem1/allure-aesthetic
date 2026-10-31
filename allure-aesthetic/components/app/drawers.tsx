"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Drawer } from "./drawer"
import { BookingWizard } from "@/components/wizard/booking-wizard"
import { RecommendDrawer } from "./recommend-drawer"
import { ChatDrawer } from "./chat-drawer"
import { SoftSkillsDrawer } from "./soft-skills-drawer"
import { getBookingData } from "@/app/(agent)/dashboard/book/actions"
import { getAssistData, getManualData, type AssistData, type ManualData } from "@/app/(agent)/dashboard/assist-actions"
import type { BookingData } from "@/lib/booking/data"

export type DrawerId = "booking" | "recommend" | "chat" | "skills"

type DrawerCtx = {
  openId: DrawerId | null
  open: (id: DrawerId) => void
  close: () => void
  canBook: boolean
}

const Ctx = createContext<DrawerCtx | null>(null)

export function useDrawers(): DrawerCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useDrawers must be used inside <DrawerProvider>")
  return v
}

const DRAWER_META: Record<DrawerId, { title: string; side: "start" | "end" }> = {
  booking: { title: "حجز جديد", side: "end" },
  recommend: { title: "مين يرشّح إيه", side: "end" },
  chat: { title: "ردود الشات", side: "end" },
  skills: { title: "Soft Skills", side: "start" },
}

export function DrawerProvider({
  canBook,
  children,
}: {
  canBook: boolean
  children: React.ReactNode
}) {
  const [openId, setOpenId] = useState<DrawerId | null>(null)
  const pathname = usePathname()

  const open = useCallback(
    (id: DrawerId) => {
      if (id === "booking" && !canBook) return
      setOpenId(id)
    },
    [canBook]
  )
  const close = useCallback(() => setOpenId(null), [])

  // Close whenever the route changes (e.g. after a ticket is registered).
  useEffect(() => {
    setOpenId(null)
  }, [pathname])

  // Ctrl/Cmd+B opens the booking drawer.
  useEffect(() => {
    if (!canBook) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault()
        setOpenId((cur) => (cur === "booking" ? cur : "booking"))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [canBook])

  const value = useMemo(() => ({ openId, open, close, canBook }), [openId, open, close, canBook])

  const meta = openId ? DRAWER_META[openId] : null

  return (
    <Ctx.Provider value={value}>
      {children}
      <Drawer open={!!openId} onClose={close} side={meta?.side ?? "end"} title={meta?.title ?? ""} wide={openId === "skills"}>
        {openId === "booking" && <BookingDrawerBody />}
        {openId === "recommend" && <AssistBody kind="recommend" />}
        {openId === "chat" && <AssistBody kind="chat" />}
        {openId === "skills" && <SkillsBody />}
      </Drawer>
    </Ctx.Provider>
  )
}

/* ---------- booking drawer body (lazy data) ---------- */

function BookingDrawerBody() {
  const [data, setData] = useState<BookingData | null>(null)
  const [error, setError] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    getBookingData()
      .then(setData)
      .catch(() => setError(true))
  }, [])

  const initialBranchId = useMemo(() => {
    try {
      return localStorage.getItem("allure.lastBranchId") ?? undefined
    } catch {
      return undefined
    }
  }, [])

  if (error) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        حصل خطأ في تحميل البيانات — جرّب تاني أو افتح صفحة الحجز.
      </p>
    )
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">بنحمّل بيانات الفروع…</span>
      </div>
    )
  }
  return <BookingWizard data={data} initialBranchId={initialBranchId} layout="drawer" />
}

/* ---------- recommend / chat drawer bodies (lazy data) ---------- */

function AssistBody({ kind }: { kind: "recommend" | "chat" }) {
  const [data, setData] = useState<AssistData | null>(null)
  const [error, setError] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    getAssistData()
      .then(setData)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return <p className="text-sm text-muted-foreground py-10 text-center">حصل خطأ في التحميل — جرّب تاني.</p>
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">بنحمّل البيانات…</span>
      </div>
    )
  }
  return kind === "recommend" ? (
    <RecommendDrawer guide={data.guide} />
  ) : (
    <ChatDrawer branches={data.branches} flow={data.flow} situations={data.situations} />
  )
}

/* ---------- soft skills drawer body (lazy data) ---------- */

function SkillsBody() {
  const [data, setData] = useState<ManualData | null>(null)
  const [error, setError] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    getManualData()
      .then(setData)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return <p className="text-sm text-muted-foreground py-10 text-center">حصل خطأ في التحميل — جرّب تاني.</p>
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">بنحمّل الدليل…</span>
      </div>
    )
  }
  return <SoftSkillsDrawer manual={data} />
}
