"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
};

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export default function AdminHomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (redirectUrl) {
      window.location.assign(redirectUrl);
    }
  }, [redirectUrl]);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile?.role || !ADMIN_ROLES.has(profile.role)) {
        router.push("/admin/login");
        return;
      }

      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload?.error || "Failed to load users.");
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setUsers(payload.users || []);
      setLoading(false);
    };

    loadUsers();
  }, [router]);

  const handleImpersonate = async (user: AdminUser) => {
    setImpersonatingId(user.id);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    if (!user.email) {
      setError("Target user email not available.");
      setImpersonatingId(null);
      return;
    }

    localStorage.setItem(
      "vaos_admin_session",
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      })
    );

    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUserId: user.id,
        targetEmail: user.email,
        reason: "Support session",
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error || "Failed to start impersonation.");
      setImpersonatingId(null);
      return;
    }

    localStorage.setItem(
      "vaos_impersonation_context",
      JSON.stringify({
        sessionId: payload.sessionId,
        targetRole: payload.targetRole,
        targetEmail: user.email,
        startedAt: new Date().toISOString(),
      })
    );

    setRedirectUrl(payload.actionLink);
  };

  const isVA = (role: string | null) => role === "va";
  const isClient = (role: string | null) => role === "client";

  return (
    <main className="min-h-screen bg-[#fcfcfc] text-[#333333] p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Console</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage accounts and start support impersonation sessions.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              All Users
            </h2>
            {loading && (
              <span className="text-xs text-gray-400">Loading...</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px]">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-800 font-medium">
                      {user.full_name || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.email || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                        {user.role || "unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.status || "unknown"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(isVA(user.role) || isClient(user.role)) && (
                        <button
                          onClick={() => handleImpersonate(user)}
                          disabled={impersonatingId === user.id}
                          className="px-4 py-2 text-xs font-semibold rounded-full bg-[#9d4edd] text-white hover:bg-[#7b2cbf] transition-colors disabled:opacity-60"
                        >
                          {impersonatingId === user.id
                            ? "Starting..."
                            : `View as ${isVA(user.role) ? "VA" : "Client"}`}
                        </button>
                      )}
                      {!isVA(user.role) && !isClient(user.role) && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-gray-400"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
