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
      admin_bootstrap_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      channels: {
        Row: {
          country_code: string | null
          country_name: string | null
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["channel_kind"]
          name: string
          official_site: string | null
          timezone: string | null
          tvmaze_id: number
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["channel_kind"]
          name: string
          official_site?: string | null
          timezone?: string | null
          tvmaze_id: number
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["channel_kind"]
          name?: string
          official_site?: string | null
          timezone?: string | null
          tvmaze_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      episode_ratings: {
        Row: {
          episode_id: number
          fetched_at: string
          provider: string
          scale: number
          value: number
          vote_count: number | null
        }
        Insert: {
          episode_id: number
          fetched_at?: string
          provider: string
          scale?: number
          value: number
          vote_count?: number | null
        }
        Update: {
          episode_id?: number
          fetched_at?: string
          provider?: string
          scale?: number
          value?: number
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_ratings_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          airdate: string | null
          airstamp: string | null
          airtime: string | null
          created_at: string
          id: number
          image_medium: string | null
          image_original: string | null
          name: string | null
          number: number | null
          runtime: number | null
          season: number
          show_id: number
          summary_html: string | null
          synced_at: string
          tvmaze_id: number
          tvmaze_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          airdate?: string | null
          airstamp?: string | null
          airtime?: string | null
          created_at?: string
          id?: never
          image_medium?: string | null
          image_original?: string | null
          name?: string | null
          number?: number | null
          runtime?: number | null
          season: number
          show_id: number
          summary_html?: string | null
          synced_at?: string
          tvmaze_id: number
          tvmaze_url?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          airdate?: string | null
          airstamp?: string | null
          airtime?: string | null
          created_at?: string
          id?: never
          image_medium?: string | null
          image_original?: string | null
          name?: string | null
          number?: number | null
          runtime?: number | null
          season?: number
          show_id?: number
          summary_html?: string | null
          synced_at?: string
          tvmaze_id?: number
          tvmaze_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          episode_id: number | null
          id: number
          push_sent_at: string | null
          read_at: string | null
          show_id: number | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          episode_id?: number | null
          id?: never
          push_sent_at?: string | null
          read_at?: string | null
          show_id?: number | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          episode_id?: number | null
          id?: never
          push_sent_at?: string | null
          read_at?: string | null
          show_id?: number | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          airing_digest_hour: number
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          notify_in_app: boolean
          notify_push: boolean
          role: Database["public"]["Enums"]["app_role"]
          timezone: string
          updated_at: string
        }
        Insert: {
          airing_digest_hour?: number
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          notify_in_app?: boolean
          notify_push?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          airing_digest_hour?: number
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          notify_in_app?: boolean
          notify_push?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failed_at: string | null
          id: number
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failed_at?: string | null
          id?: never
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failed_at?: string | null
          id?: never
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
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
      show_external_ids: {
        Row: {
          created_at: string
          external_id: string
          provider: string
          show_id: number
        }
        Insert: {
          created_at?: string
          external_id: string
          provider: string
          show_id: number
        }
        Update: {
          created_at?: string
          external_id?: string
          provider?: string
          show_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_external_ids_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_ratings: {
        Row: {
          fetched_at: string
          provider: string
          scale: number
          show_id: number
          value: number
          vote_count: number | null
        }
        Insert: {
          fetched_at?: string
          provider: string
          scale?: number
          show_id: number
          value: number
          vote_count?: number | null
        }
        Update: {
          fetched_at?: string
          provider?: string
          scale?: number
          show_id?: number
          value?: number
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "show_ratings_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          average_runtime: number | null
          created_at: string
          dvd_country_code: string | null
          ended: string | null
          episodes_synced_at: string | null
          genres: string[]
          id: number
          image_medium: string | null
          image_original: string | null
          language: string | null
          name: string
          network_id: number | null
          official_site: string | null
          premiered: string | null
          runtime: number | null
          schedule_days: string[]
          schedule_time: string | null
          search: unknown
          status: string | null
          summary_html: string | null
          synced_at: string
          tvmaze_id: number
          tvmaze_updated_at: string | null
          tvmaze_url: string | null
          type: string | null
          updated_at: string
          web_channel_id: number | null
          weight: number
        }
        Insert: {
          average_runtime?: number | null
          created_at?: string
          dvd_country_code?: string | null
          ended?: string | null
          episodes_synced_at?: string | null
          genres?: string[]
          id?: never
          image_medium?: string | null
          image_original?: string | null
          language?: string | null
          name: string
          network_id?: number | null
          official_site?: string | null
          premiered?: string | null
          runtime?: number | null
          schedule_days?: string[]
          schedule_time?: string | null
          search?: unknown
          status?: string | null
          summary_html?: string | null
          synced_at?: string
          tvmaze_id: number
          tvmaze_updated_at?: string | null
          tvmaze_url?: string | null
          type?: string | null
          updated_at?: string
          web_channel_id?: number | null
          weight?: number
        }
        Update: {
          average_runtime?: number | null
          created_at?: string
          dvd_country_code?: string | null
          ended?: string | null
          episodes_synced_at?: string | null
          genres?: string[]
          id?: never
          image_medium?: string | null
          image_original?: string | null
          language?: string | null
          name?: string
          network_id?: number | null
          official_site?: string | null
          premiered?: string | null
          runtime?: number | null
          schedule_days?: string[]
          schedule_time?: string | null
          search?: unknown
          status?: string | null
          summary_html?: string | null
          synced_at?: string
          tvmaze_id?: number
          tvmaze_updated_at?: string | null
          tvmaze_url?: string | null
          type?: string | null
          updated_at?: string
          web_channel_id?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "shows_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_web_channel_id_fkey"
            columns: ["web_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          attempts: number
          created_at: string
          id: number
          job_type: Database["public"]["Enums"]["sync_job_type"]
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          run_after: string
          status: Database["public"]["Enums"]["sync_status"]
          triggered_by: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: never
          job_type: Database["public"]["Enums"]["sync_job_type"]
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          run_after?: string
          status?: Database["public"]["Enums"]["sync_status"]
          triggered_by?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: never
          job_type?: Database["public"]["Enums"]["sync_job_type"]
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          run_after?: string
          status?: Database["public"]["Enums"]["sync_status"]
          triggered_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          error: string | null
          finished_at: string
          id: number
          job_id: number | null
          job_type: Database["public"]["Enums"]["sync_job_type"]
          started_at: string
          stats: Json
          status: Database["public"]["Enums"]["sync_status"]
          worker: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string
          id?: never
          job_id?: number | null
          job_type: Database["public"]["Enums"]["sync_job_type"]
          started_at: string
          stats?: Json
          status: Database["public"]["Enums"]["sync_status"]
          worker?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string
          id?: never
          job_id?: number | null
          job_type?: Database["public"]["Enums"]["sync_job_type"]
          started_at?: string
          stats?: Json
          status?: Database["public"]["Enums"]["sync_status"]
          worker?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sync_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shows: {
        Row: {
          added_at: string
          notes: string | null
          notify: boolean
          rating: number | null
          show_id: number
          status: Database["public"]["Enums"]["user_show_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          notes?: string | null
          notify?: boolean
          rating?: number | null
          show_id: number
          status?: Database["public"]["Enums"]["user_show_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          notes?: string | null
          notify?: boolean
          rating?: number | null
          show_id?: number
          status?: Database["public"]["Enums"]["user_show_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_shows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      admin_enqueue_sync: {
        Args: {
          p_job_type: Database["public"]["Enums"]["sync_job_type"]
          p_payload?: Json
        }
        Returns: number
      }
      admin_shows: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          episodes_synced_at: string
          followers: number
          id: number
          image_medium: string
          name: string
          premiered: string
          status: string
          synced_at: string
          tvmaze_id: number
          tvmaze_updated_at: string
        }[]
      }
      admin_set_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      claim_sync_jobs: {
        Args: { p_limit?: number; p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          id: number
          job_type: Database["public"]["Enums"]["sync_job_type"]
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          run_after: string
          status: Database["public"]["Enums"]["sync_status"]
          triggered_by: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_sync_job: {
        Args: {
          p_error?: string
          p_job_id: number
          p_ok: boolean
          p_stats?: Json
        }
        Returns: undefined
      }
      create_airing_today_notifications: { Args: never; Returns: number }
      create_new_episode_notifications: {
        Args: { p_episode_ids: number[] }
        Returns: number
      }
      enqueue_nightly_sync: { Args: never; Returns: undefined }
      enqueue_sync_job: {
        Args: {
          p_job_type: Database["public"]["Enums"]["sync_job_type"]
          p_payload?: Json
          p_priority?: number
          p_run_after?: string
          p_triggered_by?: string
        }
        Returns: number
      }
      invoke_edge_function: {
        Args: { p_body?: Json; p_name: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notifications_read: { Args: { p_ids: number[] }; Returns: undefined }
      match_show_candidates: {
        Args: { p_limit?: number; p_names: string[] }
        Returns: {
          id: number
          image_medium: string
          is_exact: boolean
          name: string
          network_name: string
          premiered: string
          query_name: string
          rating: number
          score: number
          status: string
          tvmaze_id: number
          type: string
        }[]
      }
      mark_show_episodes_synced: {
        Args: { p_tvmaze_id: number }
        Returns: undefined
      }
      my_upcoming_episodes: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          airstamp: string
          episode_id: number
          episode_name: string
          number: number
          runtime: number
          season: number
          show_id: number
          show_image: string
          show_name: string
          status: Database["public"]["Enums"]["user_show_status"]
        }[]
      }
      release_stale_sync_jobs: {
        Args: { p_older_than?: string }
        Returns: number
      }
      search_shows: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          genres: string[]
          id: number
          image_medium: string
          language: string
          name: string
          network_name: string
          premiered: string
          rank: number
          rating: number
          status: string
          tvmaze_id: number
          type: string
        }[]
      }
      stale_shows: {
        Args: { p_updates: Json }
        Returns: {
          episodes_synced: boolean
          tvmaze_id: number
        }[]
      }
      text_array_to_text: { Args: { arr: string[] }; Returns: string }
      tick_push_dispatch: { Args: never; Returns: undefined }
      tick_sync_worker: { Args: never; Returns: undefined }
      upsert_channels: { Args: { p_rows: Json }; Returns: number }
      upsert_episodes: { Args: { p_rows: Json }; Returns: Json }
      upsert_shows: { Args: { p_rows: Json }; Returns: Json }
    }
    Enums: {
      app_role: "user" | "admin"
      channel_kind: "network" | "web_channel"
      notification_type: "new_episode" | "airing_today" | "show_status_changed"
      sync_job_type:
        | "catalog_page"
        | "full_schedule"
        | "show_updates"
        | "show_refresh"
        | "show_episodes"
      sync_status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      user_show_status: "watching" | "completed" | "dropped" | "plan_to_watch"
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
      app_role: ["user", "admin"],
      channel_kind: ["network", "web_channel"],
      notification_type: ["new_episode", "airing_today", "show_status_changed"],
      sync_job_type: [
        "catalog_page",
        "full_schedule",
        "show_updates",
        "show_refresh",
        "show_episodes",
      ],
      sync_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      user_show_status: ["watching", "completed", "dropped", "plan_to_watch"],
    },
  },
} as const
