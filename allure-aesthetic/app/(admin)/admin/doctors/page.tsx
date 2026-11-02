import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  DoctorsAdmin,
  type DoctorRow,
  type AdminBranch,
  type MenArea,
} from "@/components/admin/doctors-admin"
import type { ScheduleEntry, ShiftKindValue } from "@/lib/admin/doctor-schema"

export default async function AdminDoctorsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [doctorsRes, branchesRes, roomsRes, schedulesRes, doctorRoomsRes, cutoffsRes, menAreasRes] =
    await Promise.all([
      supabase
        .from("doctors")
        .select(
          "id, branch_id, display_name, specialty, notes, person_key, always_open, accepts_men, laser_men_allowed, men_laser_area_codes, rejects_small_areas_only, no_overlap, is_active, sort"
        )
        .order("sort"),
      supabase.from("branches").select("id, name_ar, sort").order("sort"),
      supabase.from("rooms").select("id, branch_id, title, sort, is_active").order("sort"),
      supabase.from("doctor_schedules").select("doctor_id, weekday, start_time, end_time, kind"),
      supabase.from("doctor_rooms").select("doctor_id, weekday, room_id"),
      supabase.from("doctor_laser_cutoffs").select("doctor_id, weekday, cutoff"),
      supabase.from("laser_areas").select("code, name_en").eq("gender", "male").order("sort"),
    ])

  const branches: AdminBranch[] = (branchesRes.data ?? []).map((b) => ({
    id: b.id,
    nameAr: b.name_ar,
    sort: b.sort,
    rooms: (roomsRes.data ?? [])
      .filter((r) => r.branch_id === b.id && r.is_active)
      .map((r) => ({ id: r.id, title: r.title })),
  }))

  const doctors: DoctorRow[] = (doctorsRes.data ?? []).map((d) => ({
    id: d.id,
    branchId: d.branch_id,
    displayName: d.display_name,
    specialty: d.specialty,
    notes: d.notes,
    personKey: d.person_key,
    alwaysOpen: d.always_open,
    acceptsMen: d.accepts_men,
    laserMenAllowed: d.laser_men_allowed,
    menLaserAreaCodes: d.men_laser_area_codes,
    rejectsSmallAreasOnly: d.rejects_small_areas_only,
    noOverlap: d.no_overlap,
    isActive: d.is_active,
  }))

  const schedules: Record<string, ScheduleEntry[]> = {}
  for (const s of schedulesRes.data ?? []) {
    ;(schedules[s.doctor_id] ??= []).push({
      weekday: s.weekday,
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
      kind: s.kind as ShiftKindValue,
    })
  }

  const doctorRooms: Record<string, { weekday: number; roomId: string }[]> = {}
  for (const r of doctorRoomsRes.data ?? []) {
    ;(doctorRooms[r.doctor_id] ??= []).push({ weekday: r.weekday, roomId: r.room_id })
  }

  const laserCutoffs: Record<string, { weekday: number; cutoff: string }[]> = {}
  for (const c of cutoffsRes.data ?? []) {
    ;(laserCutoffs[c.doctor_id] ??= []).push({ weekday: c.weekday, cutoff: c.cutoff })
  }

  const menAreas: MenArea[] = (menAreasRes.data ?? []).map((a) => ({ code: a.code, nameEn: a.name_en }))

  return (
    <DoctorsAdmin
      doctors={doctors}
      branches={branches}
      schedules={schedules}
      doctorRooms={doctorRooms}
      laserCutoffs={laserCutoffs}
      menAreas={menAreas}
    />
  )
}
