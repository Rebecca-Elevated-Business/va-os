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

export async function GET(request: Request) {
  const { error } = await getAdminUserFromRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status: 403 });
  }

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, status");

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const profileMap = new Map(
    (profileData || []).map((profile) => [profile.id, profile])
  );

  const users =
    authData?.users.map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || null,
        role: profile?.role || "unknown",
        status: profile?.status || "unknown",
      };
    }) || [];

  users.sort((a, b) => {
    if (a.role === b.role) {
      return (a.email || "").localeCompare(b.email || "");
    }
    return (a.role || "").localeCompare(b.role || "");
  });

  return NextResponse.json({ users });
}
