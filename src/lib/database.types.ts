export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          metric_key: string | null
          status: Database["public"]["Enums"]["action_status"]
          text: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          metric_key?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          text: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          metric_key?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          text?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          { foreignKeyName: "actions_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "actions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "actions_metric_key_fkey"; columns: ["metric_key"]; isOneToOne: false; referencedRelation: "metrics"; referencedColumns: ["key"] },
          { foreignKeyName: "actions_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      collection_runs: {
        Row: {
          collectors: string[]
          created_at: string
          finished_at: string | null
          id: string
          requested_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          summary: Json
          trigger: Database["public"]["Enums"]["run_trigger"]
          workspace_id: string
        }
        Insert: {
          collectors?: string[]
          created_at?: string
          finished_at?: string | null
          id?: string
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          summary?: Json
          trigger: Database["public"]["Enums"]["run_trigger"]
          workspace_id: string
        }
        Update: {
          collectors?: string[]
          created_at?: string
          finished_at?: string | null
          id?: string
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          summary?: Json
          trigger?: Database["public"]["Enums"]["run_trigger"]
          workspace_id?: string
        }
        Relationships: [
          { foreignKeyName: "collection_runs_requested_by_fkey"; columns: ["requested_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "collection_runs_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      companies: {
        Row: {
          city: string | null
          created_at: string
          extra_domains: string[]
          group: Database["public"]["Enums"]["company_group"]
          id: string
          is_active: boolean
          is_client: boolean
          name: string
          notes: string | null
          short_name: string | null
          sort_order: number
          website_domain: string | null
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          extra_domains?: string[]
          group?: Database["public"]["Enums"]["company_group"]
          id?: string
          is_active?: boolean
          is_client?: boolean
          name: string
          notes?: string | null
          short_name?: string | null
          sort_order?: number
          website_domain?: string | null
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          extra_domains?: string[]
          group?: Database["public"]["Enums"]["company_group"]
          id?: string
          is_active?: boolean
          is_client?: boolean
          name?: string
          notes?: string | null
          short_name?: string | null
          sort_order?: number
          website_domain?: string | null
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          { foreignKeyName: "companies_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      company_profiles: {
        Row: {
          company_id: string
          external_id: string | null
          handle: string | null
          id: string
          notes: string | null
          platform: string
          url: string | null
          verified_at: string | null
        }
        Insert: {
          company_id: string
          external_id?: string | null
          handle?: string | null
          id?: string
          notes?: string | null
          platform: string
          url?: string | null
          verified_at?: string | null
        }
        Update: {
          company_id?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          notes?: string | null
          platform?: string
          url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "company_profiles_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          invited_by: string | null
          is_agency_admin: boolean
          role: Database["public"]["Enums"]["member_role"] | null
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          invited_by?: string | null
          is_agency_admin?: boolean
          role?: Database["public"]["Enums"]["member_role"] | null
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          invited_by?: string | null
          is_agency_admin?: boolean
          role?: Database["public"]["Enums"]["member_role"] | null
          workspace_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "invites_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "invites_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      metrics: {
        Row: {
          area: Database["public"]["Enums"]["metric_area"]
          collector_key: string | null
          direction: Database["public"]["Enums"]["direction"]
          display_weight: Database["public"]["Enums"]["display_weight"]
          help_text: string | null
          is_active: boolean
          key: string
          label: string
          platform: string | null
          sort_order: number
          source: Database["public"]["Enums"]["metric_source"]
          stale_after_days: number | null
          unit: string | null
          value_type: Database["public"]["Enums"]["value_type"]
        }
        Insert: {
          area: Database["public"]["Enums"]["metric_area"]
          collector_key?: string | null
          direction?: Database["public"]["Enums"]["direction"]
          display_weight?: Database["public"]["Enums"]["display_weight"]
          help_text?: string | null
          is_active?: boolean
          key: string
          label: string
          platform?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["metric_source"]
          stale_after_days?: number | null
          unit?: string | null
          value_type: Database["public"]["Enums"]["value_type"]
        }
        Update: {
          area?: Database["public"]["Enums"]["metric_area"]
          collector_key?: string | null
          direction?: Database["public"]["Enums"]["direction"]
          display_weight?: Database["public"]["Enums"]["display_weight"]
          help_text?: string | null
          is_active?: boolean
          key?: string
          label?: string
          platform?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["metric_source"]
          stale_after_days?: number | null
          unit?: string | null
          value_type?: Database["public"]["Enums"]["value_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_agency_admin: boolean
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_agency_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_agency_admin?: boolean
        }
        Relationships: []
      }
      queries: {
        Row: {
          created_at: string
          group: string
          id: string
          is_active: boolean
          is_branded: boolean
          phrase: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          group?: string
          id?: string
          is_active?: boolean
          is_branded?: boolean
          phrase: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          group?: string
          id?: string
          is_active?: boolean
          is_branded?: boolean
          phrase?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          { foreignKeyName: "queries_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          period_end: string | null
          period_start: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload: Json
          period_end?: string | null
          period_start?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          { foreignKeyName: "reports_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "reports_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      serp_results: {
        Row: {
          domain: string | null
          id: number
          match_kind: Database["public"]["Enums"]["match_kind"] | null
          matched_company_id: string | null
          place_id: string | null
          position: number
          rating: number | null
          result_type: Database["public"]["Enums"]["result_type"]
          review_count: number | null
          serp_run_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          domain?: string | null
          id?: never
          match_kind?: Database["public"]["Enums"]["match_kind"] | null
          matched_company_id?: string | null
          place_id?: string | null
          position: number
          rating?: number | null
          result_type: Database["public"]["Enums"]["result_type"]
          review_count?: number | null
          serp_run_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          domain?: string | null
          id?: never
          match_kind?: Database["public"]["Enums"]["match_kind"] | null
          matched_company_id?: string | null
          place_id?: string | null
          position?: number
          rating?: number | null
          result_type?: Database["public"]["Enums"]["result_type"]
          review_count?: number | null
          serp_run_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          { foreignKeyName: "serp_results_matched_company_id_fkey"; columns: ["matched_company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "serp_results_serp_run_id_fkey"; columns: ["serp_run_id"]; isOneToOne: false; referencedRelation: "serp_runs"; referencedColumns: ["id"] },
        ]
      }
      serp_runs: {
        Row: {
          captured_at: string
          cost_units: number | null
          device: string
          has_local_pack: boolean | null
          id: string
          location: string
          provider: string
          query_id: string
          raw: Json | null
          run_id: string | null
          total_organic: number | null
        }
        Insert: {
          captured_at?: string
          cost_units?: number | null
          device: string
          has_local_pack?: boolean | null
          id?: string
          location: string
          provider: string
          query_id: string
          raw?: Json | null
          run_id?: string | null
          total_organic?: number | null
        }
        Update: {
          captured_at?: string
          cost_units?: number | null
          device?: string
          has_local_pack?: boolean | null
          id?: string
          location?: string
          provider?: string
          query_id?: string
          raw?: Json | null
          run_id?: string | null
          total_organic?: number | null
        }
        Relationships: [
          { foreignKeyName: "serp_runs_query_id_fkey"; columns: ["query_id"]; isOneToOne: false; referencedRelation: "queries"; referencedColumns: ["id"] },
          { foreignKeyName: "serp_runs_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "collection_runs"; referencedColumns: ["id"] },
        ]
      }
      snapshots: {
        Row: {
          captured_at: string
          collector_key: string | null
          company_id: string
          entered_by: string | null
          id: number
          metric_key: string
          note: string | null
          raw: Json | null
          run_id: string | null
          source: Database["public"]["Enums"]["metric_source"]
          value_bool: boolean | null
          value_date: string | null
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          captured_at?: string
          collector_key?: string | null
          company_id: string
          entered_by?: string | null
          id?: never
          metric_key: string
          note?: string | null
          raw?: Json | null
          run_id?: string | null
          source: Database["public"]["Enums"]["metric_source"]
          value_bool?: boolean | null
          value_date?: string | null
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          captured_at?: string
          collector_key?: string | null
          company_id?: string
          entered_by?: string | null
          id?: never
          metric_key?: string
          note?: string | null
          raw?: Json | null
          run_id?: string | null
          source?: Database["public"]["Enums"]["metric_source"]
          value_bool?: boolean | null
          value_date?: string | null
          value_num?: number | null
          value_text?: string | null
        }
        Relationships: [
          { foreignKeyName: "snapshots_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "snapshots_entered_by_fkey"; columns: ["entered_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "snapshots_metric_key_fkey"; columns: ["metric_key"]; isOneToOne: false; referencedRelation: "metrics"; referencedColumns: ["key"] },
          { foreignKeyName: "snapshots_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "collection_runs"; referencedColumns: ["id"] },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          { foreignKeyName: "workspace_members_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "workspace_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "workspace_members_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
        ]
      }
      workspaces: {
        Row: {
          client_access_enabled: boolean
          created_at: string
          id: string
          name: string
          refresh_cooldown_minutes: number
          search_country: string
          search_device: string
          search_language: string
          search_location: string
          settings: Json
          slug: string
          stale_after_days: number
          theme: Json
          timezone: string
          weekly_refresh_enabled: boolean
        }
        Insert: {
          client_access_enabled?: boolean
          created_at?: string
          id?: string
          name: string
          refresh_cooldown_minutes?: number
          search_country?: string
          search_device?: string
          search_language?: string
          search_location: string
          settings?: Json
          slug: string
          stale_after_days?: number
          theme?: Json
          timezone?: string
          weekly_refresh_enabled?: boolean
        }
        Update: {
          client_access_enabled?: boolean
          created_at?: string
          id?: string
          name?: string
          refresh_cooldown_minutes?: number
          search_country?: string
          search_device?: string
          search_language?: string
          search_location?: string
          settings?: Json
          slug?: string
          stale_after_days?: number
          theme?: Json
          timezone?: string
          weekly_refresh_enabled?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      scorecard_cells: {
        Row: {
          captured_at: string | null
          company_id: string | null
          delta_num: number | null
          entered_by: string | null
          is_stale: boolean | null
          metric_key: string | null
          prev_captured_at: string | null
          prev_value_bool: boolean | null
          prev_value_date: string | null
          prev_value_num: number | null
          snapshot_id: number | null
          source: Database["public"]["Enums"]["metric_source"] | null
          value_bool: boolean | null
          value_date: string | null
          value_num: number | null
          value_text: string | null
          workspace_id: string | null
        }
        Relationships: [
          { foreignKeyName: "companies_workspace_id_fkey"; columns: ["workspace_id"]; isOneToOne: false; referencedRelation: "workspaces"; referencedColumns: ["id"] },
          { foreignKeyName: "snapshots_company_id_fkey"; columns: ["company_id"]; isOneToOne: false; referencedRelation: "companies"; referencedColumns: ["id"] },
          { foreignKeyName: "snapshots_entered_by_fkey"; columns: ["entered_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "snapshots_metric_key_fkey"; columns: ["metric_key"]; isOneToOne: false; referencedRelation: "metrics"; referencedColumns: ["key"] },
        ]
      }
    }
    Functions: {
      can_enter_data: { Args: { ws: string }; Returns: boolean }
      can_view_workspace: { Args: { ws: string }; Returns: boolean }
      company_workspace: { Args: { cid: string }; Returns: string }
      is_agency_admin: { Args: never; Returns: boolean }
      member_role_in: { Args: { ws: string }; Returns: Database["public"]["Enums"]["member_role"] }
    }
    Enums: {
      action_status: "open" | "in_progress" | "done" | "dropped"
      company_group: "client" | "direct_peer" | "benchmark"
      direction: "higher_better" | "lower_better" | "neutral"
      display_weight: "primary" | "secondary"
      match_kind: "own_site" | "third_party_profile" | "local_pack"
      member_role: "client_viewer" | "client_editor"
      metric_area: "search" | "reviews" | "listings" | "social" | "website"
      metric_source: "manual" | "api"
      result_type: "organic" | "local_pack" | "ad" | "other"
      run_status: "queued" | "running" | "succeeded" | "partial" | "failed"
      run_trigger: "scheduled" | "manual"
      value_type: "number" | "integer" | "percent" | "score" | "boolean" | "text" | "date"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
