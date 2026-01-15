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

  // Data State
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);

  // Dashboard Logic State
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  // DEBUG STATE
  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

  // Request Form State
  const [requestType, setRequestType] = useState<"work" | "meeting">("work");
  const [requestMessage, setRequestMessage] = useState("");
  const [sending, setSending] = useState(false);

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

      setDebugInfo(`Logged in as Auth User: ${user.id}`);

      // 2. Find the CRM Client record linked to this Login ID
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, first_name")
        .eq("auth_user_id", user.id)
        .single();

      if (clientError) {
        console.error("Client Fetch Error:", clientError);
        setDebugInfo(
          `ERROR: Could not find Client Record linked to Auth ID ${user.id}. DB says: ${clientError.message}`
        );
      } else if (client) {
        setClientName(client.first_name);
        setClientId(client.id);
        setDebugInfo(
          `SUCCESS: Linked to Client ID: ${client.id} (${client.first_name})`
        );

        // 3. Fetch Agreements
        const { data: ags } = await supabase
          .from("client_agreements")
          .select("id, title, status, last_updated_at")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("last_updated_at", { ascending: false });

        if (ags) setAgreements(ags as Agreement[]);

        // 4. Fetch Documents
        const { data: docs } = await supabase
          .from("client_documents")
          .select("*")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("created_at", { ascending: false });

        if (docs) setDocuments(docs as ClientDocument[]);
      } else {
        setDebugInfo(`WARNING: No client record found for Auth ID ${user.id}`);
      }
      setLoading(false);
    }
    loadClientData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // DEBUG: Alert if ID is missing
    if (!clientId) {
      alert(
        `STOP: Cannot send. System does not know your Client ID.\nDebug Info: ${debugInfo}`
      );
      return;
    }

    if (!requestMessage.trim()) return;

    setSending(true);

    // FIX: Removed 'data' variable since we don't use it
    const { error } = await supabase.from("client_requests").insert([
      {
        client_id: clientId,
        type: requestType,
        message: requestMessage,
        status: "new",
        is_read: false,
        is_completed: false,
        is_starred: false,
      },
    ]);

    setSending(false);

    if (error) {
      alert("DATABASE ERROR: " + error.message + "\nCode: " + error.code);
      console.error("Insert Error:", error);
    } else {
      alert("SUCCESS: Request sent to database! Row created.");
      setRequestMessage("");
    }
  };

  if (loading)
    return (
      <div className="p-10 text-gray-500 italic">Loading your portal...</div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10 text-black font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* DIAGNOSTIC BAR */}
        <div
          className={`p-4 rounded-xl border-2 font-mono text-xs break-all ${
            clientId
              ? "bg-green-100 border-green-300 text-green-800"
              : "bg-red-100 border-red-300 text-red-800"
          }`}
        >
          <strong>DIAGNOSTIC STATUS:</strong> {debugInfo}
        </div>

        {/* Header Section */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Welcome, {clientName || "Client"}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all shadow-sm"
          >
            Sign Out
          </button>
        </div>

        {/* SECTION 1: DOCUMENT VAULT */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-[#9d4edd] uppercase tracking-wide">
                Document Vault
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Access your issued proposals, contracts, and invoices.
              </p>
            </div>
            <div className="text-2xl">📂</div>
          </div>

          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-50 bg-gray-50/30">
                  <th className="px-8 py-4 font-black">Document Name</th>
                  <th className="px-8 py-4 font-black">Type</th>
                  <th className="px-8 py-4 font-black">Status</th>
                  <th className="px-8 py-4 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-10 text-center text-gray-400 italic text-sm"
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
                      <td className="px-8 py-5 font-bold text-sm">
                        {doc.title}
                      </td>
                      <td className="px-8 py-5 capitalize text-xs text-gray-500 font-medium">
                        {doc.type.replace("_", " ")}
                      </td>
                      <td className="px-8 py-5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            doc.status === "paid" || doc.status === "signed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() =>
                            router.push(`/client/documents/view/${doc.id}`)
                          }
                          className="bg-gray-900 text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-[#9d4edd] transition-colors uppercase tracking-wider"
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

        {/* SECTION 2: SERVICE AGREEMENTS */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">
              Operational Agreements
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Authorised rules of engagement and service parameters.
            </p>
          </div>

          {agreements.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic text-sm">
              You have no active service agreements at this time.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agreements.map((ag) => (
                <div
                  key={ag.id}
                  className="p-8 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 text-[#9d4edd] w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner">
                      📄
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{ag.title}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Status:{" "}
                        <span
                          className={`uppercase font-black tracking-wider ${
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
                    className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#7b2cbf] transition-all uppercase tracking-wider"
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

        {/* SECTION 3: REQUEST CENTRE (Updated with Real Logic) */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-blue-50/30">
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">
              Request Centre
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Send a direct work or meeting request to your VA.
            </p>
          </div>

          <div className="p-8">
            <div className="flex gap-6 mb-6">
              <label
                className={`flex-1 cursor-pointer border-2 rounded-2xl p-4 text-center transition-all ${
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
                <span className="font-black text-xs uppercase tracking-widest">
                  Request Work
                </span>
              </label>
              <label
                className={`flex-1 cursor-pointer border-2 rounded-2xl p-4 text-center transition-all ${
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
                <span className="font-black text-xs uppercase tracking-widest">
                  Request Meeting
                </span>
              </label>
            </div>

            <form
              onSubmit={handleSendRequest}
              className="flex gap-4 items-start"
            >
              <textarea
                className="flex-1 border-2 border-gray-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-purple-50 focus:border-[#9d4edd] bg-gray-50 min-h-24 transition-all"
                placeholder={
                  requestType === "work"
                    ? "Describe the task you need help with..."
                    : "Propose a date and time for a quick sync..."
                }
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={!requestMessage || sending}
                className="bg-[#9d4edd] text-white px-8 py-3 rounded-2xl font-black text-xs shadow-xl shadow-purple-100 hover:bg-[#7b2cbf] h-24 disabled:opacity-50 uppercase tracking-widest transition-all"
              >
                {sending ? "Sending..." : "Send Request"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
