"use client";

import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AdminUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
};

type AdminClient = {
  id: string;
  va_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  auth_user_id: string | null;
  status: string | null;
};

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export default function AdminHomePage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"va" | "client">("va");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedVaIds, setExpandedVaIds] = useState<string[]>([]);

  const handleAdminSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("vaos_admin_session");
    localStorage.removeItem("vaos_impersonation_context");
    router.push("/admin/login");
  };

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
      setClients(payload.clients || []);
      setLoading(false);
    };

    loadUsers();
  }, [router]);

  const handleImpersonate = async (authUserId: string, email: string) => {
    setImpersonatingId(authUserId);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    if (!email) {
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
      }),
    );

    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUserId: authUserId,
        targetEmail: email,
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
        targetEmail: email,
        startedAt: new Date().toISOString(),
      }),
    );

    setRedirectUrl(payload.actionLink);
  };

  const searchValue = searchQuery.trim().toLowerCase();
  const statusOptions = Array.from(
    new Set(users.map((user) => user.status).filter(Boolean)),
  ) as string[];
  const clientsByVA = new Map<string, AdminClient[]>();
  const clientsByAuthId = new Map<string, AdminClient>();

  clients.forEach((client) => {
    if (client.va_id) {
      const list = clientsByVA.get(client.va_id) || [];
      list.push(client);
      clientsByVA.set(client.va_id, list);
    }
    if (client.auth_user_id) {
      clientsByAuthId.set(client.auth_user_id, client);
    }
  });

  const withNameFallback = (user: AdminUser) => {
    let firstName = user.first_name;
    let lastName = user.last_name;

    if ((!firstName || !lastName) && user.full_name) {
      const parts = user.full_name.trim().split(" ");
      firstName = firstName || parts[0] || null;
      lastName = lastName || parts.slice(1).join(" ") || null;
    }

    if (user.role === "client" && user.id) {
      const clientRecord = clientsByAuthId.get(user.id);
      if (clientRecord) {
        firstName = firstName || clientRecord.first_name;
        lastName = lastName || clientRecord.last_name;
      }
    }

    return { ...user, first_name: firstName, last_name: lastName };
  };

  const normalizedUsers = users.map(withNameFallback);
  const filteredUsers = normalizedUsers.filter((user) => {
    if (user.role !== "va") return false;

    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (statusFilter !== "all" && user.status !== statusFilter) return false;

    if (!searchValue) return true;
    const fields = [
      user.first_name,
      user.last_name,
      user.email,
      user.role,
      user.status,
    ];
    return fields.some((field) => field?.toLowerCase().includes(searchValue));
  });

  const filteredClients = clients.filter((client) => {
    if (roleFilter !== "all" && roleFilter !== "client") return false;
    if (statusFilter !== "all" && client.status !== statusFilter) return false;
    if (!searchValue) return true;

    const fields = [
      client.first_name,
      client.last_name,
      client.email,
      client.status,
    ];
    return fields.some((field) => field?.toLowerCase().includes(searchValue));
  });

  const clientStatusOptions = Array.from(
    new Set(clients.map((client) => client.status).filter(Boolean)),
  ) as string[];

  const toggleVaClients = (vaId: string) => {
    setExpandedVaIds((prev) =>
      prev.includes(vaId) ? prev.filter((id) => id !== vaId) : [...prev, vaId],
    );
  };

  return (
    <main className="min-h-screen bg-[#fcfcfc] text-[#333333] p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Console</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage accounts and start support impersonation sessions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/onboard-va"
              className="inline-flex items-center justify-center rounded-full bg-[#9d4edd] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#7b2cbf]"
            >
              Add VA
            </Link>
            <button
              type="button"
              onClick={handleAdminSignOut}
              className="inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2 text-xs font-semibold text-red-500 shadow-sm transition-colors hover:border-red-300 hover:text-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("va")}
              className={`px-4 py-2 rounded-full transition-colors ${
                activeTab === "va"
                  ? "bg-[#9d4edd] text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              VAs
            </button>
            <button
              onClick={() => setActiveTab("client")}
              className={`px-4 py-2 rounded-full transition-colors ${
                activeTab === "client"
                  ? "bg-[#9d4edd] text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Clients
            </button>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, email, role, status"
            className="min-w-60 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-purple-100"
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-purple-100"
          >
            <option value="all">All roles</option>
            <option value="va">VA</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm outline-none focus:border-[#9d4edd] focus:ring-2 focus:ring-purple-100"
          >
            <option value="all">All status</option>
            {(activeTab === "client" ? clientStatusOptions : statusOptions).map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {activeTab === "va" ? "VA Accounts" : "Client Accounts"}
            </h2>
            {loading && (
              <span className="text-xs text-gray-400">Loading...</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px]">
                <tr>
                  <th className="px-6 py-3 text-left">First name</th>
                  <th className="px-6 py-3 text-left">Last name</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeTab === "va" &&
                  filteredUsers.map((user) => {
                    const vaClients = clientsByVA.get(user.id) || [];

                    return (
                      <Fragment key={user.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-gray-800 font-medium">
                            {user.first_name || "—"}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {user.last_name || "—"}
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
                            <div className="flex items-center justify-end gap-2">
                              {user.email && (
                                <button
                                  onClick={() =>
                                    handleImpersonate(user.id, user.email || "")
                                  }
                                  disabled={impersonatingId === user.id}
                                  className="px-4 py-2 text-xs font-semibold rounded-full bg-[#9d4edd] text-white hover:bg-[#7b2cbf] transition-colors disabled:opacity-60"
                                >
                                  {impersonatingId === user.id
                                    ? "Starting..."
                                    : "View as VA"}
                                </button>
                              )}
                              <button
                                onClick={() => toggleVaClients(user.id)}
                                className="px-3 py-2 text-xs font-semibold rounded-full border border-gray-200 text-gray-600 hover:border-[#9d4edd] hover:text-[#7b2cbf] transition-colors"
                              >
                                Clients ({vaClients.length})
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedVaIds.includes(user.id) && (
                          <tr className="bg-gray-50">
                            <td
                              colSpan={6}
                              className="px-6 py-4 text-xs text-gray-600"
                            >
                              {vaClients.length === 0 && (
                                <span className="text-gray-400">
                                  No clients linked to this VA.
                                </span>
                              )}
                              {vaClients.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {vaClients.map((client) => {
                                    const canImpersonate =
                                      Boolean(client.auth_user_id) &&
                                      Boolean(client.email);
                                    return (
                                      <button
                                        key={client.id}
                                        type="button"
                                        disabled={!canImpersonate}
                                        onClick={() => {
                                          if (!client.auth_user_id || !client.email) {
                                            return;
                                          }
                                          handleImpersonate(
                                            client.auth_user_id,
                                            client.email,
                                          );
                                        }}
                                        className={`rounded-full border px-3 py-1 transition-colors ${
                                          canImpersonate
                                            ? "bg-white border-gray-200 hover:border-[#9d4edd] hover:text-[#7b2cbf]"
                                            : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                        }`}
                                      >
                                        {client.first_name || "Client"}{" "}
                                        {client.last_name || ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                {activeTab === "client" &&
                  filteredClients.map((client) => {
                    const canImpersonate =
                      Boolean(client.auth_user_id) && Boolean(client.email);
                    const rowKey = client.auth_user_id || client.id;
                    return (
                      <tr key={rowKey} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-800 font-medium">
                          {client.first_name || "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {client.last_name || "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {client.email || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                            client
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {client.status || "unknown"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (!client.auth_user_id || !client.email) return;
                              handleImpersonate(
                                client.auth_user_id,
                                client.email,
                              );
                            }}
                            disabled={!canImpersonate || impersonatingId === rowKey}
                            className={`px-4 py-2 text-xs font-semibold rounded-full transition-colors ${
                              canImpersonate
                                ? "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            {impersonatingId === rowKey
                              ? "Starting..."
                              : canImpersonate
                              ? "View as Client"
                              : "No portal access"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {!loading &&
                  ((activeTab === "va" && filteredUsers.length === 0) ||
                    (activeTab === "client" && filteredClients.length === 0)) && (
                  <tr>
                    <td
                      colSpan={6}
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
