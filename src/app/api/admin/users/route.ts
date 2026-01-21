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

  const role = (profile as { role?: string | null } | null)?.role;
  if (profileError || !role || !ADMIN_ROLES.has(role)) {
    return { error: "Not authorized." };
  }

  return { user: data.user };
}

export async function GET(request: Request) {
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

  const { error } = await getAdminUserFromRequest(request, supabaseAdmin);
  if (error) {
    return NextResponse.json({ error }, { status: 403 });
  }

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, full_name, role, status");

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
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
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

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, va_id, first_name, surname, email, auth_user_id, status");

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  const clients =
    clientData?.map((client) => ({
      id: client.id,
      va_id: client.va_id,
      first_name: client.first_name,
      last_name: client.surname,
      email: client.email,
      auth_user_id: client.auth_user_id,
      status: client.status,
    })) || [];

  return NextResponse.json({ users, clients });
}
