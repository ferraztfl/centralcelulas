export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      cells: {
        Row: {
          address: string
          created_at: string
          gender: Database["public"]["Enums"]["cell_gender"]
          id: string
          is_active: boolean
          latitude: number | null
          leader_instagram: string | null
          leader_name: string
          leader_whatsapp: string
          leader2_name: string | null
          leader2_whatsapp: string | null
          longitude: number | null
          meeting_time: string | null
          meeting_weekday: number | null
          name: string
          neighborhood: string
          network_id: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          gender?: Database["public"]["Enums"]["cell_gender"]
          id?: string
          is_active?: boolean
          latitude?: number | null
          leader_instagram?: string | null
          leader_name: string
          leader_whatsapp: string
          leader2_name?: string | null
          leader2_whatsapp?: string | null
          longitude?: number | null
          meeting_time?: string | null
          meeting_weekday?: number | null
          name: string
          neighborhood: string
          network_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          gender?: Database["public"]["Enums"]["cell_gender"]
          id?: string
          is_active?: boolean
          latitude?: number | null
          leader_instagram?: string | null
          leader_name?: string
          leader_whatsapp?: string
          leader2_name?: string | null
          leader2_whatsapp?: string | null
          longitude?: number | null
          meeting_time?: string | null
          meeting_weekday?: number | null
          name?: string
          neighborhood?: string
          network_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cells_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhood_adjacencies: {
        Row: {
          created_at: string
          id: string
          neighborhood_a: string
          neighborhood_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          neighborhood_a: string
          neighborhood_b: string
        }
        Update: {
          created_at?: string
          id?: string
          neighborhood_a?: string
          neighborhood_b?: string
        }
        Relationships: []
      }
      networks: {
        Row: {
          color: string
          color_name: string
          id: string
          is_couples: boolean
          is_fallback: boolean
          is_kids: boolean
          max_age: number | null
          min_age: number | null
          name: string
          sort_order: number
        }
        Insert: {
          color: string
          color_name: string
          id: string
          is_couples?: boolean
          is_fallback?: boolean
          is_kids?: boolean
          max_age?: number | null
          min_age?: number | null
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          color_name?: string
          id?: string
          is_couples?: boolean
          is_fallback?: boolean
          is_kids?: boolean
          max_age?: number | null
          min_age?: number | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_status: "pending" | "approved" | "rejected"
          approved_at: string | null
          approved_by: string | null
          created_at: string
          display_name: string | null
          id: string
          rejected_at: string | null
          rejected_by: string | null
          updated_at: string
        }
        Insert: {
          access_status?: "pending" | "approved" | "rejected"
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          rejected_at?: string | null
          rejected_by?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: "pending" | "approved" | "rejected"
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      cell_gender: "masculina" | "feminina" | "mista"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      cell_gender: ["masculina", "feminina", "mista"],
    },
  },
} as const
