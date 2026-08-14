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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string | null
          changes: Json | null
          created_at: string | null
          id: string
          target_id: string | null
          target_name: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_name?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_name?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_applications: {
        Row: {
          admin_notes: string | null
          cea_no: string | null
          created_at: string
          current_agency: string | null
          email: string
          full_name: string
          id: string
          message: string | null
          nric_last4: string | null
          phone: string
          portfolio_url: string | null
          resume_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          short_bio: string | null
          specialisations: string[] | null
          status: Database["public"]["Enums"]["application_status"] | null
          years_of_experience: number | null
        }
        Insert: {
          admin_notes?: string | null
          cea_no?: string | null
          created_at?: string
          current_agency?: string | null
          email: string
          full_name: string
          id?: string
          message?: string | null
          nric_last4?: string | null
          phone: string
          portfolio_url?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_bio?: string | null
          specialisations?: string[] | null
          status?: Database["public"]["Enums"]["application_status"] | null
          years_of_experience?: number | null
        }
        Update: {
          admin_notes?: string | null
          cea_no?: string | null
          created_at?: string
          current_agency?: string | null
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          nric_last4?: string | null
          phone?: string
          portfolio_url?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_bio?: string | null
          specialisations?: string[] | null
          status?: Database["public"]["Enums"]["application_status"] | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      agent_files: {
        Row: {
          agent_id: string | null
          aria_extracted: Json | null
          category: string | null
          client_id: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          folder_description: string | null
          folder_name: string | null
          id: string
          is_archived: boolean
          processing_status: string | null
          property_id: string | null
          storage_path: string
        }
        Insert: {
          agent_id?: string | null
          aria_extracted?: Json | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          folder_description?: string | null
          folder_name?: string | null
          id?: string
          is_archived?: boolean
          processing_status?: string | null
          property_id?: string | null
          storage_path: string
        }
        Update: {
          agent_id?: string | null
          aria_extracted?: Json | null
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder_description?: string | null
          folder_name?: string | null
          id?: string
          is_archived?: boolean
          processing_status?: string | null
          property_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_files_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_files_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          agent_id: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          agent_id: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          agent_id?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_performance: {
        Row: {
          agent_id: string | null
          avg_days_to_close: number | null
          commission_earned: number | null
          created_at: string | null
          id: string
          leads_converted: number | null
          listings_active: number | null
          listings_rented: number | null
          listings_sold: number | null
          month: string
          total_leads: number | null
          viewings_conducted: number | null
        }
        Insert: {
          agent_id?: string | null
          avg_days_to_close?: number | null
          commission_earned?: number | null
          created_at?: string | null
          id?: string
          leads_converted?: number | null
          listings_active?: number | null
          listings_rented?: number | null
          listings_sold?: number | null
          month: string
          total_leads?: number | null
          viewings_conducted?: number | null
        }
        Update: {
          agent_id?: string | null
          avg_days_to_close?: number | null
          commission_earned?: number | null
          created_at?: string | null
          id?: string
          leads_converted?: number | null
          listings_active?: number | null
          listings_rented?: number | null
          listings_sold?: number | null
          month?: string
          total_leads?: number | null
          viewings_conducted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_performance_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          agent_type: string | null
          bio_en: string | null
          bio_zh: string | null
          cea_no: string
          created_at: string | null
          display_order: number | null
          email_display: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          languages: string[] | null
          linkedin_url: string | null
          position: string | null
          slug: string
          specialisations: string[] | null
          updated_at: string | null
          video_intro_url: string | null
          whatsapp_no: string | null
          years_experience: number | null
        }
        Insert: {
          agent_type?: string | null
          bio_en?: string | null
          bio_zh?: string | null
          cea_no: string
          created_at?: string | null
          display_order?: number | null
          email_display?: string | null
          id: string
          is_featured?: boolean | null
          is_published?: boolean | null
          languages?: string[] | null
          linkedin_url?: string | null
          position?: string | null
          slug: string
          specialisations?: string[] | null
          updated_at?: string | null
          video_intro_url?: string | null
          whatsapp_no?: string | null
          years_experience?: number | null
        }
        Update: {
          agent_type?: string | null
          bio_en?: string | null
          bio_zh?: string | null
          cea_no?: string
          created_at?: string | null
          display_order?: number | null
          email_display?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          languages?: string[] | null
          linkedin_url?: string | null
          position?: string | null
          slug?: string
          specialisations?: string[] | null
          updated_at?: string | null
          video_intro_url?: string | null
          whatsapp_no?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          created_at: string
          due_at: string | null
          id: string
          is_completed: boolean
          lead_id: string | null
          property_id: string | null
          title: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          property_id?: string | null
          title: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          property_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          end_at: string | null
          gcal_event_id: string | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          property_id: string | null
          reminder_sent: boolean | null
          scheduled_at: string
          status: string | null
          title: string
          type: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          end_at?: string | null
          gcal_event_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          property_id?: string | null
          reminder_sent?: boolean | null
          scheduled_at: string
          status?: string | null
          title: string
          type?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          end_at?: string | null
          gcal_event_id?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          property_id?: string | null
          reminder_sent?: boolean | null
          scheduled_at?: string
          status?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      aria_conversations: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          data_action: Json | null
          id: string
          input_mode: string | null
          role: string
          screen_command: Json | null
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          data_action?: Json | null
          id?: string
          input_mode?: string | null
          role: string
          screen_command?: Json | null
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          data_action?: Json | null
          id?: string
          input_mode?: string | null
          role?: string
          screen_command?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "aria_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content_en: string | null
          content_zh: string | null
          cover_image_url: string | null
          created_at: string | null
          excerpt_en: string | null
          excerpt_zh: string | null
          id: string
          is_featured: boolean | null
          is_gated: boolean | null
          published_at: string | null
          slug: string
          title_en: string
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content_en?: string | null
          content_zh?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          excerpt_en?: string | null
          excerpt_zh?: string | null
          id?: string
          is_featured?: boolean | null
          is_gated?: boolean | null
          published_at?: string | null
          slug: string
          title_en: string
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content_en?: string | null
          content_zh?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          excerpt_en?: string | null
          excerpt_zh?: string | null
          id?: string
          is_featured?: boolean | null
          is_gated?: boolean | null
          published_at?: string | null
          slug?: string
          title_en?: string
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_lists: {
        Row: {
          agent_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_lists_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          added_at: string | null
          client_id: string | null
          contact: string
          id: string
          is_active: boolean | null
          lead_id: string | null
          list_id: string | null
          name: string | null
        }
        Insert: {
          added_at?: string | null
          client_id?: string | null
          contact: string
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          list_id?: string | null
          name?: string | null
        }
        Update: {
          added_at?: string | null
          client_id?: string | null
          contact?: string
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          list_id?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "broadcast_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agent_id: string | null
          budget: number | null
          clicks: number | null
          created_at: string | null
          end_date: string | null
          id: string
          impressions: number | null
          leads_generated: number | null
          name: string
          notes: string | null
          property_id: string | null
          spent: number | null
          start_date: string | null
          status: string | null
          target_audience: string | null
          type: string
        }
        Insert: {
          agent_id?: string | null
          budget?: number | null
          clicks?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          leads_generated?: number | null
          name: string
          notes?: string | null
          property_id?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          target_audience?: string | null
          type: string
        }
        Update: {
          agent_id?: string | null
          budget?: number | null
          clicks?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          leads_generated?: number | null
          name?: string
          notes?: string | null
          property_id?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          target_audience?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          direction: string | null
          duration_mins: number | null
          id: string
          lead_id: string | null
          next_action: string | null
          next_action_due: string | null
          outcome: string | null
          property_id: string | null
          summary: string
          type: string
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_mins?: number | null
          id?: string
          lead_id?: string | null
          next_action?: string | null
          next_action_due?: string | null
          outcome?: string | null
          property_id?: string | null
          summary: string
          type: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_mins?: number | null
          id?: string
          lead_id?: string | null
          next_action?: string | null
          next_action_due?: string | null
          outcome?: string | null
          property_id?: string | null
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      client_preferences: {
        Row: {
          bedrooms_max: number | null
          bedrooms_min: number | null
          budget_max: number | null
          budget_min: number | null
          client_id: string | null
          dealbreakers: string[] | null
          id: string
          must_have: string[] | null
          nice_to_have: string[] | null
          notes: string | null
          preferred_districts: number[] | null
          property_types: string[] | null
          size_max_sqft: number | null
          size_min_sqft: number | null
          tenure_preference: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          bedrooms_max?: number | null
          bedrooms_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          dealbreakers?: string[] | null
          id?: string
          must_have?: string[] | null
          nice_to_have?: string[] | null
          notes?: string | null
          preferred_districts?: number[] | null
          property_types?: string[] | null
          size_max_sqft?: number | null
          size_min_sqft?: number | null
          tenure_preference?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          bedrooms_max?: number | null
          bedrooms_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          dealbreakers?: string[] | null
          id?: string
          must_have?: string[] | null
          nice_to_have?: string[] | null
          notes?: string | null
          preferred_districts?: number[] | null
          property_types?: string[] | null
          size_max_sqft?: number | null
          size_min_sqft?: number | null
          tenure_preference?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agent_id: string | null
          annual_income: number | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          is_pr: boolean | null
          lead_id: string | null
          nationality: string | null
          notes: string | null
          nric_last4: string | null
          occupation: string | null
          phone: string | null
          preferred_lang: string | null
          property_count: number | null
          referral_source: string | null
          referred_by: string | null
          tags: string[] | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          agent_id?: string | null
          annual_income?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_pr?: boolean | null
          lead_id?: string | null
          nationality?: string | null
          notes?: string | null
          nric_last4?: string | null
          occupation?: string | null
          phone?: string | null
          preferred_lang?: string | null
          property_count?: number | null
          referral_source?: string | null
          referred_by?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          agent_id?: string | null
          annual_income?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_pr?: boolean | null
          lead_id?: string | null
          nationality?: string | null
          notes?: string | null
          nric_last4?: string | null
          occupation?: string | null
          phone?: string | null
          preferred_lang?: string | null
          property_count?: number | null
          referral_source?: string | null
          referred_by?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_posts: {
        Row: {
          agent_id: string
          caption: string
          created_at: string
          id: string
          image_url: string | null
          platform: string
          property_id: string | null
          scheduled_at: string | null
          status: string
        }
        Insert: {
          agent_id: string
          caption: string
          created_at?: string
          id?: string
          image_url?: string | null
          platform: string
          property_id?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          caption?: string
          created_at?: string
          id?: string
          image_url?: string | null
          platform?: string
          property_id?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agent_id: string | null
          agreed_price: number | null
          client_id: string | null
          cobroke_agent_id: string | null
          cobroke_split_pct: number | null
          commission_amount: number | null
          commission_pct: number | null
          completion_date: string | null
          created_at: string | null
          exercise_date: string | null
          id: string
          notes: string | null
          otp_date: string | null
          otp_expiry: string | null
          property_id: string | null
          stage: string | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          agreed_price?: number | null
          client_id?: string | null
          cobroke_agent_id?: string | null
          cobroke_split_pct?: number | null
          commission_amount?: number | null
          commission_pct?: number | null
          completion_date?: string | null
          created_at?: string | null
          exercise_date?: string | null
          id?: string
          notes?: string | null
          otp_date?: string | null
          otp_expiry?: string | null
          property_id?: string | null
          stage?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          agreed_price?: number | null
          client_id?: string | null
          cobroke_agent_id?: string | null
          cobroke_split_pct?: number | null
          commission_amount?: number | null
          commission_pct?: number | null
          completion_date?: string | null
          created_at?: string | null
          exercise_date?: string | null
          id?: string
          notes?: string | null
          otp_date?: string | null
          otp_expiry?: string | null
          property_id?: string | null
          stage?: string | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_cobroke_agent_id_fkey"
            columns: ["cobroke_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          area: string | null
          avg_psf: number | null
          description: string | null
          district_no: number
          name_en: string
          name_zh: string | null
        }
        Insert: {
          area?: string | null
          avg_psf?: number | null
          description?: string | null
          district_no: number
          name_en: string
          name_zh?: string | null
        }
        Update: {
          area?: string | null
          avg_psf?: number | null
          description?: string | null
          district_no?: number
          name_en?: string
          name_zh?: string | null
        }
        Relationships: []
      }
      documents_generated: {
        Row: {
          agent_id: string
          content_json: Json | null
          created_at: string
          id: string
          lead_id: string | null
          pdf_url: string | null
          property_id: string | null
          type: string
        }
        Insert: {
          agent_id: string
          content_json?: Json | null
          created_at?: string
          id?: string
          lead_id?: string | null
          pdf_url?: string | null
          property_id?: string | null
          type: string
        }
        Update: {
          agent_id?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          lead_id?: string | null
          pdf_url?: string | null
          property_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_generated_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_generated_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_generated_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          channel: Database["public"]["Enums"]["enquiry_channel"] | null
          created_at: string | null
          id: string
          lead_id: string
          message: string
          replied_at: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["enquiry_channel"] | null
          created_at?: string | null
          id?: string
          lead_id: string
          message: string
          replied_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["enquiry_channel"] | null
          created_at?: string | null
          id?: string
          lead_id?: string
          message?: string
          replied_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      file_activity_log: {
        Row: {
          action: string
          agent_id: string
          created_at: string
          file_id: string | null
          folder_name: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          source: string
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string
          file_id?: string | null
          folder_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source: string
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string
          file_id?: string | null
          folder_name?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_activity_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_activity_log_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "agent_files"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string | null
          created_at: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          rag_embedded: boolean | null
          rag_embedded_at: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          rag_embedded?: boolean | null
          rag_embedded_at?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          rag_embedded?: boolean | null
          rag_embedded_at?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string | null
          ai_score: number | null
          ai_summary: string | null
          budget_max: number | null
          budget_min: number | null
          campaign_id: string | null
          client_id: string | null
          converted_at: string | null
          created_at: string | null
          email: string | null
          financing_status: string | null
          full_name: string | null
          id: string
          last_contacted_at: string | null
          member_id: string | null
          nationality: string | null
          next_followup_at: string | null
          notes: string | null
          phone: string | null
          preferred_districts: number[] | null
          preferred_types: string[] | null
          property_id: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          status: Database["public"]["Enums"]["lead_status"] | null
          timeline: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          budget_max?: number | null
          budget_min?: number | null
          campaign_id?: string | null
          client_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          financing_status?: string | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          member_id?: string | null
          nationality?: string | null
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          preferred_districts?: number[] | null
          preferred_types?: string[] | null
          property_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          timeline?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          budget_max?: number | null
          budget_min?: number | null
          campaign_id?: string | null
          client_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          financing_status?: string | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          member_id?: string | null
          nationality?: string | null
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          preferred_districts?: number[] | null
          preferred_types?: string[] | null
          property_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          timeline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_reports: {
        Row: {
          cover_url: string | null
          created_at: string | null
          description: string | null
          file_url: string
          id: string
          period: string | null
          published_at: string | null
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          file_url: string
          id?: string
          period?: string | null
          published_at?: string | null
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          file_url?: string
          id?: string
          period?: string | null
          published_at?: string | null
          title?: string
        }
        Relationships: []
      }
      member_preferences: {
        Row: {
          bedroom_min: number | null
          budget_max: number | null
          budget_min: number | null
          id: string
          preferred_districts: number[] | null
          preferred_types: Database["public"]["Enums"]["property_type"][] | null
          subscribed_alerts: boolean | null
          subscribed_reports: boolean | null
          tenure_preference: Database["public"]["Enums"]["tenure_type"] | null
          updated_at: string | null
        }
        Insert: {
          bedroom_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          id: string
          preferred_districts?: number[] | null
          preferred_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
          subscribed_alerts?: boolean | null
          subscribed_reports?: boolean | null
          tenure_preference?: Database["public"]["Enums"]["tenure_type"] | null
          updated_at?: string | null
        }
        Update: {
          bedroom_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          id?: string
          preferred_districts?: number[] | null
          preferred_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
          subscribed_alerts?: boolean | null
          subscribed_reports?: boolean | null
          tenure_preference?: Database["public"]["Enums"]["tenure_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_preferences_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          agent_id: string | null
          category: string
          channels: string[] | null
          content_en: string | null
          content_zh: string | null
          created_at: string
          id: string
          is_global: boolean
          title: string
        }
        Insert: {
          agent_id?: string | null
          category: string
          channels?: string[] | null
          content_en?: string | null
          content_zh?: string | null
          created_at?: string
          id?: string
          is_global?: boolean
          title: string
        }
        Update: {
          agent_id?: string | null
          category?: string
          channels?: string[] | null
          content_en?: string | null
          content_zh?: string | null
          created_at?: string
          id?: string
          is_global?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mortgage_presets: {
        Row: {
          id: string
          is_default: boolean | null
          label: string
          loan_type: string | null
          max_tenure_yr: number | null
          rate_percent: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          is_default?: boolean | null
          label: string
          loan_type?: string | null
          max_tenure_yr?: number | null
          rate_percent: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_default?: boolean | null
          label?: string
          loan_type?: string | null
          max_tenure_yr?: number | null
          rate_percent?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string | null
          type?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          password_set_at: string | null
          phone: string | null
          preferred_lang: Database["public"]["Enums"]["lang_code"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          password_set_at?: string | null
          phone?: string | null
          preferred_lang?: Database["public"]["Enums"]["lang_code"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          password_set_at?: string | null
          phone?: string | null
          preferred_lang?: Database["public"]["Enums"]["lang_code"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          agent_id: string
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          availability_date: string | null
          bathrooms: number | null
          bedrooms: number | null
          car_parks: number | null
          cobroke_commission: number | null
          cobroke_enabled: boolean | null
          created_at: string | null
          description_en: string | null
          description_zh: string | null
          district: number | null
          facing: string | null
          floor_level: string | null
          furnishing: string | null
          id: string
          is_featured: boolean | null
          latitude: number | null
          longitude: number | null
          monthly_rental: number | null
          mrt_distance_m: number | null
          mrt_nearest: string | null
          postal_code: string | null
          price: number
          price_on_enquiry: boolean | null
          price_psf: number | null
          property_name: string | null
          rag_embedded: boolean | null
          rag_embedded_at: string | null
          rejection_reason: string | null
          school_nearest: string | null
          size_sqft: number | null
          slug: string | null
          status: Database["public"]["Enums"]["listing_status"]
          tenure: Database["public"]["Enums"]["tenure_type"] | null
          title: string
          title_zh: string | null
          top_year: number | null
          total_floors: number | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          type: Database["public"]["Enums"]["property_type"]
          unit_number: string | null
          updated_at: string | null
          view_count: number | null
          virtual_tour_url: string | null
        }
        Insert: {
          address?: string | null
          agent_id: string
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          availability_date?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          car_parks?: number | null
          cobroke_commission?: number | null
          cobroke_enabled?: boolean | null
          created_at?: string | null
          description_en?: string | null
          description_zh?: string | null
          district?: number | null
          facing?: string | null
          floor_level?: string | null
          furnishing?: string | null
          id?: string
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          monthly_rental?: number | null
          mrt_distance_m?: number | null
          mrt_nearest?: string | null
          postal_code?: string | null
          price: number
          price_on_enquiry?: boolean | null
          price_psf?: number | null
          property_name?: string | null
          rag_embedded?: boolean | null
          rag_embedded_at?: string | null
          rejection_reason?: string | null
          school_nearest?: string | null
          size_sqft?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          tenure?: Database["public"]["Enums"]["tenure_type"] | null
          title: string
          title_zh?: string | null
          top_year?: number | null
          total_floors?: number | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          type: Database["public"]["Enums"]["property_type"]
          unit_number?: string | null
          updated_at?: string | null
          view_count?: number | null
          virtual_tour_url?: string | null
        }
        Update: {
          address?: string | null
          agent_id?: string
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          availability_date?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          car_parks?: number | null
          cobroke_commission?: number | null
          cobroke_enabled?: boolean | null
          created_at?: string | null
          description_en?: string | null
          description_zh?: string | null
          district?: number | null
          facing?: string | null
          floor_level?: string | null
          furnishing?: string | null
          id?: string
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          monthly_rental?: number | null
          mrt_distance_m?: number | null
          mrt_nearest?: string | null
          postal_code?: string | null
          price?: number
          price_on_enquiry?: boolean | null
          price_psf?: number | null
          property_name?: string | null
          rag_embedded?: boolean | null
          rag_embedded_at?: string | null
          rejection_reason?: string | null
          school_nearest?: string | null
          size_sqft?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          tenure?: Database["public"]["Enums"]["tenure_type"] | null
          title?: string
          title_zh?: string | null
          top_year?: number | null
          total_floors?: number | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          type?: Database["public"]["Enums"]["property_type"]
          unit_number?: string | null
          updated_at?: string | null
          view_count?: number | null
          virtual_tour_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_audio: {
        Row: {
          audio_url: string
          generated_at: string | null
          id: string
          lang: Database["public"]["Enums"]["lang_code"]
          property_id: string
          script_text: string | null
        }
        Insert: {
          audio_url: string
          generated_at?: string | null
          id?: string
          lang: Database["public"]["Enums"]["lang_code"]
          property_id: string
          script_text?: string | null
        }
        Update: {
          audio_url?: string
          generated_at?: string | null
          id?: string
          lang?: Database["public"]["Enums"]["lang_code"]
          property_id?: string
          script_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_audio_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_cobroke: {
        Row: {
          cobroke_agent_id: string | null
          commission_split: number | null
          created_at: string | null
          id: string
          listing_agent_id: string | null
          message: string | null
          property_id: string | null
          responded_at: string | null
          status: string | null
        }
        Insert: {
          cobroke_agent_id?: string | null
          commission_split?: number | null
          created_at?: string | null
          id?: string
          listing_agent_id?: string | null
          message?: string | null
          property_id?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Update: {
          cobroke_agent_id?: string | null
          commission_split?: number | null
          created_at?: string | null
          id?: string
          listing_agent_id?: string | null
          message?: string | null
          property_id?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_cobroke_cobroke_agent_id_fkey"
            columns: ["cobroke_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_cobroke_listing_agent_id_fkey"
            columns: ["listing_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_cobroke_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_enquiries: {
        Row: {
          agent_id: string | null
          cobroke_agent_id: string | null
          created_at: string | null
          email: string
          enquiry_type: string | null
          id: string
          is_cobroke: boolean | null
          message: string | null
          name: string
          phone: string | null
          property_id: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          cobroke_agent_id?: string | null
          created_at?: string | null
          email: string
          enquiry_type?: string | null
          id?: string
          is_cobroke?: boolean | null
          message?: string | null
          name: string
          phone?: string | null
          property_id?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          cobroke_agent_id?: string | null
          created_at?: string | null
          email?: string
          enquiry_type?: string | null
          id?: string
          is_cobroke?: boolean | null
          message?: string | null
          name?: string
          phone?: string | null
          property_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_enquiries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_enquiries_cobroke_agent_id_fkey"
            columns: ["cobroke_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_enquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_floor_plans: {
        Row: {
          display_order: number | null
          id: string
          label: string | null
          property_id: string
          url: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          label?: string | null
          property_id: string
          url: string
        }
        Update: {
          display_order?: number | null
          id?: string
          label?: string | null
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_floor_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_cover: boolean | null
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_cover?: boolean | null
          property_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_cover?: boolean | null
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_openhouse: {
        Row: {
          agent_id: string | null
          created_at: string | null
          end_at: string
          id: string
          is_cancelled: boolean | null
          max_attendees: number | null
          notes: string | null
          property_id: string | null
          scheduled_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          end_at: string
          id?: string
          is_cancelled?: boolean | null
          max_attendees?: number | null
          notes?: string | null
          property_id?: string | null
          scheduled_at: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          end_at?: string
          id?: string
          is_cancelled?: boolean | null
          max_attendees?: number | null
          notes?: string | null
          property_id?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_openhouse_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_openhouse_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_price_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_price: number | null
          old_price: number | null
          property_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          property_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          property_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_private_notes: {
        Row: {
          agent_id: string | null
          id: string
          offers_received: Json | null
          owner_bottom_price: number | null
          owner_urgency: string | null
          private_notes: string | null
          property_id: string | null
          reason_for_selling: string | null
          updated_at: string | null
          viewing_feedback: Json | null
        }
        Insert: {
          agent_id?: string | null
          id?: string
          offers_received?: Json | null
          owner_bottom_price?: number | null
          owner_urgency?: string | null
          private_notes?: string | null
          property_id?: string | null
          reason_for_selling?: string | null
          updated_at?: string | null
          viewing_feedback?: Json | null
        }
        Update: {
          agent_id?: string | null
          id?: string
          offers_received?: Json | null
          owner_bottom_price?: number | null
          owner_urgency?: string | null
          private_notes?: string | null
          property_id?: string | null
          reason_for_selling?: string | null
          updated_at?: string | null
          viewing_feedback?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "property_private_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_private_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_view_logs: {
        Row: {
          device_type: string | null
          id: string
          ip_country: string | null
          property_id: string | null
          session_id: string | null
          source: string | null
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          device_type?: string | null
          id?: string
          ip_country?: string | null
          property_id?: string | null
          session_id?: string | null
          source?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          device_type?: string | null
          id?: string
          ip_country?: string | null
          property_id?: string | null
          session_id?: string | null
          source?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_view_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_view_logs_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_documents: {
        Row: {
          agent_id: string | null
          chunk_index: number | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          is_public: boolean | null
          metadata: Json | null
          source_id: string | null
          source_type: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          chunk_index?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          source_id?: string | null
          source_type: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          chunk_index?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          source_id?: string | null
          source_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          agent_id: string | null
          client_id: string | null
          created_at: string | null
          done_at: string | null
          due_at: string
          id: string
          is_done: boolean | null
          lead_id: string | null
          notes: string | null
          property_id: string | null
          title: string
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          done_at?: string | null
          due_at: string
          id?: string
          is_done?: boolean | null
          lead_id?: string | null
          notes?: string | null
          property_id?: string | null
          title: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          created_at?: string | null
          done_at?: string | null
          due_at?: string
          id?: string
          is_done?: boolean | null
          lead_id?: string | null
          notes?: string | null
          property_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          property_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          property_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alert_enabled: boolean | null
          created_at: string | null
          filters: Json
          id: string
          label: string | null
          last_alerted_at: string | null
          member_id: string
        }
        Insert: {
          alert_enabled?: boolean | null
          created_at?: string | null
          filters?: Json
          id?: string
          label?: string | null
          last_alerted_at?: string | null
          member_id: string
        }
        Update: {
          alert_enabled?: boolean | null
          created_at?: string | null
          filters?: Json
          id?: string
          label?: string | null
          last_alerted_at?: string | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          connected_at: string | null
          id: string
          is_active: boolean | null
          owner_id: string | null
          owner_type: string
          platform: string
          token_expiry: string | null
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          connected_at?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          owner_type: string
          platform: string
          token_expiry?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          connected_at?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          owner_type?: string
          platform?: string
          token_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_analytics: {
        Row: {
          clicks: number | null
          comments: number | null
          id: string
          leads_generated: number | null
          likes: number | null
          platform: string | null
          post_id: string | null
          recorded_at: string | null
          shares: number | null
          views: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          id?: string
          leads_generated?: number | null
          likes?: number | null
          platform?: string | null
          post_id?: string | null
          recorded_at?: string | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          id?: string
          leads_generated?: number | null
          likes?: number | null
          platform?: string | null
          post_id?: string | null
          recorded_at?: string | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          account_id: string | null
          agent_id: string | null
          aria_generated: boolean | null
          caption_en: string | null
          caption_zh: string | null
          created_at: string | null
          failure_reason: string | null
          hashtags: string[] | null
          id: string
          image_urls: string[] | null
          n8n_execution_id: string | null
          platform: string
          platform_post_id: string | null
          post_type: string | null
          property_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          account_id?: string | null
          agent_id?: string | null
          aria_generated?: boolean | null
          caption_en?: string | null
          caption_zh?: string | null
          created_at?: string | null
          failure_reason?: string | null
          hashtags?: string[] | null
          id?: string
          image_urls?: string[] | null
          n8n_execution_id?: string | null
          platform: string
          platform_post_id?: string | null
          post_type?: string | null
          property_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          account_id?: string | null
          agent_id?: string | null
          aria_generated?: boolean | null
          caption_en?: string | null
          caption_zh?: string | null
          created_at?: string | null
          failure_reason?: string | null
          hashtags?: string[] | null
          id?: string
          image_urls?: string[] | null
          n8n_execution_id?: string | null
          platform?: string
          platform_post_id?: string | null
          post_type?: string | null
          property_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      social_templates: {
        Row: {
          caption_template_en: string | null
          caption_template_zh: string | null
          created_at: string | null
          created_by: string | null
          hashtag_sets: Json | null
          id: string
          image_count: number | null
          is_active: boolean | null
          platform: string
          post_type: string
          property_type: string | null
        }
        Insert: {
          caption_template_en?: string | null
          caption_template_zh?: string | null
          created_at?: string | null
          created_by?: string | null
          hashtag_sets?: Json | null
          id?: string
          image_count?: number | null
          is_active?: boolean | null
          platform: string
          post_type: string
          property_type?: string | null
        }
        Update: {
          caption_template_en?: string | null
          caption_template_zh?: string | null
          created_at?: string | null
          created_by?: string | null
          hashtag_sets?: Json | null
          id?: string
          image_count?: number | null
          is_active?: boolean | null
          platform?: string
          post_type?: string
          property_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          agent_id: string | null
          client_name: string
          client_type: string | null
          content: string
          created_at: string | null
          id: string
          is_featured: boolean | null
          is_verified: boolean | null
          rating: number | null
        }
        Insert: {
          agent_id?: string | null
          client_name: string
          client_type?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_verified?: boolean | null
          rating?: number | null
        }
        Update: {
          agent_id?: string | null
          client_name?: string
          client_type?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_verified?: boolean | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unanswered_queries: {
        Row: {
          agent_reply: string | null
          answered_at: string | null
          aria_attempt: string | null
          assigned_to: string | null
          conversation_context: Json | null
          created_at: string | null
          id: string
          is_trained: boolean | null
          question: string
          source: string | null
          status: string | null
          trained_at: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          agent_reply?: string | null
          answered_at?: string | null
          aria_attempt?: string | null
          assigned_to?: string | null
          conversation_context?: Json | null
          created_at?: string | null
          id?: string
          is_trained?: boolean | null
          question: string
          source?: string | null
          status?: string | null
          trained_at?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          agent_reply?: string | null
          answered_at?: string | null
          aria_attempt?: string | null
          assigned_to?: string | null
          conversation_context?: Json | null
          created_at?: string | null
          id?: string
          is_trained?: boolean | null
          question?: string
          source?: string | null
          status?: string | null
          trained_at?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unanswered_queries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      viewings: {
        Row: {
          agent_id: string
          created_at: string | null
          duration_mins: number | null
          gcal_event_id: string | null
          id: string
          lead_id: string
          notes: string | null
          property_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["viewing_status"] | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          duration_mins?: number | null
          gcal_event_id?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          property_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["viewing_status"] | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          duration_mins?: number | null
          gcal_event_id?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          property_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["viewing_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "viewings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          created_at: string | null
          id: string
          intent_json: Json | null
          lang: Database["public"]["Enums"]["lang_code"] | null
          lead_id: string | null
          matched_listings: string[] | null
          member_id: string | null
          transcript: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intent_json?: Json | null
          lang?: Database["public"]["Enums"]["lang_code"] | null
          lead_id?: string | null
          matched_listings?: string[] | null
          member_id?: string | null
          transcript?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intent_json?: Json | null
          lang?: Database["public"]["Enums"]["lang_code"] | null
          lead_id?: string | null
          matched_listings?: string[] | null
          member_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          agent_id: string | null
          client_id: string | null
          contact_name: string | null
          content: string | null
          created_at: string | null
          direction: string
          from_number: string | null
          id: string
          lead_id: string | null
          media_url: string | null
          message_type: string | null
          n8n_execution_id: string | null
          status: string | null
          template_name: string | null
          to_number: string | null
          whatsapp_msg_id: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          contact_name?: string | null
          content?: string | null
          created_at?: string | null
          direction: string
          from_number?: string | null
          id?: string
          lead_id?: string | null
          media_url?: string | null
          message_type?: string | null
          n8n_execution_id?: string | null
          status?: string | null
          template_name?: string | null
          to_number?: string | null
          whatsapp_msg_id?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          contact_name?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string
          from_number?: string | null
          id?: string
          lead_id?: string | null
          media_url?: string | null
          message_type?: string | null
          n8n_execution_id?: string | null
          status?: string | null
          template_name?: string | null
          to_number?: string | null
          whatsapp_msg_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      increment_view_count: {
        Args: { property_uuid: string }
        Returns: undefined
      }
      search_agent_rag: {
        Args: {
          match_count?: number
          min_similarity?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      search_main_rag: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "agent" | "user"
      application_status:
        | "pending"
        | "reviewing"
        | "interview"
        | "approved"
        | "declined"
      campaign_type:
        | "email"
        | "whatsapp"
        | "social"
        | "propertyguru"
        | "99co"
        | "flyer"
        | "event"
      deal_stage:
        | "enquiry"
        | "viewing"
        | "offer"
        | "otp_issued"
        | "otp_exercised"
        | "completed"
        | "fell_through"
      doc_type:
        | "otp"
        | "loi"
        | "tenancy"
        | "commission"
        | "listing_agreement"
        | "other"
      enquiry_channel: "form" | "whatsapp" | "phone" | "email" | "voice"
      interaction_type:
        | "call"
        | "email"
        | "whatsapp"
        | "meeting"
        | "viewing"
        | "note"
      lang_code: "en" | "zh"
      lead_source:
        | "website"
        | "whatsapp"
        | "referral"
        | "portal"
        | "voice"
        | "agent"
      lead_status: "new" | "contacted" | "viewing" | "offer" | "closed" | "lost"
      listing_status: "active" | "sold" | "rented" | "archived" | "draft"
      property_type:
        | "HDB"
        | "Condo"
        | "Landed"
        | "Commercial"
        | "Industrial"
        | "Conservation Shophouse"
        | "New Launch"
        | "Investment"
      tenure_type: "Freehold" | "99-year" | "999-year" | "Leasehold"
      transaction_type: "sale" | "rental"
      viewing_status: "pending" | "confirmed" | "completed" | "cancelled"
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
      app_role: ["admin", "agent", "user"],
      application_status: [
        "pending",
        "reviewing",
        "interview",
        "approved",
        "declined",
      ],
      campaign_type: [
        "email",
        "whatsapp",
        "social",
        "propertyguru",
        "99co",
        "flyer",
        "event",
      ],
      deal_stage: [
        "enquiry",
        "viewing",
        "offer",
        "otp_issued",
        "otp_exercised",
        "completed",
        "fell_through",
      ],
      doc_type: [
        "otp",
        "loi",
        "tenancy",
        "commission",
        "listing_agreement",
        "other",
      ],
      enquiry_channel: ["form", "whatsapp", "phone", "email", "voice"],
      interaction_type: [
        "call",
        "email",
        "whatsapp",
        "meeting",
        "viewing",
        "note",
      ],
      lang_code: ["en", "zh"],
      lead_source: [
        "website",
        "whatsapp",
        "referral",
        "portal",
        "voice",
        "agent",
      ],
      lead_status: ["new", "contacted", "viewing", "offer", "closed", "lost"],
      listing_status: ["active", "sold", "rented", "archived", "draft"],
      property_type: [
        "HDB",
        "Condo",
        "Landed",
        "Commercial",
        "Industrial",
        "Conservation Shophouse",
        "New Launch",
        "Investment",
      ],
      tenure_type: ["Freehold", "99-year", "999-year", "Leasehold"],
      transaction_type: ["sale", "rental"],
      viewing_status: ["pending", "confirmed", "completed", "cancelled"],
    },
  },
} as const
