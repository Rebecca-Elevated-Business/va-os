"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Define strict types for the dashboard
type Agreement = {
  id: string;
  title: string;
  status: string;
  last_updated_at: string;
};

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    async function loadClientData() {
      // 1. Get the current logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/client/login");
        return;
      }

      // 2. Find the CRM Client record linked to this Login ID via the bridge
      const { data: client } = await supabase
        .from("clients")
        .select("id, first_name")
        .eq("auth_user_id", user.id)
        .single();

      if (client) {
        setClientName(client.first_name);

        // 3. Fetch Agreements specifically for this client
        // Safety Filter: .neq("status", "draft") ensures they only see published items
        const { data: ags } = await supabase
          .from("client_agreements")
          .select("id, title, status, last_updated_at")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("last_updated_at", { ascending: false });

        if (ags) setAgreements(ags as Agreement[]);
      }
      setLoading(false);
    }
    loadClientData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  if (loading)
    return <div className="p-10 text-gray-500">Loading your portal...</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10 text-black">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {clientName}
            </h1>
            <p className="text-gray-500">
              Manage your service authorizations and documents.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all shadow-sm"
          >
            Sign Out
          </button>
        </div>

        {/* Action Required Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">
              Documents & Agreements
            </h2>
          </div>

          {agreements.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic">
              You have no pending documents or issued agreements at this time.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agreements.map((ag) => (
                <div
                  key={ag.id}
                  className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 text-[#9d4edd] w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner">
                      📄
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{ag.title}</h3>
                      <p className="text-xs text-gray-500">
                        Status:{" "}
                        <span
                          className={`uppercase font-bold ${
                            ag.status === "active"
                              ? "text-green-600"
                              : "text-[#9d4edd]"
                          }`}
                        >
                          {ag.status.replace("_", " ")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    className="bg-[#9d4edd] text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-[#7b2cbf] transition-all"
                    onClick={() =>
                      router.push(
                        `/va/dashboard/agreements/portal-view/${ag.id}`
                      )
                    }
                  >
                    {/* Update: Show 'Review & Sign' if it's pending, otherwise 'View' */}
                    {ag.status === "pending_client"
                      ? "Review & Sign"
                      : "View Agreement"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Informational Note */}
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 leading-relaxed">
          <strong>Portal Note:</strong> These documents outline the specific
          boundaries and permissions you have granted to your VA. You can review
          them at any time to see the current rules of engagement.
        </div>
      </div>
    </main>
  );
}
