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
      activity_events: {
        Row: {
          created_at: string
          device_key: string | null
          id: string
          is_demo: boolean
          kind: string
          network_key: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_key?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          network_key?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_key?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          network_key?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          payload: Json
          target: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          payload?: Json
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          payload?: Json
          target?: string | null
        }
        Relationships: []
      }
      admin_feature_flags: {
        Row: {
          enabled: boolean
          key: string
        }
        Insert: {
          enabled?: boolean
          key: string
        }
        Update: {
          enabled?: boolean
          key?: string
        }
        Relationships: []
      }
      admin_streak_resets: {
        Row: {
          day: string
          is_demo: boolean
          reason: string
          season_id: string
          user_id: string
        }
        Insert: {
          day: string
          is_demo?: boolean
          reason: string
          season_id: string
          user_id: string
        }
        Update: {
          day?: string
          is_demo?: boolean
          reason?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_streak_resets_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_suspicious_activity: {
        Row: {
          created_at: string
          day: string | null
          detail: Json
          id: string
          is_demo: boolean
          kind: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string | null
          detail?: Json
          id?: string
          is_demo?: boolean
          kind: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string | null
          detail?: Json
          id?: string
          is_demo?: boolean
          kind?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_word_filters: {
        Row: {
          enabled: boolean
          id: string
          language: string
          word: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          language: string
          word: string
        }
        Update: {
          enabled?: boolean
          id?: string
          language?: string
          word?: string
        }
        Relationships: []
      }
      announcement_receipts: {
        Row: {
          announcement_id: string
          is_demo: boolean
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          is_demo?: boolean
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          is_demo?: boolean
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_receipts_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: Json
          country: string | null
          id: string
          is_demo: boolean
          language: string | null
          scheduled_at: string
          season_id: string | null
          title: Json
        }
        Insert: {
          body: Json
          country?: string | null
          id?: string
          is_demo?: boolean
          language?: string | null
          scheduled_at?: string
          season_id?: string | null
          title: Json
        }
        Update: {
          body?: Json
          country?: string | null
          id?: string
          is_demo?: boolean
          language?: string | null
          scheduled_at?: string
          season_id?: string | null
          title?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          awarded_at: string
          is_demo: boolean
          key: string
          season_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          is_demo?: boolean
          key: string
          season_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          is_demo?: boolean
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
      bonus_points: {
        Row: {
          awarded_at: string
          boss_id: string
          id: string
          is_demo: boolean
          level: string
          points: number
          season_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          boss_id: string
          id?: string
          is_demo?: boolean
          level: string
          points: number
          season_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          boss_id?: string
          id?: string
          is_demo?: boolean
          level?: string
          points?: number
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_points_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "bosses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boss_entries: {
        Row: {
          boss_id: string
          completed_at: string | null
          is_demo: boolean
          level: string
          progress: number
          user_id: string
        }
        Insert: {
          boss_id: string
          completed_at?: string | null
          is_demo?: boolean
          level?: string
          progress?: number
          user_id: string
        }
        Update: {
          boss_id?: string
          completed_at?: string | null
          is_demo?: boolean
          level?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_entries_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "bosses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boss_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boss_hits: {
        Row: {
          amount: number
          boss_id: string
          created_at: string
          id: string
          is_demo: boolean
          part: string | null
          user_id: string
        }
        Insert: {
          amount: number
          boss_id: string
          created_at?: string
          id?: string
          is_demo?: boolean
          part?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          boss_id?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          part?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_hits_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "bosses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boss_hits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bosses: {
        Row: {
          archived: boolean
          color: string
          ends_at: string
          exercise_key: string | null
          id: string
          is_demo: boolean
          levels: Json
          metric: string
          name: Json
          rule: Json
          season_id: string
          slug: string
          sponsor: string | null
          starts_at: string
          week_no: number
        }
        Insert: {
          archived?: boolean
          color?: string
          ends_at: string
          exercise_key?: string | null
          id?: string
          is_demo?: boolean
          levels: Json
          metric: string
          name: Json
          rule: Json
          season_id: string
          slug: string
          sponsor?: string | null
          starts_at: string
          week_no: number
        }
        Update: {
          archived?: boolean
          color?: string
          ends_at?: string
          exercise_key?: string | null
          id?: string
          is_demo?: boolean
          levels?: Json
          metric?: string
          name?: Json
          rule?: Json
          season_id?: string
          slug?: string
          sponsor?: string | null
          starts_at?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "bosses_season_id_fkey"
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
          is_demo: boolean
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          is_demo?: boolean
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          is_demo?: boolean
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
          is_demo: boolean
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          crew_id?: string | null
          from_user: string
          id?: string
          is_demo?: boolean
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          crew_id?: string | null
          from_user?: string
          id?: string
          is_demo?: boolean
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
          is_demo: boolean
          reason: string
          reporter: string
          target: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          reason: string
          reporter: string
          target: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
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
      capsules: {
        Row: {
          audio_url: string | null
          body: string
          is_demo: boolean
          opens_on: string
          sealed_at: string
          season_id: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          body?: string
          is_demo?: boolean
          opens_on: string
          sealed_at?: string
          season_id: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          body?: string
          is_demo?: boolean
          opens_on?: string
          sealed_at?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capsules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_squad_members: {
        Row: {
          is_demo: boolean
          squad_id: string
          user_id: string
        }
        Insert: {
          is_demo?: boolean
          squad_id: string
          user_id: string
        }
        Update: {
          is_demo?: boolean
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "challenge_squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_squad_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_squads: {
        Row: {
          challenge_id: string
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          challenge_id: string
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          challenge_id?: string
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_squads_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          approved: boolean
          archived: boolean
          audience: string
          code: string
          created_at: string
          crew_id: string | null
          days: number
          faith_allowed: boolean
          featured: boolean
          habit_keys: string[]
          id: string
          is_demo: boolean
          name: string
          owner_id: string
          public_board: boolean
          same_habits: boolean
          season_id: string
          starts_on: string
          template: string
          weekly_bosses: boolean
        }
        Insert: {
          approved?: boolean
          archived?: boolean
          audience: string
          code: string
          created_at?: string
          crew_id?: string | null
          days: number
          faith_allowed?: boolean
          featured?: boolean
          habit_keys?: string[]
          id?: string
          is_demo?: boolean
          name: string
          owner_id: string
          public_board?: boolean
          same_habits?: boolean
          season_id: string
          starts_on: string
          template: string
          weekly_bosses?: boolean
        }
        Update: {
          approved?: boolean
          archived?: boolean
          audience?: string
          code?: string
          created_at?: string
          crew_id?: string | null
          days?: number
          faith_allowed?: boolean
          featured?: boolean
          habit_keys?: string[]
          id?: string
          is_demo?: boolean
          name?: string
          owner_id?: string
          public_board?: boolean
          same_habits?: boolean
          season_id?: string
          starts_on?: string
          template?: string
          weekly_bosses?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "challenges_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_events: {
        Row: {
          at: string
          day: string
          id: number
          is_demo: boolean
          new_detail: Json | null
          new_value: number | null
          old_detail: Json | null
          old_value: number | null
          user_habit_id: string
          user_id: string
        }
        Insert: {
          at?: string
          day: string
          id?: never
          is_demo?: boolean
          new_detail?: Json | null
          new_value?: number | null
          old_detail?: Json | null
          old_value?: number | null
          user_habit_id: string
          user_id: string
        }
        Update: {
          at?: string
          day?: string
          id?: never
          is_demo?: boolean
          new_detail?: Json | null
          new_value?: number | null
          old_detail?: Json | null
          old_value?: number | null
          user_habit_id?: string
          user_id?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          created_at: string
          day: string
          detail: Json | null
          id: string
          is_demo: boolean
          user_habit_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          day: string
          detail?: Json | null
          id?: string
          is_demo?: boolean
          user_habit_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          day?: string
          detail?: Json | null
          id?: string
          is_demo?: boolean
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
      creator_referrals: {
        Row: {
          code: string
          featured: boolean
          id: string
          is_demo: boolean
          signups: number
          user_id: string
        }
        Insert: {
          code: string
          featured?: boolean
          id?: string
          is_demo?: boolean
          signups?: number
          user_id: string
        }
        Update: {
          code?: string
          featured?: boolean
          id?: string
          is_demo?: boolean
          signups?: number
          user_id?: string
        }
        Relationships: []
      }
      crew_members: {
        Row: {
          crew_id: string
          is_demo: boolean
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          crew_id: string
          is_demo?: boolean
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          is_demo?: boolean
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
      crew_results: {
        Row: {
          corrected_at: string | null
          crew_id: string
          frozen_at: string
          is_demo: boolean
          members: number
          name: string
          rank: number
          score: number
          season_id: string
        }
        Insert: {
          corrected_at?: string | null
          crew_id: string
          frozen_at?: string
          is_demo?: boolean
          members: number
          name: string
          rank: number
          score: number
          season_id: string
        }
        Update: {
          corrected_at?: string | null
          crew_id?: string
          frozen_at?: string
          is_demo?: boolean
          members?: number
          name?: string
          rank?: number
          score?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          archived: boolean
          code: string
          created_at: string
          id: string
          is_demo: boolean
          is_public: boolean
          kind: string
          max_members: number
          member_capacity: number
          name: string
          owner_id: string
          season_id: string
        }
        Insert: {
          archived?: boolean
          code: string
          created_at?: string
          id?: string
          is_demo?: boolean
          is_public?: boolean
          kind?: string
          max_members?: number
          member_capacity?: number
          name: string
          owner_id: string
          season_id: string
        }
        Update: {
          archived?: boolean
          code?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          is_public?: boolean
          kind?: string
          max_members?: number
          member_capacity?: number
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
          finalized_at: string | null
          habit_points: number
          is_demo: boolean
          multiplier: number
          perfect: boolean
          season_id: string
          shield_used: boolean
          stack_points: number
          streak: number
          total: number
          tz: string | null
          user_id: string
        }
        Insert: {
          comeback?: boolean
          completion?: number
          crew_sync?: boolean
          day: string
          finalized_at?: string | null
          habit_points?: number
          is_demo?: boolean
          multiplier?: number
          perfect?: boolean
          season_id: string
          shield_used?: boolean
          stack_points?: number
          streak?: number
          total?: number
          tz?: string | null
          user_id: string
        }
        Update: {
          comeback?: boolean
          completion?: number
          crew_sync?: boolean
          day?: string
          finalized_at?: string | null
          habit_points?: number
          is_demo?: boolean
          multiplier?: number
          perfect?: boolean
          season_id?: string
          shield_used?: boolean
          stack_points?: number
          streak?: number
          total?: number
          tz?: string | null
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
      day_closes: {
        Row: {
          created_at: string
          day: string
          is_demo: boolean
          mood: string
          tomorrow: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          is_demo?: boolean
          mood: string
          tomorrow?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          is_demo?: boolean
          mood?: string
          tomorrow?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_closes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          is_demo: boolean
          lift_prs: number
          proof_path: string | null
          proof_post_id: string | null
          proof_posted: boolean
          user_id: string
        }
        Insert: {
          chaos_done?: boolean
          chaos_index?: number | null
          chaos_spins?: number
          day: string
          detox_points?: number
          is_demo?: boolean
          lift_prs?: number
          proof_path?: string | null
          proof_post_id?: string | null
          proof_posted?: boolean
          user_id: string
        }
        Update: {
          chaos_done?: boolean
          chaos_index?: number | null
          chaos_spins?: number
          day?: string
          detox_points?: number
          is_demo?: boolean
          lift_prs?: number
          proof_path?: string | null
          proof_post_id?: string | null
          proof_posted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      demo_login_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
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
          is_demo: boolean
          status: string
          week_start: string
        }
        Insert: {
          a: string
          a_avg_min?: number | null
          b: string
          b_avg_min?: number | null
          id?: string
          is_demo?: boolean
          status?: string
          week_start: string
        }
        Update: {
          a?: string
          a_avg_min?: number | null
          b?: string
          b_avg_min?: number | null
          id?: string
          is_demo?: boolean
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
          is_demo: boolean
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
          is_demo?: boolean
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
          is_demo?: boolean
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
          archived: boolean
          category: string
          color: string | null
          default_target: number
          description: Json
          icon: string
          id: string
          is_demo: boolean
          is_faith: boolean
          key: string
          kind: string
          name: Json
          sort: number
          unit: string | null
        }
        Insert: {
          archived?: boolean
          category: string
          color?: string | null
          default_target?: number
          description: Json
          icon: string
          id?: string
          is_demo?: boolean
          is_faith?: boolean
          key: string
          kind: string
          name: Json
          sort?: number
          unit?: string | null
        }
        Update: {
          archived?: boolean
          category?: string
          color?: string | null
          default_target?: number
          description?: Json
          icon?: string
          id?: string
          is_demo?: boolean
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
          is_demo: boolean
          key: string
          name: Json
          sort: number
        }
        Insert: {
          equipment: string
          id?: string
          is_demo?: boolean
          key: string
          name: Json
          sort?: number
        }
        Update: {
          equipment?: string
          id?: string
          is_demo?: boolean
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
      moment_reminders: {
        Row: {
          day: string
          due_at: string
          is_demo: boolean
          read_at: string | null
          user_id: string
        }
        Insert: {
          day: string
          due_at: string
          is_demo?: boolean
          read_at?: string | null
          user_id: string
        }
        Update: {
          day?: string
          due_at?: string
          is_demo?: boolean
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moment_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moments_seen: {
        Row: {
          created_at: string
          is_demo: boolean
          key: string
          season_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_demo?: boolean
          key: string
          season_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_demo?: boolean
          key?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moments_seen_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_seen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          enabled: Json
          push_enabled: boolean
          user_id: string
        }
        Insert: {
          enabled?: Json
          push_enabled?: boolean
          user_id: string
        }
        Update: {
          enabled?: Json
          push_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rank_state: {
        Row: {
          day: string
          rank: number
          season_id: string
          user_id: string
        }
        Insert: {
          day: string
          rank: number
          season_id: string
          user_id: string
        }
        Update: {
          day?: string
          rank?: number
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rank_state_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rank_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          created_at: string
          event_key: string
          id: string
          next_attempt_at: string
          push_sent_at: string | null
          read_at: string | null
          type: string
          url: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_key: string
          id?: string
          next_attempt_at?: string
          push_sent_at?: string | null
          read_at?: string | null
          type: string
          url?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_key?: string
          id?: string
          next_attempt_at?: string
          push_sent_at?: string | null
          read_at?: string | null
          type?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
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
          is_demo: boolean
          to_user: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          day: string
          from_user: string
          is_demo?: boolean
          to_user: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          day?: string
          from_user?: string
          is_demo?: boolean
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
          is_demo: boolean
          post_id: string
          user_id: string
        }
        Insert: {
          is_demo?: boolean
          post_id: string
          user_id: string
        }
        Update: {
          is_demo?: boolean
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
          is_demo: boolean
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_demo?: boolean
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_demo?: boolean
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
          lesson_seconds: number | null
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
          lesson_seconds?: number | null
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
          lesson_seconds?: number | null
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
      prayer_cache: {
        Row: {
          city: string
          created_at: string
          day: string
          method: number
          times: Json
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          day: string
          method: number
          times: Json
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          day?: string
          method?: number
          times?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          country_code: string
          created_at: string
          demo_today: string | null
          display_name: string
          equipment: string[]
          faith_public: boolean
          gender: string | null
          handle: string
          id: string
          is_admin: boolean
          is_demo: boolean
          language: string
          max_dumbbell_kg: number
          notif_crew: boolean
          notif_daily: boolean
          onboarded: boolean
          pending_timezone: string | null
          pending_timezone_from: string | null
          show_on_public_board: boolean
          timezone: string
          timezone_changed_at: string | null
          units: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          demo_today?: string | null
          display_name?: string
          equipment?: string[]
          faith_public?: boolean
          gender?: string | null
          handle: string
          id: string
          is_admin?: boolean
          is_demo?: boolean
          language?: string
          max_dumbbell_kg?: number
          notif_crew?: boolean
          notif_daily?: boolean
          onboarded?: boolean
          pending_timezone?: string | null
          pending_timezone_from?: string | null
          show_on_public_board?: boolean
          timezone?: string
          timezone_changed_at?: string | null
          units?: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          demo_today?: string | null
          display_name?: string
          equipment?: string[]
          faith_public?: boolean
          gender?: string | null
          handle?: string
          id?: string
          is_admin?: boolean
          is_demo?: boolean
          language?: string
          max_dumbbell_kg?: number
          notif_crew?: boolean
          notif_daily?: boolean
          onboarded?: boolean
          pending_timezone?: string | null
          pending_timezone_from?: string | null
          show_on_public_board?: boolean
          timezone?: string
          timezone_changed_at?: string | null
          units?: string
        }
        Relationships: []
      }
      proof_fingerprints: {
        Row: {
          created_at: string
          fingerprint: string
          is_demo: boolean
          path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          is_demo?: boolean
          path: string
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          is_demo?: boolean
          path?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          is_demo: boolean
          post_id: string
          reason: string
          reporter: string
        }
        Insert: {
          created_at?: string
          is_demo?: boolean
          post_id: string
          reason: string
          reporter: string
        }
        Update: {
          created_at?: string
          is_demo?: boolean
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
          is_demo: boolean
          user_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          is_demo?: boolean
          user_id: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          is_demo?: boolean
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
          is_demo: boolean
          proof_url: string
          social_minutes: number
          user_id: string
        }
        Insert: {
          day: string
          is_demo?: boolean
          proof_url: string
          social_minutes: number
          user_id: string
        }
        Update: {
          day?: string
          is_demo?: boolean
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
          is_demo: boolean
          joined_at: string
          mode: string
          season_id: string
          user_id: string
        }
        Insert: {
          comeback_used?: boolean
          is_demo?: boolean
          joined_at?: string
          mode?: string
          season_id: string
          user_id: string
        }
        Update: {
          comeback_used?: boolean
          is_demo?: boolean
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
          is_demo: boolean
          season_slug: string
          user_id: string
        }
        Insert: {
          is_demo?: boolean
          season_slug: string
          user_id: string
        }
        Update: {
          is_demo?: boolean
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
      season_results: {
        Row: {
          active_days: number
          best_streak: number
          boss_points: number
          corrected_at: string | null
          crew_id: string | null
          daily_points: number
          frozen_at: string
          is_demo: boolean
          perfect_days: number
          rank_country: number
          rank_crew: number | null
          rank_world: number
          score: number
          season_id: string
          trophy: boolean
          user_id: string
        }
        Insert: {
          active_days: number
          best_streak: number
          boss_points: number
          corrected_at?: string | null
          crew_id?: string | null
          daily_points: number
          frozen_at?: string
          is_demo?: boolean
          perfect_days: number
          rank_country: number
          rank_crew?: number | null
          rank_world: number
          score: number
          season_id: string
          trophy: boolean
          user_id: string
        }
        Update: {
          active_days?: number
          best_streak?: number
          boss_points?: number
          corrected_at?: string | null
          crew_id?: string | null
          daily_points?: number
          frozen_at?: string
          is_demo?: boolean
          perfect_days?: number
          rank_country?: number
          rank_crew?: number | null
          rank_world?: number
          score?: number
          season_id?: string
          trophy?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_results_user_id_fkey"
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
          is_demo: boolean
          season_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          is_demo?: boolean
          season_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          is_demo?: boolean
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
          archived: boolean
          challenge_owned: boolean
          ends_on: string
          featured_habits: string[]
          frozen_at: string | null
          id: string
          is_demo: boolean
          name: Json
          slug: string
          starts_on: string
          status: string
          theme_color: string
        }
        Insert: {
          archived?: boolean
          challenge_owned?: boolean
          ends_on: string
          featured_habits?: string[]
          frozen_at?: string | null
          id?: string
          is_demo?: boolean
          name: Json
          slug: string
          starts_on: string
          status?: string
          theme_color?: string
        }
        Update: {
          archived?: boolean
          challenge_owned?: boolean
          ends_on?: string
          featured_habits?: string[]
          frozen_at?: string | null
          id?: string
          is_demo?: boolean
          name?: Json
          slug?: string
          starts_on?: string
          status?: string
          theme_color?: string
        }
        Relationships: []
      }
      time_capsules: {
        Row: {
          is_demo: boolean
          note: string
          season_id: string
          user_id: string
        }
        Insert: {
          is_demo?: boolean
          note: string
          season_id: string
          user_id: string
        }
        Update: {
          is_demo?: boolean
          note?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_capsules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_capsules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_habits: {
        Row: {
          active: boolean
          created_at: string
          custom_name: string | null
          id: string
          is_demo: boolean
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
          is_demo?: boolean
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
          is_demo?: boolean
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
          active_challenge_id: string | null
          boss_alerts: boolean
          daily_time: string
          distance_unit: string
          equipment: string[]
          is_demo: boolean
          max_dumbbell: number
          prayer_enabled: boolean
          prayer_method: number
          prayer_reminder: boolean
          user_id: string
        }
        Insert: {
          active_challenge_id?: string | null
          boss_alerts?: boolean
          daily_time?: string
          distance_unit?: string
          equipment?: string[]
          is_demo?: boolean
          max_dumbbell?: number
          prayer_enabled?: boolean
          prayer_method?: number
          prayer_reminder?: boolean
          user_id: string
        }
        Update: {
          active_challenge_id?: string | null
          boss_alerts?: boolean
          daily_time?: string
          distance_unit?: string
          equipment?: string[]
          is_demo?: boolean
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
          {
            foreignKeyName: "user_preferences_active_challenge_id_fkey"
            columns: ["active_challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          is_demo: boolean
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          is_demo?: boolean
          role: string
          user_id: string
        }
        Update: {
          id?: string
          is_demo?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _account_now: { Args: { _uid: string }; Returns: string }
      _admin_audit: {
        Args: { _action: string; _payload?: Json; _target?: string }
        Returns: undefined
      }
      _award_badges: {
        Args: { _sid: string; _uid: string }
        Returns: undefined
      }
      _best_habit_stat: {
        Args: { _sid: string; _uid: string; _viewer: string }
        Returns: Json
      }
      _caller_is_admin: { Args: never; Returns: boolean }
      _check_day_window: {
        Args: { _day: string; _user_id: string }
        Returns: undefined
      }
      _day_is_final: { Args: { _day: string; _uid: string }; Returns: boolean }
      _effective_tz: { Args: { _uid: string }; Returns: string }
      _final_override: { Args: never; Returns: boolean }
      _finalize_user_day: {
        Args: { _day: string; _sid: string; _uid: string }
        Returns: undefined
      }
      _freeze_season: { Args: { _sid: string }; Returns: undefined }
      _habit_completion: {
        Args: { _detail: Json; _kind: string; _target: number; _value: number }
        Returns: number
      }
      _local_today: { Args: { _user_id: string }; Returns: string }
      _notify: {
        Args: { _key: string; _type: string; _uid: string; _url?: string }
        Returns: undefined
      }
      _proof_is_duplicate: {
        Args: { _path: string; _uid: string }
        Returns: boolean
      }
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
      _require_admin: { Args: never; Returns: string }
      _require_feature: { Args: { _key: string }; Returns: undefined }
      _sync_boss: { Args: { _bid: string; _uid: string }; Returns: undefined }
      _viewer_demo: { Args: never; Returns: boolean }
      activate_challenge: { Args: { _id?: string }; Returns: undefined }
      active_season: { Args: never; Returns: Json }
      admin_action: {
        Args: { _action: string; _payload?: Json; _target?: string }
        Returns: Json
      }
      admin_authorized: { Args: never; Returns: boolean }
      admin_cleanup_account: { Args: { _user: string }; Returns: undefined }
      admin_clear_demo: { Args: never; Returns: Json }
      admin_correct_season_result: {
        Args: {
          _reason: string
          _score: number
          _season: string
          _user: string
        }
        Returns: undefined
      }
      admin_dashboard: {
        Args: {
          _demo?: boolean
          _page?: number
          _search?: string
          _section?: string
          _target?: string
        }
        Returns: Json
      }
      admin_overview: { Args: never; Returns: Json }
      admin_recompute_final_day: {
        Args: { _day: string; _reason: string; _season: string; _user: string }
        Returns: Json
      }
      admin_remove_fake_proof: {
        Args: { _post: string; _reason: string }
        Returns: undefined
      }
      admin_security_presence: {
        Args: { _device: string; _network: string }
        Returns: undefined
      }
      admin_seed_demo: {
        Args: { _people: Json; _replace?: boolean }
        Returns: Json
      }
      app_feature_flags: { Args: never; Returns: Json }
      assign_sub_squad: {
        Args: { _squad: string; _user: string }
        Returns: undefined
      }
      boss_action: {
        Args: {
          _action: string
          _amount?: number
          _boss_id: string
          _level?: string
          _part?: string
        }
        Returns: undefined
      }
      boss_overview: { Args: { _season_id: string }; Returns: Json }
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
      capsule_audio_access: {
        Args: { _path: string; _write?: boolean }
        Returns: boolean
      }
      capsule_read: { Args: { _season_id: string }; Returns: Json }
      challenge_preview: { Args: { _code: string }; Returns: Json }
      checkin_upsert: {
        Args: {
          _day?: string
          _detail?: Json
          _user_habit_id: string
          _value: number
        }
        Returns: Json
      }
      claim_demo_login: { Args: { _key: string }; Returns: boolean }
      claim_moment: {
        Args: { _key: string; _season_id: string }
        Returns: boolean
      }
      claim_notification_pushes: {
        Args: never
        Returns: {
          attempts: number
          created_at: string
          event_key: string
          id: string
          next_attempt_at: string
          push_sent_at: string | null
          read_at: string | null
          type: string
          url: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_my_day: {
        Args: { _mood: string; _tomorrow?: string }
        Returns: undefined
      }
      create_boss_lesson: {
        Args: { _body: string; _boss_id: string; _seconds: number }
        Returns: string
      }
      create_challenge: {
        Args: {
          _audience: string
          _days: number
          _faith_allowed: boolean
          _habit_keys: string[]
          _name: string
          _public_board: boolean
          _same_habits: boolean
          _starts_on?: string
          _template: string
          _weekly_bosses: boolean
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
      create_sub_squad: {
        Args: { _challenge: string; _name: string }
        Returns: string
      }
      crew_activity: { Args: { _crew_id: string }; Returns: Json }
      crew_details: { Args: { _crew_id: string }; Returns: Json }
      crew_today: { Args: { _crew_id: string }; Returns: Json }
      delete_my_account: { Args: never; Returns: undefined }
      demo_reset_day: { Args: never; Returns: undefined }
      detox_action: {
        Args: { _action: string; _minutes?: number; _session?: string }
        Returns: Json
      }
      detox_duel_action: {
        Args: { _action: string; _target: string }
        Returns: undefined
      }
      detox_overview: { Args: never; Returns: Json }
      enqueue_timed_notifications: { Args: never; Returns: number }
      featured_creator_challenges: { Args: never; Returns: Json }
      finalize_due_days: { Args: never; Returns: number }
      freeze_due_seasons: { Args: never; Returns: number }
      handle_available: { Args: { _handle: string }; Returns: boolean }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      hit_boss: {
        Args: { _amount?: number; _boss_id: string; _part?: string }
        Returns: undefined
      }
      integrity_tick: { Args: never; Returns: Json }
      join_challenge: { Args: { _code: string }; Returns: string }
      join_crew: { Args: { _code: string }; Returns: string }
      join_season: {
        Args: { _mode?: string; _season_id: string }
        Returns: undefined
      }
      launch_notification_tick: { Args: never; Returns: number }
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
      my_season_result: { Args: { _season_id: string }; Returns: Json }
      participating_countries: { Args: never; Returns: number }
      post_action: {
        Args: { _action: string; _post_id: string; _reason?: string }
        Returns: undefined
      }
      post_daily_proof: {
        Args: { _path: string; _season_id: string }
        Returns: Json
      }
      post_small_wins: {
        Args: {
          _caption: string
          _language: string
          _season_id: string
          _wins: string[]
        }
        Returns: string
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
      register_proof_fingerprint: {
        Args: { _fingerprint: string; _path: string }
        Returns: undefined
      }
      register_push: {
        Args: { _auth: string; _endpoint: string; _p256dh: string }
        Returns: undefined
      }
      register_saved_proof: {
        Args: { _fingerprint: string; _path: string; _user: string }
        Returns: undefined
      }
      remind_moment: {
        Args: { _read?: boolean; _season_id: string }
        Returns: undefined
      }
      report_buddy: {
        Args: { _reason: string; _target: string }
        Returns: undefined
      }
      reset_boss: { Args: { _boss_id: string }; Returns: undefined }
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
      seal_capsule: {
        Args: { _audio_path?: string; _body?: string; _season_id: string }
        Returns: undefined
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
      signature_overview: { Args: { _season_id: string }; Returns: Json }
      solo_ghost: { Args: { _season_id: string }; Returns: Json }
      spin_daily_chaos: { Args: { _season_id: string }; Returns: Json }
      today_habit_points: {
        Args: { _day: string; _season_id: string }
        Returns: Json
      }
      toggle_respect: { Args: { _checkin_id: string }; Returns: boolean }
      wrapped_summary: { Args: { _season_id: string }; Returns: Json }
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
