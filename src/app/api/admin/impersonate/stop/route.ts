import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

async function getAdminUserFromRequest(
  request: Request,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return { error: "Missing access token." };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid access token." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const adminRole = (profile as { role?: string | null } | null)?.role;
  if (profileError || !adminRole || !ADMIN_ROLES.has(adminRole)) {
    return { error: "Not authorized." };
  }

  return { user: data.user };
}

export async function POST(request: Request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Missing Supabase service role configuration.",
      },
      { status: 500 }
    );
  }

  const { user, error } = await getAdminUserFromRequest(request, supabaseAdmin);
  if (error || !user) {
    return NextResponse.json({ error: error || "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const sessionId = String(body?.sessionId || "");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("admin_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("admin_audit_log").insert([
    {
      actor_id: user.id,
      action: "impersonation_ended",
      metadata: { session_id: sessionId },
    },
  ]);

  return NextResponse.json({ ok: true });
}
