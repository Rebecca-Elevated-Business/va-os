"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function CreateDocumentForm() {
  const router = useRouter();
  const [clients, setClients] = useState<
    { id: string; first_name: string; surname: string; business_name: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
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

  const handleCreate = async (
    type: "proposal" | "booking_form" | "invoice" | "upload"
  ) => {
    if (!selectedClient) return;
    setLoading(true); // Now using the state

    const { data, error } = await supabase
      .from("client_documents")
      .insert([
        {
          client_id: selectedClient.id,
          type: type,
          title: `Draft ${type.replace("_", " ")}`,
          status: "draft",
          content: { sections: [] },
        },
      ])
      .select()
      .single();

    if (!error) {
      router.push(`/va/dashboard/documents/edit-${type}/${data.id}`);
    } else {
      alert("Error: " + error.message);
      setLoading(false); // Reset on error
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.surname.toLowerCase().includes(search.toLowerCase()) ||
      c.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Generate Document
        </h2>
        <p className="text-sm text-gray-400 font-medium">
          Select a client and choose document type
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
            Search Client
          </label>
          <input
            type="text"
            placeholder="Search by surname or business..."
            className="w-full p-4 border-2 border-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 focus:border-[#9d4edd] bg-gray-50 text-black transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedClient(null);
            }}
          />

          {search && !selectedClient && (
            <div className="mt-2 border border-gray-100 rounded-2xl max-h-48 overflow-y-auto divide-y shadow-xl bg-white animate-in fade-in slide-in-from-top-2">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  disabled={loading}
                  onClick={() => {
                    setSelectedClient(c);
                    setSearch(`${c.first_name} ${c.surname}`);
                  }}
                  className="w-full text-left p-4 hover:bg-purple-50 flex justify-between items-center transition-colors disabled:opacity-50"
                >
                  <span className="font-bold text-gray-900">
                    {c.first_name} {c.surname}
                  </span>
                  <span className="text-[10px] font-black text-[#9d4edd] bg-purple-50 px-2 py-1 rounded-lg uppercase">
                    {c.business_name || "Personal"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedClient && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-center">
              <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">
                Target Client
              </p>
              <p className="font-bold text-green-900">
                {selectedClient.first_name} {selectedClient.surname}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={loading}
                onClick={() => handleCreate("proposal")}
                className="bg-[#9d4edd] text-white p-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#7b2cbf] transition-all shadow-lg shadow-purple-100 disabled:bg-gray-300"
              >
                {loading ? "..." : "Proposal"}
              </button>
              <button
                disabled={loading}
                onClick={() => handleCreate("booking_form")}
                className="bg-gray-900 text-white p-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all disabled:bg-gray-300"
              >
                {loading ? "..." : "Booking Form"}
              </button>
              <button
                disabled={loading}
                onClick={() => handleCreate("invoice")}
                className="bg-gray-100 text-gray-600 p-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all disabled:bg-gray-300"
              >
                {loading ? "..." : "Invoice"}
              </button>
              <button
                disabled={loading}
                onClick={() => handleCreate("upload")}
                className="border-2 border-dashed border-gray-200 text-gray-400 p-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all disabled:bg-gray-300"
              >
                {loading ? "..." : "Upload Own"}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                disabled={loading}
                onClick={() => {
                  setSelectedClient(null);
                  setSearch("");
                }}
                className="text-xs font-bold text-gray-300 hover:text-red-400 transition-colors uppercase tracking-widest disabled:hidden"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateDocumentPage() {
  return (
    <div className="p-10 min-h-screen bg-gray-50 flex flex-col justify-center">
      <Suspense
        fallback={
          <div className="text-center italic text-gray-400">
            Loading selector...
          </div>
        }
      >
        <CreateDocumentForm />
      </Suspense>
    </div>
  );
}
