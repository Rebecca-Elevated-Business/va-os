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
type ClientDocument = {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
};

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [clientName, setClientName] = useState("");
  const [documents, setDocuments] = useState<ClientDocument[]>([]);

  // Request Form State
  const [requestType, setRequestType] = useState<"work" | "meeting">("work");
  const [requestMessage, setRequestMessage] = useState("");

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
        const { data: ags } = await supabase
          .from("client_agreements")
          .select("id, title, status, last_updated_at")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("last_updated_at", { ascending: false });

        if (ags) setAgreements(ags as Agreement[]);

        // 4. Fetch Documents (Proposals, Booking Forms, Invoices)
        // Safety Filter: .neq("status", "draft") ensures they only see issued items
        const { data: docs } = await supabase
          .from("client_documents")
          .select("*")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("created_at", { ascending: false });

        if (docs) setDocuments(docs);
      }
      setLoading(false);
    }
    loadClientData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Request Sent! \nType: ${requestType} \nMessage: ${requestMessage}`);
    setRequestMessage("");
  };

  if (loading)
    return <div className="p-10 text-gray-500">Loading your portal...</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10 text-black">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {clientName}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all shadow-sm"
          >
            Sign Out
          </button>
        </div>

        {/* SECTION 1: DOCUMENT VAULT (Proposals, Booking Forms, Invoices) */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-[#9d4edd]">
                Document Vault
              </h2>
              <p className="text-xs text-gray-500">
                Access your issued proposals, contracts, and invoices.
              </p>
            </div>
            <div className="text-xl">📂</div>
          </div>

          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-50 bg-gray-50/30">
                  <th className="px-6 py-3 font-bold">Document Name</th>
                  <th className="px-6 py-3 font-bold">Type</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-gray-400 italic"
                    >
                      No documents available yet.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-sm">
                        {doc.title}
                      </td>
                      <td className="px-6 py-4 capitalize text-xs text-gray-500">
                        {doc.type.replace("_", " ")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                            doc.status === "paid" || doc.status === "signed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            router.push(`/client/documents/view/${doc.id}`)
                          }
                          className="bg-gray-900 text-white px-4 py-1.5 rounded-lg font-bold text-xs hover:bg-[#9d4edd]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 2: SERVICE AGREEMENTS (Operational Workflows) */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">
              Operational Agreements
            </h2>
            <p className="text-xs text-gray-500">
              Authorised rules of engagement and service parameters.
            </p>
          </div>

          {agreements.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic">
              You have no active service agreements at this time.
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
                    {ag.status === "pending_client"
                      ? "Review & Sign"
                      : "View Agreement"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: REQUEST CENTRE */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-blue-50/30">
            <h2 className="text-lg font-bold text-gray-800">Request Centre</h2>
            <p className="text-xs text-gray-500">
              Send a direct work or meeting request to your VA.
            </p>
          </div>

          <div className="p-6">
            <div className="flex gap-6 mb-6">
              <label
                className={`flex-1 cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                  requestType === "work"
                    ? "border-[#9d4edd] bg-purple-50 text-[#9d4edd]"
                    : "border-gray-100 text-gray-400 hover:border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={requestType === "work"}
                  onChange={() => setRequestType("work")}
                />
                <span className="font-bold text-sm">
                  Request Additional Work
                </span>
              </label>
              <label
                className={`flex-1 cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                  requestType === "meeting"
                    ? "border-[#9d4edd] bg-purple-50 text-[#9d4edd]"
                    : "border-gray-100 text-gray-400 hover:border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={requestType === "meeting"}
                  onChange={() => setRequestType("meeting")}
                />
                <span className="font-bold text-sm">Request a Meeting</span>
              </label>
            </div>

            <form
              onSubmit={handleSendRequest}
              className="flex gap-4 items-start"
            >
              <textarea
                className="flex-1 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 bg-gray-50 min-h-20"
                placeholder={
                  requestType === "work"
                    ? "Describe the task..."
                    : "Propose a date/time..."
                }
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={!requestMessage}
                className="bg-[#9d4edd] text-white px-6 py-3 rounded-lg font-bold text-sm shadow-md hover:bg-[#7b2cbf] h-20 disabled:opacity-50"
              >
                Send Request
              </button>
            </form>
          </div>
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
