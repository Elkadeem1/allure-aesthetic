"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateSlaMinutesAction } from "@/app/(admin)/admin/actions"

interface SettingsAdminProps {
  slaMinutes: number
}

export function SettingsAdmin({ slaMinutes: initial }: SettingsAdminProps) {
  const [sla, setSla] = useState(initial)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await updateSlaMinutesAction(sla)
    setBusy(false)
    if (res.ok) toast.success("تم حفظ الإعدادات")
    else toast.error(res.error)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">الإعدادات</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات SLA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sla">مدة SLA (بالدقايق)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="sla"
                type="number"
                min={1}
                max={120}
                value={sla}
                onChange={(e) => setSla(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                دقيقة (1 — 120)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              المدة اللي لازم الفرع يرد فيها على طلب الحجز قبل ما يتحسب تأخير.
            </p>
          </div>

          <Button onClick={save} loading={busy}>
            حفظ
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
