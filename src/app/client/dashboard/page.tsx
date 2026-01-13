"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// 1. Define the Strict Type
type Agreement = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // 2. Apply the Type to State
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    async function loadClientData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/client/login");
        return;
      }

      // 3. Find the CRM Client record linked to this Login ID
      const { data: client } = await supabase
        .from("clients")
        .select("id, first_name")
        .eq("auth_user_id", user.id) // <--- USES THE BRIDGE
        .single();

      if (client) {
        setClientName(client.first_name);

        // 4. Fetch Agreements (THE SAFETY FILTER)
        const { data: ags } = await supabase
          .from("client_agreements")
          .select("*")
          .eq("client_id", client.id)
          .neq("status", "draft") // <--- THIS LINE HIDES DRAFTS
          .order("created_at", { ascending: false });

        // 5. Cast the data safely
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
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {clientName}
            </h1>
            <p className="text-gray-500">Manage your documents and tasks.</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all"
          >
            Sign Out
          </button>
        </div>

        {/* Documents Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">Action Required</h2>
          </div>

          {agreements.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic">
              You have no pending documents.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agreements.map((ag) => (
                <div
                  key={ag.id}
                  className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 text-[#9d4edd] w-10 h-10 rounded-full flex items-center justify-center text-xl">
                      📄
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{ag.title}</h3>
                      <p className="text-xs text-gray-500">
                        Status:{" "}
                        <span className="uppercase font-bold text-[#9d4edd]">
                          {ag.status.replace("_", " ")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    className="bg-[#9d4edd] text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-[#7b2cbf] transition-all"
                    onClick={() =>
                      alert("We will build the 'Sign Agreement' page next!")
                    }
                  >
                    Review & Sign
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
