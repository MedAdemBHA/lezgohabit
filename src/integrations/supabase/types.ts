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
      buddy_requests: {
        Row: {
          created_at: string
          crew_id: string | null
          from_user: string
          id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          crew_id?: string | null
          from_user: string
          id?: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          crew_id?: string | null
          from_user?: string
          id?: string
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_requests_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_safety_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter: string
          target: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter: string
          target: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_safety_reports_reporter_fkey"
            columns: ["reporter"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_safety_reports_target_fkey"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          detox_points: number
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
          detox_points?: number
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
          detox_points?: number
          lift_prs?: number
          proof_path?: string | null
          proof_posted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      detox_duels: {
        Row: {
          a: string
          a_avg_min: number | null
          b: string
          b_avg_min: number | null
          id: string
          status: string
          week_start: string
        }
        Insert: {
          a: string
          a_avg_min?: number | null
          b: string
          b_avg_min?: number | null
          id?: string
          status?: string
          week_start: string
        }
        Update: {
          a?: string
          a_avg_min?: number | null
          b?: string
          b_avg_min?: number | null
          id?: string
          status?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "detox_duels_a_fkey"
            columns: ["a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detox_duels_b_fkey"
            columns: ["b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      detox_sessions: {
        Row: {
          completed: boolean
          day: string
          ended_at: string | null
          id: string
          last_seen_at: string
          minutes: number
          season_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          day: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          minutes: number
          season_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          day?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          minutes?: number
          season_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detox_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detox_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      lift_exercises: {
        Row: {
          equipment: string
          id: string
          key: string
          name: Json
          sort: number
        }
        Insert: {
          equipment: string
          id?: string
          key: string
          name: Json
          sort?: number
        }
        Update: {
          equipment?: string
          id?: string
          key?: string
          name?: Json
          sort?: number
        }
        Relationships: []
      }
      lift_sets: {
        Row: {
          created_at: string
          day: string
          exercise_id: string
          id: string
          is_demo: boolean
          reps: number
          result: string
          unit: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          day: string
          exercise_id: string
          id?: string
          is_demo?: boolean
          reps: number
          result?: string
          unit?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          day?: string
          exercise_id?: string
          id?: string
          is_demo?: boolean
          reps?: number
          result?: string
          unit?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lift_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "lift_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lift_sets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      post_hides: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hides_author_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hides_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_author_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          created_at: string
          crew_id: string | null
          day: string
          habit_key: string | null
          hidden: boolean
          id: string
          image_url: string | null
          is_demo: boolean
          season_id: string
          stats: Json
          type: string
          user_id: string
          visibility: string
        }
        Insert: {
          body?: string
          created_at?: string
          crew_id?: string | null
          day: string
          habit_key?: string | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          is_demo?: boolean
          season_id: string
          stats?: Json
          type: string
          user_id: string
          visibility?: string
        }
        Update: {
          body?: string
          created_at?: string
          crew_id?: string | null
          day?: string
          habit_key?: string | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          is_demo?: boolean
          season_id?: string
          stats?: Json
          type?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          country_code: string
          created_at: string
          display_name: string
          equipment: string[]
          faith_public: boolean
          gender: string | null
          handle: string
          id: string
          is_admin: boolean
          language: string
          max_dumbbell_kg: number
          notif_crew: boolean
          notif_daily: boolean
          onboarded: boolean
          show_on_public_board: boolean
          timezone: string
          units: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          equipment?: string[]
          faith_public?: boolean
          gender?: string | null
          handle: string
          id: string
          is_admin?: boolean
          language?: string
          max_dumbbell_kg?: number
          notif_crew?: boolean
          notif_daily?: boolean
          onboarded?: boolean
          show_on_public_board?: boolean
          timezone?: string
          units?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          equipment?: string[]
          faith_public?: boolean
          gender?: string | null
          handle?: string
          id?: string
          is_admin?: boolean
          language?: string
          max_dumbbell_kg?: number
          notif_crew?: boolean
          notif_daily?: boolean
          onboarded?: boolean
          show_on_public_board?: boolean
          timezone?: string
          units?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          post_id: string
          reason: string
          reporter: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reason: string
          reporter: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reason?: string
          reporter?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_author_profile"
            columns: ["reporter"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
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
      screen_time_logs: {
        Row: {
          day: string
          proof_url: string
          social_minutes: number
          user_id: string
        }
        Insert: {
          day: string
          proof_url: string
          social_minutes: number
          user_id: string
        }
        Update: {
          day?: string
          proof_url?: string
          social_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      season_reminders: {
        Row: {
          season_slug: string
          user_id: string
        }
        Insert: {
          season_slug: string
          user_id: string
        }
        Update: {
          season_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_reminders_season_slug_fkey"
            columns: ["season_slug"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "season_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_trophies: {
        Row: {
          awarded_at: string
          season_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          season_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_trophies_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_trophies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_preferences: {
        Row: {
          boss_alerts: boolean
          daily_time: string
          distance_unit: string
          equipment: string[]
          max_dumbbell: number
          prayer_enabled: boolean
          prayer_method: number
          prayer_reminder: boolean
          user_id: string
        }
        Insert: {
          boss_alerts?: boolean
          daily_time?: string
          distance_unit?: string
          equipment?: string[]
          max_dumbbell?: number
          prayer_enabled?: boolean
          prayer_method?: number
          prayer_reminder?: boolean
          user_id: string
        }
        Update: {
          boss_alerts?: boolean
          daily_time?: string
          distance_unit?: string
          equipment?: string[]
          max_dumbbell?: number
          prayer_enabled?: boolean
          prayer_method?: number
          prayer_reminder?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_author_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      _rank_rows_metric: {
        Args: {
          _country: string
          _day: string
          _metric: string
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
      buddy_matches: {
        Args: {
          _gender?: boolean
          _goals?: boolean
          _language?: boolean
          _season_id: string
          _timezone?: boolean
        }
        Returns: Json
      }
      can_read_post: { Args: { _id: string }; Returns: boolean }
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
      create_post: {
        Args: {
          _body?: string
          _habit_key?: string
          _image_url?: string
          _season_id: string
          _stats?: Json
          _type: string
          _visibility?: string
        }
        Returns: string
      }
      crew_activity: { Args: { _crew_id: string }; Returns: Json }
      crew_details: { Args: { _crew_id: string }; Returns: Json }
      crew_today: { Args: { _crew_id: string }; Returns: Json }
      delete_my_account: { Args: never; Returns: undefined }
      detox_action: {
        Args: { _action: string; _minutes?: number; _session?: string }
        Returns: Json
      }
      detox_duel_action: {
        Args: { _action: string; _target: string }
        Returns: undefined
      }
      detox_overview: { Args: never; Returns: Json }
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
      log_lift: {
        Args: {
          _exercise: string
          _reps: number
          _unit?: string
          _weight: number
        }
        Returns: Json
      }
      log_lift_session: { Args: { _sets: Json }; Returns: Json }
      log_screen_time: {
        Args: { _minutes: number; _path: string }
        Returns: undefined
      }
      participating_countries: { Args: never; Returns: number }
      post_action: {
        Args: { _action: string; _post_id: string; _reason?: string }
        Returns: undefined
      }
      post_daily_proof: {
        Args: { _path: string; _season_id: string }
        Returns: Json
      }
      profile_summary: {
        Args: { _season_id: string; _share?: boolean }
        Returns: Json
      }
      proof_feed: {
        Args: {
          _before?: string
          _filter?: string
          _scope?: string
          _season_id: string
        }
        Returns: Json
      }
      react_post: {
        Args: { _kind: string; _post_id: string }
        Returns: undefined
      }
      recompute_day: {
        Args: { _day: string; _season_id: string; _user_id: string }
        Returns: undefined
      }
      report_buddy: {
        Args: { _reason: string; _target: string }
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
      scoreboard_v4: {
        Args: {
          _country_code?: string
          _metric?: string
          _period: string
          _scope: string
          _season_id: string
        }
        Returns: Json
      }
      scoring_preview: {
        Args: {
          _chaos: boolean
          _crew: boolean
          _done: number
          _lift: number
          _picked: number
          _proof: boolean
          _streak: number
        }
        Returns: Json
      }
      send_nudge: { Args: { _to_user: string }; Returns: boolean }
      set_chaos_done: {
        Args: { _day?: string; _done: boolean; _season_id: string }
        Returns: Json
      }
      set_season_reminder: {
        Args: { _on: boolean; _slug: string }
        Returns: undefined
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
