/**
 * Supabase database types for Allure Aesthetic.
 * Regenerate with: supabase gen types typescript --project-id <ref> > lib/types/database.types.ts
 */

export type AppRole = "admin" | "supervisor" | "agent" | "branch"
export type TicketKind = "request" | "notice"
export type TicketStatus = "pending" | "answered" | "closed" | "cancelled"
export type BranchResponse = "agent_confirm" | "branch_confirm" | "counter_offer" | "unavailable"
export type TicketOutcome =
  | "customer_confirmed"
  | "customer_declined"
  | "no_answer"
  | "handled_by_branch"
  | "notice_acknowledged"
export type ClientGender = "female" | "male"
export type BookingStatus = "open" | "confirmed"
export type ConsultationKind = "derma" | "hair" | "derma_hair" | "recons" | "pulse"
export type UpdateType = "off" | "stop" | "hours" | "open_slot" | "force_open" | "note"
export type ShiftKind = "all" | "laser" | "other" | "derma"

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string
          code: string
          name_ar: string
          address: string | null
          payment_methods: string[]
          managers: string[]
          price_list_id: string | null
          is_active: boolean
          sort: number
          created_at: string
          updated_at: string
        }
        Insert: {
          code: string
          name_ar: string
          address?: string | null
          payment_methods?: string[]
          managers?: string[]
          price_list_id?: string | null
          is_active?: boolean
          sort?: number
        }
        Update: {
          code?: string
          name_ar?: string
          address?: string | null
          payment_methods?: string[]
          managers?: string[]
          price_list_id?: string | null
          is_active?: boolean
          sort?: number
        }
        Relationships: Rel[]
      }
      branch_policies: {
        Row: {
          branch_id: string
          request_window_days: number
          same_day_always_request: boolean
          auto_confirm_weekdays: number[]
          allow_overlap: boolean
          booking_rules: string[]
          updated_at: string
        }
        Insert: {
          branch_id: string
          request_window_days?: number
          same_day_always_request?: boolean
          auto_confirm_weekdays?: number[]
          allow_overlap?: boolean
          booking_rules?: string[]
        }
        Update: {
          request_window_days?: number
          same_day_always_request?: boolean
          auto_confirm_weekdays?: number[]
          allow_overlap?: boolean
          booking_rules?: string[]
        }
        Relationships: Rel[]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          role: AppRole
          branch_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: AppRole
          branch_id?: string | null
          is_active?: boolean
        }
        Update: {
          full_name?: string
          role?: AppRole
          branch_id?: string | null
          is_active?: boolean
        }
        Relationships: Rel[]
      }
      tickets: {
        Row: {
          id: string
          ticket_no: number
          kind: TicketKind
          status: TicketStatus
          kind_reason: string
          dentolize_status: BookingStatus
          branch_id: string
          doctor_id: string
          service_id: string
          customer_name: string
          customer_phone: string
          customer_gender: ClientGender
          area_codes: string[]
          appt_date: string
          start_time: string
          end_time: string
          agent_note: string | null
          created_by: string
          created_at: string
          sla_due_at: string | null
          sla_breached_at: string | null
          branch_response: BranchResponse | null
          responder_name: string | null
          response_note: string | null
          counter_date: string | null
          counter_start_time: string | null
          counter_doctor_id: string | null
          responded_at: string | null
          acknowledged_at: string | null
          outcome: TicketOutcome | null
          closed_by: string | null
          closed_at: string | null
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          ticket_id: string | null
          kind: string
          title: string
          body: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          ticket_id?: string | null
          kind: string
          title: string
          body?: string | null
          read_at?: string | null
        }
        Update: {
          read_at?: string | null
        }
        Relationships: Rel[]
      }
      ticket_events: {
        Row: {
          id: string
          ticket_id: string
          event: string
          actor_id: string | null
          actor_name: string | null
          payload: Record<string, unknown> | null
          created_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      doctors: {
        Row: {
          id: string
          branch_id: string
          code: string
          display_name: string
          person_key: string | null
          default_booking_status: BookingStatus
          accepts_men: boolean
          laser_men_allowed: boolean
          men_laser_area_codes: string[] | null
          rejects_small_areas_only: boolean
          no_overlap: boolean
          notes: string | null
          is_active: boolean
          sort: number
          created_at: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          code: string
          display_name: string
          person_key?: string | null
          default_booking_status?: BookingStatus
          accepts_men?: boolean
          laser_men_allowed?: boolean
          men_laser_area_codes?: string[] | null
          rejects_small_areas_only?: boolean
          no_overlap?: boolean
          notes?: string | null
          is_active?: boolean
          sort?: number
        }
        Update: {
          code?: string
          display_name?: string
          person_key?: string | null
          default_booking_status?: BookingStatus
          accepts_men?: boolean
          laser_men_allowed?: boolean
          men_laser_area_codes?: string[] | null
          rejects_small_areas_only?: boolean
          no_overlap?: boolean
          notes?: string | null
          is_active?: boolean
          sort?: number
        }
        Relationships: Rel[]
      }
      doctor_updates: {
        Row: {
          id: string
          branch_id: string
          doctor_id: string | null
          type: UpdateType
          note: string | null
          date_from: string
          date_to: string
          segments: unknown
          created_by: string | null
          created_at: string
        }
        Insert: {
          branch_id: string
          doctor_id?: string | null
          type: UpdateType
          note?: string | null
          date_from: string
          date_to: string
          segments?: unknown
          created_by?: string | null
        }
        Update: {
          type?: UpdateType
          note?: string | null
          date_from?: string
          date_to?: string
          segments?: unknown
        }
        Relationships: Rel[]
      }
      doctor_schedules: {
        Row: {
          id: string
          doctor_id: string
          weekday: number
          start_time: string
          end_time: string
          kind: ShiftKind
        }
        Insert: {
          doctor_id: string
          weekday: number
          start_time: string
          end_time: string
          kind?: ShiftKind
        }
        Update: {
          start_time?: string
          end_time?: string
          kind?: ShiftKind
        }
        Relationships: Rel[]
      }
      consultation_prices: {
        Row: {
          id: string
          branch_id: string
          doctor_id: string | null
          kind: ConsultationKind
          price: number
        }
        Insert: {
          branch_id: string
          doctor_id?: string | null
          kind: ConsultationKind
          price: number
        }
        Update: {
          price?: number
        }
        Relationships: Rel[]
      }
      price_lists: {
        Row: {
          id: string
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: Rel[]
      }
      price_categories: {
        Row: {
          id: string
          price_list_id: string
          name: string
          info_note: string | null
          kb_slug: string | null
          sort: number
        }
        Insert: {
          price_list_id: string
          name: string
          info_note?: string | null
          kb_slug?: string | null
          sort?: number
        }
        Update: {
          name?: string
          info_note?: string | null
          kb_slug?: string | null
          sort?: number
        }
        Relationships: Rel[]
      }
      price_items: {
        Row: {
          id: string
          category_id: string
          name: string
          price: number | null
          price_text: string | null
          sort: number
        }
        Insert: {
          category_id: string
          name: string
          price?: number | null
          price_text?: string | null
          sort?: number
        }
        Update: {
          name?: string
          price?: number | null
          price_text?: string | null
          sort?: number
        }
        Relationships: Rel[]
      }
      branch_services: {
        Row: {
          branch_id: string
          service_id: string
        }
        Insert: {
          branch_id: string
          service_id: string
        }
        Update: Record<string, never>
        Relationships: Rel[]
      }
      services: {
        Row: {
          id: string
          code: string
          name_ar: string
          name_en: string
          default_duration_min: number
          uses_laser_areas: boolean
          kb_slug: string | null
          sort: number
          is_active: boolean
        }
        Insert: {
          code: string
          name_ar: string
          name_en: string
          default_duration_min?: number
          uses_laser_areas?: boolean
          kb_slug?: string | null
          sort?: number
          is_active?: boolean
        }
        Update: {
          code?: string
          name_ar?: string
          name_en?: string
          default_duration_min?: number
          uses_laser_areas?: boolean
          kb_slug?: string | null
          sort?: number
          is_active?: boolean
        }
        Relationships: Rel[]
      }
      branch_laser_cutoffs: {
        Row: {
          id: string
          branch_id: string
          weekday: number
          shift_starts_before: string
          cutoff: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      doctor_laser_cutoffs: {
        Row: {
          doctor_id: string
          weekday: number
          cutoff: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      laser_areas: {
        Row: {
          code: string
          gender: ClientGender
          name_en: string
          hint_ar: string | null
          duration_min: number
          is_small: boolean
          is_full_body: boolean
          requires_companion: boolean
          sort: number
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      laser_area_conflicts: {
        Row: {
          area_code: string
          conflicts_with: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      laser_area_combos: {
        Row: {
          id: string
          label: string
          required_codes: string[]
          any_of_codes: string[]
          duration_adjust_min: number
          sort: number
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      laser_price_map: {
        Row: {
          id: string
          price_list_id: string
          area_codes: string[]
          single_item_id: string
          package3_item_id: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: Rel[]
      }
      kb_articles: {
        Row: {
          slug: string
          kind: string
          title: string
          body: unknown
          sort: number
          updated_at: string
        }
        Insert: {
          slug: string
          kind: string
          title: string
          body: unknown
          sort?: number
        }
        Update: {
          kind?: string
          title?: string
          body?: unknown
          sort?: number
        }
        Relationships: Rel[]
      }
    }
    Views: {
      ticket_board: {
        Row: {
          id: string
          ticket_no: number
          kind: TicketKind
          status: TicketStatus
          kind_reason: string
          dentolize_status: BookingStatus
          branch_id: string
          doctor_id: string
          service_id: string
          customer_name: string
          customer_phone: string
          customer_gender: ClientGender
          area_codes: string[]
          appt_date: string
          start_time: string
          end_time: string
          agent_note: string | null
          created_by: string
          created_at: string
          sla_due_at: string | null
          sla_breached_at: string | null
          branch_response: BranchResponse | null
          responder_name: string | null
          response_note: string | null
          counter_date: string | null
          counter_start_time: string | null
          counter_doctor_id: string | null
          responded_at: string | null
          acknowledged_at: string | null
          outcome: TicketOutcome | null
          closed_by: string | null
          closed_at: string | null
          updated_at: string
          branch_name: string
          doctor_name: string
          service_name: string
          agent_name: string | null
          is_overdue: boolean
          response_seconds: number | null
        }
        Relationships: Rel[]
      }
    }
    Functions: {
      current_app_role: {
        Args: Record<string, never>
        Returns: AppRole
      }
      current_branch_id: {
        Args: Record<string, never>
        Returns: string
      }
      resolve_ticket_kind: {
        Args: { p_doctor_id: string; p_date: string }
        Returns: { kind: TicketKind | null; dentolize_status: BookingStatus; reason: string }[]
      }
      create_ticket: {
        Args: {
          p_doctor_id: string
          p_service_code: string
          p_customer_name: string
          p_customer_phone: string
          p_customer_gender: ClientGender
          p_area_codes: string[]
          p_appt_date: string
          p_start_time: string
          p_end_time: string
          p_agent_note?: string | null
        }
        Returns: Database["public"]["Tables"]["tickets"]["Row"]
      }
      close_ticket: {
        Args: { p_ticket_id: string; p_outcome: TicketOutcome; p_note?: string | null }
        Returns: Database["public"]["Tables"]["tickets"]["Row"]
      }
      cancel_ticket: {
        Args: { p_ticket_id: string; p_reason: string }
        Returns: Database["public"]["Tables"]["tickets"]["Row"]
      }
      branch_respond: {
        Args: {
          p_ticket_id: string
          p_response: BranchResponse
          p_responder_name?: string | null
          p_note?: string | null
          p_counter_date?: string | null
          p_counter_start_time?: string | null
          p_counter_doctor_id?: string | null
        }
        Returns: Database["public"]["Tables"]["tickets"]["Row"]
      }
      acknowledge_notice: {
        Args: {
          p_ticket_id: string
          p_responder_name?: string | null
        }
        Returns: Database["public"]["Tables"]["tickets"]["Row"]
      }
    }
    Enums: {
      app_role: AppRole
      ticket_kind: TicketKind
      ticket_status: TicketStatus
      branch_response: BranchResponse
      ticket_outcome: TicketOutcome
      client_gender: ClientGender
      booking_status: BookingStatus
      consultation_kind: ConsultationKind
      update_type: UpdateType
      shift_kind: ShiftKind
    }
    CompositeTypes: Record<string, never>
  }
}
