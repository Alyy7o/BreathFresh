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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cravings: {
        Row: {
          created_at: string
          id: string
          intensity: number
          notes: string | null
          trigger: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intensity: number
          notes?: string | null
          trigger?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intensity?: number
          notes?: string | null
          trigger?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cigarettes_per_day: number | null
          cigarettes_per_pack: number | null
          created_at: string | null
          email: string | null
          enable_notifications: boolean | null
          full_name: string | null
          id: string
          pack_cost: number | null
          quit_date: string | null
          quit_reason: string | null
          updated_at: string | null
          years_smoked: number | null
        }
        Insert: {
          cigarettes_per_day?: number | null
          cigarettes_per_pack?: number | null
          created_at?: string | null
          email?: string | null
          enable_notifications?: boolean | null
          full_name?: string | null
          id: string
          pack_cost?: number | null
          quit_date?: string | null
          quit_reason?: string | null
          updated_at?: string | null
          years_smoked?: number | null
        }
        Update: {
          cigarettes_per_day?: number | null
          cigarettes_per_pack?: number | null
          created_at?: string | null
          email?: string | null
          enable_notifications?: boolean | null
          full_name?: string | null
          id?: string
          pack_cost?: number | null
          quit_date?: string | null
          quit_reason?: string | null
          updated_at?: string | null
          years_smoked?: number | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          author: string | null
          content: string | null
          created_at: string
          description: string | null
          id: string
          rating: number | null
          read_time: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          author?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          rating?: number | null
          read_time?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          author?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          rating?: number | null
          read_time?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      specialists: {
        Row: {
          id: string
          name: string
          role: string
          experience: string
          location: string
          rating: number
          reviews_count: number
          fee: number
          tags: string[]
          avatar_initials: string
          avatar_color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: string
          experience: string
          location: string
          rating: number
          reviews_count: number
          fee: number
          tags: string[]
          avatar_initials: string
          avatar_color: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          experience?: string
          location?: string
          rating?: number
          reviews_count?: number
          fee?: number
          tags?: string[]
          avatar_initials?: string
          avatar_color?: string
          created_at?: string
        }
        Relationships: []
      }
      specialist_reviews: {
        Row: {
          id: string
          appointment_id: string
          user_id: string
          specialist_id: string
          rating: number
          review_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          user_id: string
          specialist_id: string
          rating: number
          review_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          user_id?: string
          specialist_id?: string
          rating?: number
          review_text?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_reviews_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          user_id: string
          specialist_id: string
          appointment_date: string
          appointment_time: string
          status: string
          meet_link: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          specialist_id: string
          appointment_date: string
          appointment_time: string
          status?: string
          meet_link: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          specialist_id?: string
          appointment_date?: string
          appointment_time?: string
          status?: string
          meet_link?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      quit_plans: {
        Row: {
          id: string
          user_id: string
          plan_data: Json
          start_date: string
          end_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_data: Json
          start_date?: string
          end_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_data?: Json
          start_date?: string
          end_date?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quit_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          role: "user" | "assistant"
          content: string
          conversation_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: "user" | "assistant"
          content: string
          conversation_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: "user" | "assistant"
          content?: string
          conversation_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_bookmarks: {
        Row: {
          id: string
          user_id: string
          resource_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resource_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resource_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bookmarks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      admin_users_view: {
        Row: {
          cigarettes_per_day: number | null
          cigarettes_per_pack: number | null
          created_at: string | null
          days_smoke_free: number | null
          email: string | null
          full_name: string | null
          id: string | null
          pack_cost: number | null
          quit_date: string | null
          total_cravings: number | null
          years_smoked: number | null
        }
        Relationships: []
      }
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
