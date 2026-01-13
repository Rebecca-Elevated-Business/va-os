"use client";

import { useState, useEffect, Suspense } from "react"; // Added Suspense import
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

// Move the logic into a separate inner component
function CreateDocumentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId");

  const [clients, setClients] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);
  const [selectedClient, setSelectedClient] = useState(clientId || "");
  const [docType, setDocType] = useState<
    "proposal" | "booking_form" | "invoice"
  >("proposal");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name");
      if (data) setClients(data);
    }
    loadClients();
  }, []);

  const handleInitialiseDocument = async () => {
    if (!selectedClient) return alert("Please select a client first.");
    setLoading(true);

    const { data, error } = await supabase
      .from("client_documents")
      .insert([
        {
          client_id: selectedClient,
          type: docType,
          title: `New ${docType.replace("_", " ")}`,
          status: "draft",
          content: { sections: [] },
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Error: " + error.message);
      setLoading(false);
    } else {
      router.push(`/va/dashboard/documents/edit/${data.id}`);
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 space-y-6">
      {/* Client Selection */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
          Select Client
        </label>
        <select
          className="w-full border p-3 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-purple-200"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="">-- Choose a Client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Document Type Selection */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
          Document Type
        </label>
        <div className="grid grid-cols-3 gap-4">
          {(["proposal", "booking_form", "invoice"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setDocType(type)}
              className={`p-4 rounded-xl border-2 transition-all text-center capitalize font-bold text-sm ${
                docType === type
                  ? "border-[#9d4edd] bg-purple-50 text-[#9d4edd]"
                  : "border-gray-100 text-gray-400 hover:border-gray-200"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleInitialiseDocument}
        disabled={loading}
        className="w-full bg-[#9d4edd] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#7b2cbf] transition-all shadow-lg disabled:bg-gray-300"
      >
        {loading ? "Creating..." : "Generate Document Draft"}
      </button>
    </div>
  );
}

// The main page component now just provides the Suspense boundary
export default function CreateDocumentPage() {
  return (
    <div className="p-10 max-w-2xl mx-auto text-black">
      <h1 className="text-3xl font-black mb-8 uppercase tracking-tight">
        Create New Document
      </h1>

      <Suspense
        fallback={
          <div className="p-8 text-center text-gray-400">Loading form...</div>
        }
      >
        <CreateDocumentForm />
      </Suspense>
    </div>
  );
}
