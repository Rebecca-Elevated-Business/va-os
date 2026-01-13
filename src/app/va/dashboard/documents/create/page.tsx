"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function CreateDocumentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get doc type from URL (e.g., ?type=proposal)
  const initialDocType =
    (searchParams.get("type") as "proposal" | "booking_form" | "invoice") ||
    "proposal";

  // Data State
  const [clients, setClients] = useState<
    { id: string; first_name: string; surname: string; business_name: string }[]
  >([]);
  const [docType, setDocType] = useState(initialDocType);
  const [loading, setLoading] = useState(false);

  // Search/Selection State (Mirrors Service Agreements)
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    first_name: string;
    surname: string;
    business_name: string;
  } | null>(null);

  useEffect(() => {
    async function loadClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .order("surname");
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
          client_id: selectedClient.id,
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

  // Filter Logic (Mirrors DeployAgreementPage)
  const filteredClients = clients.filter(
    (c) =>
      c.surname.toLowerCase().includes(search.toLowerCase()) ||
      c.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 space-y-8">
      {/* 1. SEARCHABLE CLIENT PICKER (Mirrors Service Agreements Appearance) */}
      <div className="space-y-4">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Search Client by Surname or Business
        </label>
        <input
          type="text"
          placeholder="Start typing to search..."
          className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-[#9d4edd] bg-gray-50 text-black transition-all"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedClient(null);
          }}
        />

        {search && !selectedClient && (
          <div className="border border-gray-100 rounded-xl max-h-60 overflow-y-auto divide-y shadow-lg bg-white animate-in fade-in zoom-in duration-200">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedClient(c);
                  setSearch(`${c.first_name} ${c.surname}`);
                }}
                className="w-full text-left p-4 hover:bg-purple-50 flex justify-between items-center transition-colors"
              >
                <span className="font-bold text-gray-900">
                  {c.first_name} {c.surname}
                </span>
                <span className="text-xs font-medium text-[#9d4edd] bg-purple-50 px-2 py-1 rounded">
                  {c.business_name || "Personal"}
                </span>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <p className="p-4 text-center text-gray-400 text-sm italic">
                No matching clients found.
              </p>
            )}
          </div>
        )}

        {selectedClient && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center animate-in slide-in-from-top-2">
            <div>
              <p className="text-[10px] text-green-600 font-black uppercase tracking-tighter">
                Document will be issued to:
              </p>
              <p className="font-bold text-green-900">
                {selectedClient.first_name} {selectedClient.surname}
                <span className="ml-2 font-normal opacity-60">
                  ({selectedClient.business_name})
                </span>
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedClient(null);
                setSearch("");
              }}
              className="text-xs font-bold text-green-700 underline hover:text-green-800"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* 2. DOCUMENT TYPE SELECTION (Kept from previous version for flexibility) */}
      <div className="pt-4 border-t border-gray-50">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Verify Document Type
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
        disabled={loading || !selectedClient}
        className="w-full bg-[#9d4edd] text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-[#7b2cbf] transition-all shadow-xl disabled:bg-gray-200 disabled:shadow-none mt-4"
      >
        {loading
          ? "Generating..."
          : `Create Draft ${docType.replace("_", " ")}`}
      </button>
    </div>
  );
}

export default function CreateDocumentPage() {
  return (
    <div className="p-10 max-w-2xl mx-auto text-black">
      <h1 className="text-3xl font-black mb-8 uppercase tracking-tight">
        Generate Document
      </h1>

      <Suspense
        fallback={
          <div className="p-8 text-center text-gray-400 italic">
            Initialising editor...
          </div>
        }
      >
        <CreateDocumentForm />
      </Suspense>
    </div>
  );
}
