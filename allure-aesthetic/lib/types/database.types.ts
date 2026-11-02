/**
 * Supabase database types for Allure Aesthetic.
 * Regenerate with: npx supabase gen types typescript --linked > lib/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          sla_minutes: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          sla_minutes?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          sla_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      branch_laser_cutoffs: {
        Row: {
          branch_id: string
          cutoff: string
          id: string
          shift_starts_before: string
          weekday: number
        }
        Insert: {
          branch_id: string
          cutoff: string
          id?: string
          shift_starts_before: string
          weekday: number
        }
        Update: {
          branch_id?: string
          cutoff?: string
          id?: string
          shift_starts_before?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "branch_laser_cutoffs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_policies: {
        Row: {
          allow_overlap: boolean
          auto_confirm_weekdays: number[]
          booking_rules: string[]
          branch_id: string
          request_window_days: number
          same_day_always_request: boolean
          updated_at: string
        }
        Insert: {
          allow_overlap?: boolean
          auto_confirm_weekdays?: number[]
          booking_rules?: string[]
          branch_id: string
          request_window_days?: number
          same_day_always_request?: boolean
          updated_at?: string
        }
        Update: {
          allow_overlap?: boolean
          auto_confirm_weekdays?: number[]
          booking_rules?: string[]
          branch_id?: string
          request_window_days?: number
          same_day_always_request?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_policies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
        Update: {
          branch_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_services_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          has_tickets: boolean
          id: string
          is_active: boolean
          logo_url: string | null
          managers: string[]
          name_ar: string
          payment_methods: string[]
          sort: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          has_tickets?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          managers?: string[]
          name_ar: string
          payment_methods?: string[]
          sort?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          has_tickets?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          managers?: string[]
          name_ar?: string
          payment_methods?: string[]
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      doctor_laser_cutoffs: {
        Row: {
          cutoff: string
          doctor_id: string
          weekday: number
        }
        Insert: {
          cutoff: string
          doctor_id: string
          weekday: number
        }
        Update: {
          cutoff?: string
          doctor_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_laser_cutoffs_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_rooms: {
        Row: {
          doctor_id: string
          room_id: string
          weekday: number
        }
        Insert: {
          doctor_id: string
          room_id: string
          weekday: number
        }
        Update: {
          doctor_id?: string
          room_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_rooms_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_schedules: {
        Row: {
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["shift_kind"]
          start_time: string
          weekday: number
        }
        Insert: {
          doctor_id: string
          end_time: string
          id?: string
          kind?: Database["public"]["Enums"]["shift_kind"]
          start_time: string
          weekday: number
        }
        Update: {
          doctor_id?: string
          end_time?: string
          id?: string
          kind?: Database["public"]["Enums"]["shift_kind"]
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_updates: {
        Row: {
          at_time: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          doctor_id: string | null
          id: string
          note: string | null
          segments: Json
          type: Database["public"]["Enums"]["update_type"]
          weekdays: number[]
        }
        Insert: {
          at_time?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          doctor_id?: string | null
          id?: string
          note?: string | null
          segments?: Json
          type: Database["public"]["Enums"]["update_type"]
          weekdays?: number[]
        }
        Update: {
          at_time?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          doctor_id?: string | null
          id?: string
          note?: string | null
          segments?: Json
          type?: Database["public"]["Enums"]["update_type"]
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "doctor_updates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_updates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          accepts_men: boolean
          always_open: boolean
          branch_id: string
          code: string
          created_at: string
          default_booking_status: Database["public"]["Enums"]["booking_status"]
          display_name: string
          id: string
          is_active: boolean
          laser_men_allowed: boolean
          men_laser_area_codes: string[] | null
          no_overlap: boolean
          notes: string | null
          person_key: string | null
          rejects_small_areas_only: boolean
          sort: number
          specialty: string | null
          updated_at: string
        }
        Insert: {
          accepts_men?: boolean
          always_open?: boolean
          branch_id: string
          code: string
          created_at?: string
          default_booking_status?: Database["public"]["Enums"]["booking_status"]
          display_name: string
          id?: string
          is_active?: boolean
          laser_men_allowed?: boolean
          men_laser_area_codes?: string[] | null
          no_overlap?: boolean
          notes?: string | null
          person_key?: string | null
          rejects_small_areas_only?: boolean
          sort?: number
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          accepts_men?: boolean
          always_open?: boolean
          branch_id?: string
          code?: string
          created_at?: string
          default_booking_status?: Database["public"]["Enums"]["booking_status"]
          display_name?: string
          id?: string
          is_active?: boolean
          laser_men_allowed?: boolean
          men_laser_area_codes?: string[] | null
          no_overlap?: boolean
          notes?: string | null
          person_key?: string | null
          rejects_small_areas_only?: boolean
          sort?: number
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          body: Json
          kind: string
          slug: string
          sort: number
          title: string
          updated_at: string
        }
        Insert: {
          body: Json
          kind: string
          slug: string
          sort?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          kind?: string
          slug?: string
          sort?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      laser_area_combos: {
        Row: {
          any_of_codes: string[]
          duration_adjust_min: number
          id: string
          label: string
          required_codes: string[]
          sort: number
        }
        Insert: {
          any_of_codes?: string[]
          duration_adjust_min?: number
          id?: string
          label: string
          required_codes: string[]
          sort?: number
        }
        Update: {
          any_of_codes?: string[]
          duration_adjust_min?: number
          id?: string
          label?: string
          required_codes?: string[]
          sort?: number
        }
        Relationships: []
      }
      laser_area_conflicts: {
        Row: {
          area_code: string
          conflicts_with: string
        }
        Insert: {
          area_code: string
          conflicts_with: string
        }
        Update: {
          area_code?: string
          conflicts_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "laser_area_conflicts_area_code_fkey"
            columns: ["area_code"]
            isOneToOne: false
            referencedRelation: "laser_areas"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "laser_area_conflicts_conflicts_with_fkey"
            columns: ["conflicts_with"]
            isOneToOne: false
            referencedRelation: "laser_areas"
            referencedColumns: ["code"]
          },
        ]
      }
      laser_area_price_map: {
        Row: {
          area_codes: string[]
          gender: Database["public"]["Enums"]["client_gender"]
          id: string
          package3_item_code: string | null
          single_item_code: string
          sort: number
        }
        Insert: {
          area_codes: string[]
          gender: Database["public"]["Enums"]["client_gender"]
          id?: string
          package3_item_code?: string | null
          single_item_code: string
          sort?: number
        }
        Update: {
          area_codes?: string[]
          gender?: Database["public"]["Enums"]["client_gender"]
          id?: string
          package3_item_code?: string | null
          single_item_code?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "laser_area_price_map_package3_item_code_fkey"
            columns: ["package3_item_code"]
            isOneToOne: false
            referencedRelation: "price_items"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "laser_area_price_map_single_item_code_fkey"
            columns: ["single_item_code"]
            isOneToOne: false
            referencedRelation: "price_items"
            referencedColumns: ["code"]
          },
        ]
      }
      laser_areas: {
        Row: {
          code: string
          duration_min: number
          gender: Database["public"]["Enums"]["client_gender"]
          hint_ar: string | null
          is_full_body: boolean
          is_small: boolean
          name_en: string
          requires_companion: boolean
          sort: number
        }
        Insert: {
          code: string
          duration_min?: number
          gender: Database["public"]["Enums"]["client_gender"]
          hint_ar?: string | null
          is_full_body?: boolean
          is_small?: boolean
          name_en: string
          requires_companion?: boolean
          sort?: number
        }
        Update: {
          code?: string
          duration_min?: number
          gender?: Database["public"]["Enums"]["client_gender"]
          hint_ar?: string | null
          is_full_body?: boolean
          is_small?: boolean
          name_en?: string
          requires_companion?: boolean
          sort?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          ticket_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          ticket_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          ticket_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      price_categories: {
        Row: {
          code: string
          id: string
          is_active: boolean
          kb_slug: string | null
          name_ar: string
          name_en: string | null
          sort: number
          starts_from: number | null
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          kb_slug?: string | null
          name_ar: string
          name_en?: string | null
          sort?: number
          starts_from?: number | null
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          kb_slug?: string | null
          name_ar?: string
          name_en?: string | null
          sort?: number
          starts_from?: number | null
        }
        Relationships: []
      }
      price_item_branch_prices: {
        Row: {
          branch_id: string
          item_id: string
          price: number
        }
        Insert: {
          branch_id: string
          item_id: string
          price: number
        }
        Update: {
          branch_id?: string
          item_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_item_branch_prices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_item_branch_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "price_items"
            referencedColumns: ["id"]
          },
        ]
      }
      price_item_doctors: {
        Row: {
          doctor_id: string
          item_id: string
        }
        Insert: {
          doctor_id: string
          item_id: string
        }
        Update: {
          doctor_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_item_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_item_doctors_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "price_items"
            referencedColumns: ["id"]
          },
        ]
      }
      price_items: {
        Row: {
          availability_text: string | null
          category_id: string
          code: string
          full_name: string
          group_name: string | null
          id: string
          is_active: boolean
          item_type: string
          notes: string | null
          price_text: string | null
          sort: number
          unit: string | null
          variant: string | null
        }
        Insert: {
          availability_text?: string | null
          category_id: string
          code: string
          full_name: string
          group_name?: string | null
          id?: string
          is_active?: boolean
          item_type?: string
          notes?: string | null
          price_text?: string | null
          sort?: number
          unit?: string | null
          variant?: string | null
        }
        Update: {
          availability_text?: string | null
          category_id?: string
          code?: string
          full_name?: string
          group_name?: string | null
          id?: string
          is_active?: boolean
          item_type?: string
          notes?: string | null
          price_text?: string | null
          sort?: number
          unit?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "price_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          branch_id: string
          code: string
          id: string
          is_active: boolean
          sort: number
          title: string
        }
        Insert: {
          branch_id: string
          code: string
          id?: string
          is_active?: boolean
          sort?: number
          title: string
        }
        Update: {
          branch_id?: string
          code?: string
          id?: string
          is_active?: boolean
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          code: string
          default_duration_min: number
          id: string
          is_active: boolean
          kb_slug: string | null
          name_ar: string
          name_en: string
          sort: number
          uses_laser_areas: boolean
        }
        Insert: {
          code: string
          default_duration_min?: number
          id?: string
          is_active?: boolean
          kb_slug?: string | null
          name_ar: string
          name_en: string
          sort?: number
          uses_laser_areas?: boolean
        }
        Update: {
          code?: string
          default_duration_min?: number
          id?: string
          is_active?: boolean
          kb_slug?: string | null
          name_ar?: string
          name_en?: string
          sort?: number
          uses_laser_areas?: boolean
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: number
          payload: Json
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: never
          payload?: Json
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: never
          payload?: Json
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          acknowledged_at: string | null
          agent_note: string | null
          appt_date: string
          area_codes: string[]
          branch_id: string
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          service_id: string
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_no: number
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          agent_note?: string | null
          appt_date: string
          area_codes?: string[]
          branch_id: string
          branch_response?:
            | Database["public"]["Enums"]["branch_response"]
            | null
          closed_at?: string | null
          closed_by?: string | null
          counter_date?: string | null
          counter_doctor_id?: string | null
          counter_start_time?: string | null
          created_at?: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id?: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time?: string | null
          outcome?: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at?: string | null
          responder_name?: string | null
          response_note?: string | null
          service_id: string
          sla_breached_at?: string | null
          sla_due_at?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_no?: never
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          agent_note?: string | null
          appt_date?: string
          area_codes?: string[]
          branch_id?: string
          branch_response?:
            | Database["public"]["Enums"]["branch_response"]
            | null
          closed_at?: string | null
          closed_by?: string | null
          counter_date?: string | null
          counter_doctor_id?: string | null
          counter_start_time?: string | null
          created_at?: string
          created_by?: string
          customer_gender?: Database["public"]["Enums"]["client_gender"]
          customer_name?: string
          customer_phone?: string
          dentolize_status?: Database["public"]["Enums"]["booking_status"]
          doctor_id?: string
          end_time?: string
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          kind_reason?: string
          offered_time?: string | null
          outcome?: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at?: string | null
          responder_name?: string | null
          response_note?: string | null
          service_id?: string
          sla_breached_at?: string | null
          sla_due_at?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_no?: never
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_counter_doctor_id_fkey"
            columns: ["counter_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ticket_board: {
        Row: {
          acknowledged_at: string | null
          agent_name: string | null
          agent_note: string | null
          appt_date: string | null
          area_codes: string[] | null
          branch_id: string | null
          branch_name: string | null
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string | null
          created_by: string | null
          customer_gender: Database["public"]["Enums"]["client_gender"] | null
          customer_name: string | null
          customer_phone: string | null
          dentolize_status: Database["public"]["Enums"]["booking_status"] | null
          doctor_id: string | null
          doctor_name: string | null
          end_time: string | null
          id: string | null
          is_overdue: boolean | null
          kind: Database["public"]["Enums"]["ticket_kind"] | null
          kind_reason: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          response_seconds: number | null
          service_id: string | null
          service_name: string | null
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          ticket_no: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_counter_doctor_id_fkey"
            columns: ["counter_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _notify_call_center: {
        Args: { p_body: string; p_kind: string; p_title: string }
        Returns: undefined
      }
      admin_save_doctor_schedule: {
        Args: { p_doctor_id: string; p_rooms: Json; p_segments: Json }
        Returns: undefined
      }
      _notify_role: {
        Args: {
          p_body: string
          p_branch: string
          p_kind: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_ticket: string
          p_title: string
        }
        Returns: undefined
      }
      acknowledge_notice: {
        Args: { p_responder_name?: string; p_ticket_id: string }
        Returns: {
          acknowledged_at: string | null
          agent_note: string | null
          appt_date: string
          area_codes: string[]
          branch_id: string
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          service_id: string
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_no: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      blocking_update: {
        Args: { p_date: string; p_doctor_id: string }
        Returns: {
          at_time: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          doctor_id: string | null
          id: string
          note: string | null
          segments: Json
          type: Database["public"]["Enums"]["update_type"]
          weekdays: number[]
        }
        SetofOptions: {
          from: "*"
          to: "doctor_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      branch_respond: {
        Args: {
          p_note?: string
          p_offered_time?: string
          p_responder_name?: string
          p_response: Database["public"]["Enums"]["branch_response"]
          p_ticket_id: string
        }
        Returns: {
          acknowledged_at: string | null
          agent_note: string | null
          appt_date: string
          area_codes: string[]
          branch_id: string
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          service_id: string
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_no: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cairo_today: { Args: never; Returns: string }
      cancel_ticket: {
        Args: { p_reason: string; p_ticket_id: string }
        Returns: {
          acknowledged_at: string | null
          agent_note: string | null
          appt_date: string
          area_codes: string[]
          branch_id: string
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          service_id: string
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_no: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_ticket: {
        Args: {
          p_note?: string
          p_outcome: Database["public"]["Enums"]["ticket_outcome"]
          p_ticket_id: string
        }
        Returns: {
          acknowledged_at: string | null
          agent_note: string | null
          appt_date: string
          area_codes: string[]
          branch_id: string
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          service_id: string
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_no: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_ticket: {
        Args: {
          p_agent_note?: string
          p_appt_date: string
          p_area_codes: string[]
          p_customer_gender: Database["public"]["Enums"]["client_gender"]
          p_customer_name: string
          p_customer_phone: string
          p_doctor_id: string
          p_end_time: string
          p_service_code: string
          p_start_time: string
        }
        Returns: {
          acknowledged_at: string | null
          agent_note: string | null
          appt_date: string
          area_codes: string[]
          branch_id: string
          branch_response: Database["public"]["Enums"]["branch_response"] | null
          closed_at: string | null
          closed_by: string | null
          counter_date: string | null
          counter_doctor_id: string | null
          counter_start_time: string | null
          created_at: string
          created_by: string
          customer_gender: Database["public"]["Enums"]["client_gender"]
          customer_name: string
          customer_phone: string
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          doctor_id: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          kind_reason: string
          offered_time: string | null
          outcome: Database["public"]["Enums"]["ticket_outcome"] | null
          responded_at: string | null
          responder_name: string | null
          response_note: string | null
          service_id: string
          sla_breached_at: string | null
          sla_due_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_no: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_branch_id: { Args: never; Returns: string }
      effective_booking_status: {
        Args: { p_date: string; p_doctor_id: string }
        Returns: Database["public"]["Enums"]["booking_status"]
      }
      full_update: {
        Args: { p_date: string; p_doctor_id: string }
        Returns: {
          at_time: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          doctor_id: string | null
          id: string
          note: string | null
          segments: Json
          type: Database["public"]["Enums"]["update_type"]
          weekdays: number[]
        }
        SetofOptions: {
          from: "*"
          to: "doctor_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_call_center: { Args: never; Returns: boolean }
      mark_sla_breaches: { Args: never; Returns: number }
      replace_doctor_schedule: {
        Args: { p_doctor_id: string; p_entries: Json }
        Returns: undefined
      }
      resolve_ticket_kind: {
        Args: { p_date: string; p_doctor_id: string }
        Returns: {
          dentolize_status: Database["public"]["Enums"]["booking_status"]
          kind: Database["public"]["Enums"]["ticket_kind"]
          reason: string
        }[]
      }
      weekday_sat0: { Args: { d: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "agent" | "branch"
      booking_status: "open" | "confirmed"
      branch_response:
        | "agent_confirm"
        | "branch_confirm"
        | "counter_offer"
        | "unavailable"
        | "offered"
        | "full"
        | "confirmed"
      client_gender: "female" | "male"
      shift_kind: "all" | "laser" | "other" | "derma"
      ticket_kind: "request" | "notice"
      ticket_outcome:
        | "customer_confirmed"
        | "customer_declined"
        | "no_answer"
        | "handled_by_branch"
        | "notice_acknowledged"
      ticket_status: "pending" | "answered" | "closed" | "cancelled"
      update_type:
        | "off"
        | "stop"
        | "hours"
        | "open_slot"
        | "note"
        | "force_open"
        | "laser_stop"
        | "booking_cutoff"
        | "full"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "agent", "branch"],
      booking_status: ["open", "confirmed"],
      branch_response: [
        "agent_confirm",
        "branch_confirm",
        "counter_offer",
        "unavailable",
        "offered",
        "full",
        "confirmed",
      ],
      client_gender: ["female", "male"],
      shift_kind: ["all", "laser", "other", "derma"],
      ticket_kind: ["request", "notice"],
      ticket_outcome: [
        "customer_confirmed",
        "customer_declined",
        "no_answer",
        "handled_by_branch",
        "notice_acknowledged",
      ],
      ticket_status: ["pending", "answered", "closed", "cancelled"],
      update_type: [
        "off",
        "stop",
        "hours",
        "open_slot",
        "note",
        "force_open",
        "laser_stop",
        "booking_cutoff",
        "full",
      ],
    },
  },
} as const

// ---------------------------------------------------------------------
// Convenience enum aliases (hand-added, kept in sync with the generated
// public Enums above). `consultation_kind` was dropped in migration 6.
// ---------------------------------------------------------------------
type PublicEnums = Database["public"]["Enums"]
export type AppRole = PublicEnums["app_role"]
export type BookingStatus = PublicEnums["booking_status"]
export type BranchResponse = PublicEnums["branch_response"]
export type ClientGender = PublicEnums["client_gender"]
export type ShiftKind = PublicEnums["shift_kind"]
export type TicketKind = PublicEnums["ticket_kind"]
export type TicketOutcome = PublicEnums["ticket_outcome"]
export type TicketStatus = PublicEnums["ticket_status"]
export type UpdateType = PublicEnums["update_type"]
