import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

async function getAdminUserFromRequest(request: Request) {
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

  if (profileError || !profile?.role || !ADMIN_ROLES.has(profile.role)) {
    return { error: "Not authorized." };
  }

  return { user: data.user };
}

export async function POST(request: Request) {
  const { user, error } = await getAdminUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ error: error || "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const targetUserId = String(body?.targetUserId || "");
  const targetEmail = String(body?.targetEmail || "");
  const reason = body?.reason ? String(body.reason) : null;

  if (!targetUserId || !targetEmail) {
    return NextResponse.json(
      { error: "Target user ID and email are required." },
      { status: 400 }
    );
  }

  const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .single();

  if (targetProfileError || !targetProfile?.role) {
    return NextResponse.json(
      { error: "Target profile not found." },
      { status: 404 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectTo =
    targetProfile.role === "va"
      ? `${origin}/va/dashboard?impersonation=1`
      : `${origin}/client/dashboard?impersonation=1`;

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: {
        redirectTo,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkError?.message || "Failed to generate login link." },
      { status: 500 }
    );
  }

  const { data: impersonationSession, error: sessionError } =
    await supabaseAdmin
      .from("impersonation_sessions")
      .insert([
        {
          admin_id: user.id,
          target_user_id: targetUserId,
          target_role: targetProfile.role,
          reason,
        },
      ])
      .select("id")
      .single();

  if (sessionError || !impersonationSession?.id) {
    return NextResponse.json(
      { error: sessionError?.message || "Failed to log impersonation." },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("admin_audit_log").insert([
    {
      actor_id: user.id,
      impersonated_user_id: targetUserId,
      action: "impersonation_started",
      metadata: {
        target_role: targetProfile.role,
        reason,
      },
    },
  ]);

  return NextResponse.json({
    sessionId: impersonationSession.id,
    actionLink: linkData.properties.action_link,
    targetRole: targetProfile.role,
  });
}
