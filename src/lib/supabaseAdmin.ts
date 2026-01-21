import { createClient } from "@supabase/supabase-js";

type AdminDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: string | null;
          status: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: string | null;
          status?: string | null;
        };
        Update: {
          full_name?: string | null;
          role?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      impersonation_sessions: {
        Row: {
          id: string;
          admin_id: string;
          target_user_id: string;
          target_role: string;
          reason: string | null;
          created_at: string;
          expires_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          admin_id: string;
          target_user_id: string;
          target_role: string;
          reason?: string | null;
          created_at?: string;
          expires_at?: string;
          ended_at?: string | null;
        };
        Update: {
          ended_at?: string | null;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_id: string;
          impersonated_user_id: string | null;
          action: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          impersonated_user_id?: string | null;
          action: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          actor_id?: string;
          impersonated_user_id?: string | null;
          action?: string;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

type SupabaseAdminClient = ReturnType<typeof createClient<AdminDatabase>>;

let cachedAdminClient: SupabaseAdminClient | null = null;

export function getSupabaseAdmin(): SupabaseAdminClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient<AdminDatabase>(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return cachedAdminClient;
}
