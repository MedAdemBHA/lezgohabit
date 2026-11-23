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
      badges: {
        Row: {
          awarded_at: string
          key: string
          season_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          key: string
          season_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          key?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_links: {
        Row: {
          created_at: string
          from_user: string
          id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          status?: string
          to_user?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          created_at: string
          day: string
          detail: Json | null
          id: string
          user_habit_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          day: string
          detail?: Json | null
          id?: string
          user_habit_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          day?: string
          detail?: Json | null
          id?: string
          user_habit_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkins_user_habit_id_fkey"
            columns: ["user_habit_id"]
            isOneToOne: false
            referencedRelation: "user_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          crew_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          crew_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          code: string
          created_at: string
          id: string
          is_public: boolean
          kind: string
          max_members: number
          name: string
          owner_id: string
          season_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          max_members?: number
          name: string
          owner_id: string
          season_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          max_members?: number
          name?: string
          owner_id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_scores: {
        Row: {
          comeback: boolean
          completion: number
          crew_sync: boolean
          day: string
          habit_points: number
          multiplier: number
          perfect: boolean
          season_id: string
          shield_used: boolean
          stack_points: number
          streak: number
          total: number
          user_id: string
        }
        Insert: {
          comeback?: boolean
          completion?: number
          crew_sync?: boolean
          day: string
          habit_points?: number
          multiplier?: number
          perfect?: boolean
          season_id: string
          shield_used?: boolean
          stack_points?: number
          streak?: number
          total?: number
          user_id: string
        }
        Update: {
          comeback?: boolean
          completion?: number
          crew_sync?: boolean
          day?: string
          habit_points?: number
          multiplier?: number
          perfect?: boolean
          season_id?: string
          shield_used?: boolean
          stack_points?: number
          streak?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_scores_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      day_extras: {
        Row: {
          chaos_done: boolean
          chaos_index: number | null
          chaos_spins: number
          day: string
          lift_prs: number
          proof_path: string | null
          proof_posted: boolean
          user_id: string
        }
        Insert: {
          chaos_done?: boolean
          chaos_index?: number | null
          chaos_spins?: number
          day: string
          lift_prs?: number
          proof_path?: string | null
          proof_posted?: boolean
          user_id: string
        }
        Update: {
          chaos_done?: boolean
          chaos_index?: number | null
          chaos_spins?: number
          day?: string
          lift_prs?: number
          proof_path?: string | null
          proof_posted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      habit_templates: {
        Row: {
          category: string
          color: string | null
          default_target: number
          description: Json
          icon: string
          id: string
          is_faith: boolean
          key: string
          kind: string
          name: Json
          sort: number
          unit: string | null
        }
        Insert: {
          category: string
          color?: string | null
          default_target?: number
          description: Json
          icon: string
          id?: string
          is_faith?: boolean
          key: string
          kind: string
          name: Json
          sort?: number
          unit?: string | null
        }
        Update: {
          category?: string
          color?: string | null
          default_target?: number
          description?: Json
          icon?: string
          id?: string
          is_faith?: boolean
          key?: string
          kind?: string
          name?: Json
          sort?: number
          unit?: string | null
        }
        Relationships: []
      }
      nudges: {
        Row: {
          created_at: string
          crew_id: string
          day: string
          from_user: string
          to_user: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          day: string
          from_user: string
          to_user: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          day?: string
          from_user?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          country_code: string
          created_at: string
          display_name: string
          faith_public: boolean
          handle: string
          id: string
          is_admin: boolean
          language: string
          notif_crew: boolean
          notif_daily: boolean
          onboarded: boolean
          show_on_public_board: boolean
          timezone: string
          units: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          faith_public?: boolean
          handle: string
          id: string
          is_admin?: boolean
          language?: string
          notif_crew?: boolean
          notif_daily?: boolean
          onboarded?: boolean
          show_on_public_board?: boolean
          timezone?: string
          units?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          faith_public?: boolean
          handle?: string
          id?: string
          is_admin?: boolean
          language?: string
          notif_crew?: boolean
          notif_daily?: boolean
          onboarded?: boolean
          show_on_public_board?: boolean
          timezone?: string
          units?: string
        }
        Relationships: []
      }
      respects: {
        Row: {
          checkin_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respects_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      season_entries: {
        Row: {
          comeback_used: boolean
          joined_at: string
          mode: string
          season_id: string
          user_id: string
        }
        Insert: {
          comeback_used?: boolean
          joined_at?: string
          mode?: string
          season_id: string
          user_id: string
        }
        Update: {
          comeback_used?: boolean
          joined_at?: string
          mode?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          ends_on: string
          id: string
          name: Json
          slug: string
          starts_on: string
          status: string
          theme_color: string
        }
        Insert: {
          ends_on: string
          id?: string
          name: Json
          slug: string
          starts_on: string
          status?: string
          theme_color?: string
        }
        Update: {
          ends_on?: string
          id?: string
          name?: Json
          slug?: string
          starts_on?: string
          status?: string
          theme_color?: string
        }
        Relationships: []
      }
      user_habits: {
        Row: {
          active: boolean
          created_at: string
          custom_name: string | null
          id: string
          kind: string
          position: number
          season_id: string
          target: number
          template_id: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_name?: string | null
          id?: string
          kind: string
          position?: number
          season_id: string
          target?: number
          template_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_name?: string | null
          id?: string
          kind?: string
          position?: number
          season_id?: string
          target?: number
          template_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_habits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_habits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "habit_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _award_badges: {
        Args: { _sid: string; _uid: string }
        Returns: undefined
      }
      _best_habit_stat: {
        Args: { _sid: string; _uid: string; _viewer: string }
        Returns: Json
      }
      _check_day_window: {
        Args: { _day: string; _user_id: string }
        Returns: undefined
      }
      _habit_completion: {
        Args: { _detail: Json; _kind: string; _target: number; _value: number }
        Returns: number
      }
      _local_today: { Args: { _user_id: string }; Returns: string }
      _rank_rows: {
        Args: {
          _country: string
          _day: string
          _period: string
          _scope: string
          _sid: string
          _viewer: string
        }
        Returns: {
          entity: string
          joined: string
          points: number
          rnk: number
          streak: number
        }[]
      }
      _recompute_with_crew: {
        Args: { _day: string; _season_id: string; _user_id: string }
        Returns: undefined
      }
      admin_overview: { Args: never; Returns: Json }
      buddy_action: {
        Args: { _action: string; _target: string }
        Returns: undefined
      }
      buddy_directory: {
        Args: { _search?: string; _season_id: string }
        Returns: Json
      }
      checkin_upsert: {
        Args: {
          _day?: string
          _detail?: Json
          _user_habit_id: string
          _value: number
        }
        Returns: Json
      }
      create_crew: {
        Args: { _kind: string; _max_members: number; _name: string }
        Returns: string
      }
      crew_activity: { Args: { _crew_id: string }; Returns: Json }
      crew_details: { Args: { _crew_id: string }; Returns: Json }
      crew_today: { Args: { _crew_id: string }; Returns: Json }
      delete_my_account: { Args: never; Returns: undefined }
      handle_available: { Args: { _handle: string }; Returns: boolean }
      join_crew: { Args: { _code: string }; Returns: string }
      join_season: {
        Args: { _mode?: string; _season_id: string }
        Returns: undefined
      }
      leaderboard: {
        Args: {
          _country_code?: string
          _period: string
          _scope: string
          _season_id: string
        }
        Returns: Json
      }
      leave_crew: { Args: { _crew_id: string }; Returns: undefined }
      participating_countries: { Args: never; Returns: number }
      post_daily_proof: {
        Args: { _path: string; _season_id: string }
        Returns: Json
      }
      profile_summary: {
        Args: { _season_id: string; _share?: boolean }
        Returns: Json
      }
      recompute_day: {
        Args: { _day: string; _season_id: string; _user_id: string }
        Returns: undefined
      }
      scoreboard: {
        Args: {
          _country_code?: string
          _period: string
          _scope: string
          _season_id: string
        }
        Returns: Json
      }
      send_nudge: { Args: { _to_user: string }; Returns: boolean }
      set_chaos_done: {
        Args: { _day?: string; _done: boolean; _season_id: string }
        Returns: Json
      }
      solo_ghost: { Args: { _season_id: string }; Returns: Json }
      spin_daily_chaos: { Args: { _season_id: string }; Returns: Json }
      today_habit_points: {
        Args: { _day: string; _season_id: string }
        Returns: Json
      }
      toggle_respect: { Args: { _checkin_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
