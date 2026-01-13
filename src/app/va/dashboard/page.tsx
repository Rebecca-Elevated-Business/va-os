"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// --- TYPES ---
type ClientRequest = {
  id: string;
  created_at: string;
  type: "work" | "meeting";
  message: string;
  status: string;
  clients: {
    first_name: string;
    last_name: string;
  } | null;
};

type DashboardStats = {
  totalClients: number;
  activeAgreements: number;
  revenueYTD: number;
};

export default function VADashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vaName, setVaName] = useState("");

  // Data State
  const [recentRequests, setRecentRequests] = useState<ClientRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeAgreements: 0,
    revenueYTD: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      // 1. Auth Check
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 2. Get VA Profile Name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) setVaName(profile.full_name);

      // 3. Fetch "New" Requests
      const { data: reqs } = await supabase
        .from("client_requests")
        .select(
          `
          id, 
          created_at, 
          type, 
          message, 
          status,
          clients (first_name, last_name)
        `
        )
        .eq("status", "new")
        .order("created_at", { ascending: false });

      if (reqs) {
        // Supabase returns joined data as an object or array. Casting safely.
        const formattedReqs = reqs.map((r) => ({
          ...r,
          clients: Array.isArray(r.clients) ? r.clients[0] : r.clients,
        })) as unknown as ClientRequest[];

        setRecentRequests(formattedReqs);
      }

      // 4. Fetch Quick Stats (Mock logic for now - replace with real counts later)
      // For now we just count rows in clients table
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });
      const { count: activeDocs } = await supabase
        .from("client_agreements")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      setStats({
        totalClients: clientCount || 0,
        activeAgreements: activeDocs || 0,
        revenueYTD: 12500, // Placeholder
      });

      setLoading(false);
    }

    loadDashboardData();
  }, [router]);

  const handleMarkRead = async (id: string) => {
    // Optimistic UI update: Remove it from the list immediately
    setRecentRequests((prev) => prev.filter((r) => r.id !== id));

    // Update DB in background
    await supabase
      .from("client_requests")
      .update({ status: "read" })
      .eq("id", id);
  };

  if (loading)
    return <div className="p-10 text-gray-500">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-black p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* --- HEADER --- */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {vaName}
            </h1>
            <p className="text-gray-500 mt-1">
              Here is what&apos;s happening in your VA-OS today.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>

        {/* --- MAIN DASHBOARD GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-100">
          {/* 1. NEW REQUESTS WIDGET (Left Column) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="font-bold text-gray-800">New Requests</h2>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Inbox Snapshot
                </p>
              </div>
              <div className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase">
                {recentRequests.length} New
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {recentRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 text-center space-y-2">
                  <div className="text-4xl opacity-20">📭</div>
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl border border-gray-100 bg-white hover:border-purple-100 hover:shadow-sm transition-all group relative"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        {/* ICON LOGIC: Green for Work, Blue for Meeting */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm ${
                            req.type === "work"
                              ? "bg-green-100 text-green-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          {req.type === "work" ? "💼" : "📅"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">
                            {req.clients?.first_name} {req.clients?.last_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(req.created_at).toLocaleString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Mark as Read Button */}
                      <button
                        onClick={() => handleMarkRead(req.id)}
                        className="text-gray-200 hover:text-green-500 transition-colors p-1"
                        title="Mark as Read"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed pl-11">
                      {req.message}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
              <button
                onClick={() => router.push("/va/dashboard/inbox")}
                className="text-xs font-bold text-[#9d4edd] hover:text-[#7b2cbf] flex items-center justify-center gap-1"
              >
                View Full Inbox <span>→</span>
              </button>
            </div>
          </div>

          {/* 2. STATS & TOOLS (Right 2 Columns) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-100">
            {/* Stat Card 1: Clients */}
            <div
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-purple-200 transition-colors cursor-pointer"
              onClick={() => router.push("/va/dashboard/crm")}
            >
              <div className="flex justify-between items-start">
                <div className="bg-orange-50 p-3 rounded-xl text-orange-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-300 uppercase">
                  Total
                </span>
              </div>
              <div>
                <h3 className="text-4xl font-black text-gray-900">
                  {stats.totalClients}
                </h3>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  Active Clients
                </p>
              </div>
            </div>

            {/* Stat Card 2: Revenue (Placeholder) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-green-200 transition-colors">
              <div className="flex justify-between items-start">
                <div className="bg-green-50 p-3 rounded-xl text-green-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-300 uppercase">
                  YTD
                </span>
              </div>
              <div>
                <h3 className="text-4xl font-black text-gray-900">
                  £{stats.revenueYTD.toLocaleString()}
                </h3>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  Est. Revenue
                </p>
              </div>
            </div>

            {/* Stat Card 3: Agreements */}
            <div
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors cursor-pointer"
              onClick={() => router.push("/va/dashboard/agreements")}
            >
              <div className="flex justify-between items-start">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-300 uppercase">
                  Status
                </span>
              </div>
              <div>
                <h3 className="text-4xl font-black text-gray-900">
                  {stats.activeAgreements}
                </h3>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  Active Workflows
                </p>
              </div>
            </div>

            {/* Tool Card 4: Create Document (Shortcut) */}
            <div
              onClick={() => router.push("/va/dashboard/documents/create")}
              className="bg-[#9d4edd] p-6 rounded-2xl shadow-lg shadow-purple-200 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-[#7b2cbf] transition-all"
            >
              <div className="bg-white/20 p-4 rounded-full mb-3 text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Create Document</h3>
              <p className="text-purple-200 text-xs mt-1">
                Proposal, Contract or Invoice
              </p>
            </div>
          </div>
        </div>

        {/* --- RECENT ACTIVITY TABLE (Secondary Info) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-bold text-gray-800">Recent System Activity</h2>
          </div>
          <div className="p-8 text-center text-gray-400 text-sm italic">
            Activity logs and system updates will appear here in future updates.
          </div>
        </div>
      </div>
    </div>
  );
}
