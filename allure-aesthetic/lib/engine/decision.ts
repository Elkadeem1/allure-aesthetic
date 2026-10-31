// =====================================================================
// Booking decision — Dentolize status + per-branch guidance.
//
// A FAITHFUL port of decide() in docs/mvp/agent-hub-2026-10.html (second
// <script>). It produces the status the agent sets in Dentolize
// (Open / Confirmed), an optional status note, and the branch-specific
// steps / info / warns copy. It also tells the UI whether an Innova ticket
// is in play (ticket: "innova_ticket" | "none").
//
// Status model (mirrors the HTML):
//   * always-open doctor (doctors.always_open)        -> Open
//   * an open_slot update for the doctor on that date -> Confirmed
//   * tanta1 on Saturday (Open doctor)                -> Confirmed ("بنأكده إحنا")
//   * otherwise: today/tomorrow -> Confirmed, later   -> Open
//
// For Innova (the only branch with has_tickets) the server RPC
// create_ticket / resolve_ticket_kind remains the single source of truth;
// `ticket` here only gates whether the wizard shows the ticket flow.
// =====================================================================

import type { DentolizeStatus, Doctor, DoctorUpdate } from "./types"
import { updateApplies } from "./availability"
import { dayDiff, weekdaySat0 } from "./time"

export type DecisionTicket = "innova_ticket" | "none"

export type Decision = {
  status: DentolizeStatus
  statusNote: string
  steps: string[]
  info: string[]
  warns: string[]
  ticket: DecisionTicket
}

export type DecideArgs = {
  branchCode: string
  hasTickets: boolean
  doctor: Doctor
  serviceCode: string
  date: string
  today: string
  updates: DoctorUpdate[] // this doctor's rows + branch-wide rows
}

// What goes in the WhatsApp / group message, referenced by the steps copy.
const DATA_TXT =
  "بالبيانات كاملة (اسم ورقم العميل، الخدمة والمناطق، الدكتورة، التاريخ والوقت)"

// Shebin doctors for whom same-day booking is explicitly fine (HTML list).
const SHEBIN_SAME_DAY_OK = ["zainabeldaly", "ayaelgarwany", "mahitabsabry", "marinasalah"]

export function decide(args: DecideArgs): Decision {
  const { branchCode: bk, hasTickets, doctor: d, serviceCode, date, today, updates } = args
  const diff = dayDiff(date, today)
  const when: "today" | "tomorrow" | "later" = diff <= 0 ? "today" : diff === 1 ? "tomorrow" : "later"
  const isSaturday = weekdaySat0(date) === 0

  // today/tomorrow = Confirmed, later = Open — unless the doctor is always Open.
  let status: DentolizeStatus = d.alwaysOpen ? "Open" : when === "later" ? "Open" : "Confirmed"
  let statusNote = ""
  const steps: string[] = []
  const info: string[] = []
  const warns: string[] = []

  // "الدور فاضي" (open_slot): the branch told us to book Confirmed instead of Open.
  const openSlot = updates.find(
    (u) => u.doctorId === d.id && u.type === "open_slot" && updateApplies(u, date)
  )
  if (openSlot && status === "Open") {
    status = "Confirmed"
    statusNote = openSlot.note || "الفرع بلّغ إن الدور فاضي"
    info.push("الحجز اتحول لـ Confirmed مباشرة لأن الفرع بلّغ إن الدور فاضي.")
  }

  if (bk === "tanta1") {
    if (status === "Open" && isSaturday) {
      status = "Confirmed"
      statusNote = "السبت بنأكده إحنا"
      steps.push("احجز في السيستم بحالة Confirmed (السبت بنأكده لأن الفرع إجازة الجمعة)")
      steps.push("ابعت للفرع Notice " + DATA_TXT + " علشان هم كمان يأكدوا")
      info.push("الفرع بيبعت يوم الخميس بالليل المواعيد المتاحة يوم السبت.")
    } else if (status === "Open") {
      steps.push("احجز في السيستم بحالة Open")
      steps.push("ابعت الحجز للفرع " + DATA_TXT + " — اتأكد إمتى وهتعمل أريا إيه")
      steps.push("استنى الفرع يأكد المعاد")
      info.push("لو الدكتورة هي اللي طلبت إننا نأكد المعاد، بنأكد إحنا.")
    } else {
      steps.push("احجز في السيستم بحالة Confirmed")
      steps.push("ابعت للفرع Notice فقط " + DATA_TXT + " — من غير ما تستنى تأكيد منهم")
    }
    info.push("لما الحجز بيتقفل بيتبعت Update بالحالة دي.")
    if (serviceCode !== "laser" && serviceCode !== "consult") {
      info.push(
        "أي سيرفيس غير الليزر أو الكشوفات بيتبعت للفرع حتى لو الحجز مقفول، وإحنا بنكلم العميلة."
      )
    }
  } else if (bk === "tanta2") {
    if (when === "today") {
      statusNote = "بعد موافقة الفرع على الجروب"
      steps.push("ابعت بيانات الحالة على الجروب " + DATA_TXT)
      steps.push(
        "استنى رد الفرع: لو متاح كلّم العميلة واحجز Confirmed، ولو مش متاح أجّل معادها ليوم تاني"
      )
    } else if (status === "Open") {
      steps.push("احجز في السيستم بحالة Open")
      steps.push("ابعت بيانات الحجز للفرع على الواتساب " + DATA_TXT)
      steps.push("الـ Confirm بنعمله إحنا مع العميلة من غير ما نستنى الفرع")
    } else {
      steps.push("احجز في السيستم بحالة Confirmed من غير ما تستنى الفرع")
      steps.push("ابعت بيانات الحجز للفرع على الواتساب " + DATA_TXT)
    }
    info.push(
      "لو العميلة عايزة الدكتورة دي واليوم كومبليت: ابعتها على الجروب أو اعرض يوم تاني الدكتورة موجودة فيه — ما ترشحش دكتورة تانية إلا لو العميلة اختارتها."
    )
  } else if (bk === "newcairo") {
    warns.push(
      "مواعيد الدكاترة والأسعار في القاهرة الجديدة مختلفة عن باقي الفروع وبتتحدث دوريًا — اتأكد منها كل مرة."
    )
    if (status === "Open") {
      steps.push("ابعت الحجز بحالة Open " + DATA_TXT)
      steps.push("الـ Confirm بنعمله إحنا من عندنا (الكول سنتر)")
    } else {
      steps.push("احجز في السيستم بحالة Confirmed")
      steps.push("ابعت الحالة على الجروب " + DATA_TXT + " وإيه استفسارها")
    }
    info.push("كل الدكاترة بيشتغلوا للرجالة عادي.")
  } else if (bk === "shebin") {
    steps.push("احجز في السيستم بحالة " + status)
    steps.push("ابعت بيانات الحالة للفرع " + DATA_TXT)
    warns.push(
      "ما تعملش أوفر لاب في الحجز — لو لازم يبقى من خلال الفرع: ابعت Open ببيانات الحالة وهيتم التواصل من الفرع."
    )
    if (d.noOverlap) {
      warns.push(
        "الدكتورة دي بالذات ما بنعملش معاها أوفر لاب حتى لو السيستم مليان (بتاخد وقتها في السيشن)."
      )
    }
    if (when === "today" && SHEBIN_SAME_DAY_OK.includes(d.code)) {
      info.push("الحجز في نفس اليوم مفيش فيه مشكلة، إلا لو الفرع بلّغ إن الدكتورة هتمشي بدري.")
    }
    info.push("مواعيد الدكاترة ثابتة، وأي Update (دكتورة بتغطي أو إجازة من اليوم) بيتبلّغ بيه.")
  } else if (bk === "innova") {
    steps.push("احجز في السيستم بحالة " + status)
    steps.push("ابعت بيانات الحجز للفرع " + DATA_TXT)
    info.push("في إينوفا بنحجز بحالة Open، إلا لو الفرع طلب نعمل Confirmed.")
    if (serviceCode === "consult") {
      info.push(
        "Re Cons مجانية لو خلال شهر من الكشف، وبعد الشهر بتتحاسب بسعر الاستشارة العادية."
      )
    }
  } else {
    steps.push("احجز في السيستم بحالة " + status)
    steps.push("ابعت بيانات الحجز للفرع " + DATA_TXT)
    info.push("قواعد الإرسال الخاصة بالفرع ده لسه ما اتحددتش — ده الشكل العام لحد ما نعتمدها.")
  }

  const ticket: DecisionTicket =
    hasTickets && (when === "today" || when === "tomorrow") ? "innova_ticket" : "none"

  return { status, statusNote, steps, info, warns, ticket }
}
