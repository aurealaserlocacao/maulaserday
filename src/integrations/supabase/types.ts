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
  public: {
    Tables: {
      appointment_events: {
        Row: {
          actor_id: string | null
          appointment_id: string
          clinic_id: string
          created_at: string
          details: Json
          id: string
          kind: string
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          clinic_id: string
          created_at?: string
          details?: Json
          id?: string
          kind: string
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          areas: string[]
          areas_note: string | null
          client_id: string
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          duration_min: number
          ends_at: string
          expected_amount: number | null
          final_amount: number | null
          financial_status: Database["public"]["Enums"]["financial_status"]
          id: string
          internal_notes: string | null
          session_notes: string | null
          started_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          areas?: string[]
          areas_note?: string | null
          client_id: string
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_min: number
          ends_at: string
          expected_amount?: number | null
          final_amount?: number | null
          financial_status?: Database["public"]["Enums"]["financial_status"]
          id?: string
          internal_notes?: string | null
          session_notes?: string | null
          started_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          areas?: string[]
          areas_note?: string | null
          client_id?: string
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          ends_at?: string
          expected_amount?: number | null
          final_amount?: number | null
          financial_status?: Database["public"]["Enums"]["financial_status"]
          id?: string
          internal_notes?: string | null
          session_notes?: string | null
          started_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          clinic_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          clinic_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          clinic_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          clinic_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          clinic_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string
          phone_normalized: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          clinic_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          phone_normalized: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          phone_normalized?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_memberships: {
        Row: {
          accepted_at: string | null
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          invited_at: string | null
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_memberships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          access_status: Database["public"]["Enums"]["clinic_access_status"]
          address: string | null
          admin_notes: string | null
          business_info: string | null
          contact_email: string | null
          created_at: string
          default_duration_min: number
          id: string
          name: string
          owner_name: string | null
          phone: string | null
          slug: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["clinic_access_status"]
          address?: string | null
          admin_notes?: string | null
          business_info?: string | null
          contact_email?: string | null
          created_at?: string
          default_duration_min?: number
          id?: string
          name: string
          owner_name?: string | null
          phone?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          access_status?: Database["public"]["Enums"]["clinic_access_status"]
          address?: string | null
          admin_notes?: string | null
          business_info?: string | null
          contact_email?: string | null
          created_at?: string
          default_duration_min?: number
          id?: string
          name?: string
          owner_name?: string | null
          phone?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          clinic_id: string
          id: string
          kind: string
          updated_at: string
        }
        Insert: {
          body: string
          clinic_id: string
          id?: string
          kind: string
          updated_at?: string
        }
        Update: {
          body?: string
          clinic_id?: string
          id?: string
          kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          clinic_id: string
          created_at: string
          ends_on: string | null
          equipment: string
          id: string
          notes: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["rental_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          ends_on?: string | null
          equipment: string
          id?: string
          notes?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          ends_on?: string | null
          equipment?: string
          id?: string
          notes?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_log_support_access: {
        Args: { _clinic: string; _reason: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clinic_member: { Args: { _clinic_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _clinic: string
          _entity: string
          _entity_id: string
          _meta: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "platform_admin"
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "no_show"
        | "cancelled"
      clinic_access_status: "active" | "suspended"
      financial_status: "pending" | "partial" | "paid" | "refunded"
      membership_role: "owner" | "staff"
      payment_method: "pix" | "cash" | "card" | "transfer" | "other"
      rental_status: "active" | "ended" | "pending"
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
  public: {
    Enums: {
      app_role: ["platform_admin"],
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "no_show",
        "cancelled",
      ],
      clinic_access_status: ["active", "suspended"],
      financial_status: ["pending", "partial", "paid", "refunded"],
      membership_role: ["owner", "staff"],
      payment_method: ["pix", "cash", "card", "transfer", "other"],
      rental_status: ["active", "ended", "pending"],
    },
  },
} as const
