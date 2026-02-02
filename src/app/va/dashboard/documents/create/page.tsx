"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { usePrompt } from "@/components/ui/PromptProvider";

const DOCUMENT_TYPES = [
  { id: "proposal", label: "Proposal", accent: "bg-[#9d4edd]" },
  { id: "booking_form", label: "Booking Form", accent: "bg-black" },
  { id: "invoice", label: "Invoice", accent: "bg-gray-700" },
  { id: "upload", label: "Upload", accent: "bg-gray-400" },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]["id"];

const formatClientName = (client: { first_name: string; surname: string }) =>
  `${client.first_name} ${client.surname}`.trim();

const formatClientLabel = (client: {
  first_name: string;
  surname: string;
  business_name: string;
}) => {
  const name = formatClientName(client);
  if (client.business_name) {
    return name ? `${name} (${client.business_name})` : client.business_name;
  }
  return name || "Unnamed Client";
};

function CreateDocumentForm() {
  const router = useRouter();
  const { alert } = usePrompt();
  const searchParams = useSearchParams();
  const typeParamRaw = searchParams.get("type");
  const typeParam = DOCUMENT_TYPES.some((doc) => doc.id === typeParamRaw)
    ? (typeParamRaw as DocumentType)
    : null;
  const clientIdParam = searchParams.get("clientId");
  const [clients, setClients] = useState<
    { id: string; first_name: string; surname: string; business_name: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<DocumentType | null>(
    typeParam
  );
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    first_name: string;
    surname: string;
    business_name: string;
  } | null>(null);
  const isClientLocked = Boolean(clientIdParam);

  useEffect(() => {
    async function loadClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .order("surname");
      if (data) {
        setClients(data);
        if (clientIdParam) {
          const match = data.find((client) => client.id === clientIdParam);
          if (match) {
            setSelectedClient(match);
            setSearch(formatClientLabel(match));
          }
        }
      }
    }
    loadClients();
  }, [clientIdParam]);

  const typeLabels: Record<string, string> = {
    proposal: "Proposal",
    booking_form: "Booking Form",
    invoice: "Invoice",
  };

  const handleCreate = async () => {
    if (!selectedClient || !selectedType) return;
    setLoading(true); // Now using the state

    const { data, error } = await supabase
      .from("client_documents")
      .insert([
        {
          client_id: selectedClient.id,
          type: selectedType,
          title: typeLabels[selectedType] ?? selectedType.replace("_", " "),
          status: "draft",
          content: { sections: [] },
        },
      ])
      .select()
      .single();

    if (!error) {
      router.push(`/va/dashboard/documents/edit-${selectedType}/${data.id}`);
    } else {
      await alert({
        title: "Error",
        message: `Error: ${error.message}`,
        tone: "danger",
      });
      setLoading(false); // Reset on error
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.first_name.toLowerCase().includes(search.toLowerCase()) ||
      c.surname.toLowerCase().includes(search.toLowerCase()) ||
      c.business_name?.toLowerCase().includes(search.toLowerCase())
  );
  const canShowResults =
    !isClientLocked && !selectedClient && search.trim().length >= 2;
  const clientList = canShowResults ? filteredClients : [];
  const shouldShowEmptyState = canShowResults && clientList.length === 0;

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-5xl mx-auto relative">
      <button
        onClick={() => {
          if (clientIdParam) {
            router.push(`/va/dashboard/crm/profile/${clientIdParam}`);
          } else {
            router.back();
          }
        }}
        className="absolute left-6 top-6 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" />
        {clientIdParam ? "Back to CRM" : "Back"}
      </button>

      <div className="flex flex-col items-center text-center mb-8 gap-2 pt-6">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
          Generate Document
        </h2>
        <p className="text-sm text-gray-400 font-medium">
          Select a document type and match it with a client
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Document Type
          </p>
          {selectedType ? (
            <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Selected
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {
                    DOCUMENT_TYPES.find((doc) => doc.id === selectedType)
                      ?.label
                  }
                </p>
              </div>
              {!typeParam && (
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {DOCUMENT_TYPES.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedType(doc.id)}
                  className="border border-gray-100 rounded-2xl p-4 text-left hover:border-[#9d4edd] hover:shadow-sm transition flex items-center justify-between"
                >
                  <span className="font-bold text-gray-900">{doc.label}</span>
                  <span
                    className={`h-3 w-3 rounded-full ${doc.accent}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5 text-sm text-purple-900">
            <p className="font-semibold mb-2">
              Once generated, the draft opens for editing.
            </p>
            <p className="text-purple-800">
              Proposals, booking forms, and invoices each have different sections
              and validation logic, so the initial selection matters.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Client Selection
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 p-4 bg-white shadow-sm">
            {isClientLocked && selectedClient ? (
              <div className="text-center py-6">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">
                  Client Preselected from CRM
                </p>
                <p className="text-lg font-bold">
                  <span className="text-[#333333]">
                    {formatClientName(selectedClient) || "Unnamed Client"}
                  </span>
                  {selectedClient.business_name && (
                    <span className="text-[#525252]">
                      {" "}
                      ({selectedClient.business_name})
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Documents from CRM are generated directly for this client.
                </p>
              </div>
            ) : (
              <>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Search Client
                </label>
                <input
                  type="text"
                  placeholder="Search by Client / Business Name"
                  className="w-full p-4 border-2 border-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 focus:border-[#9d4edd] bg-gray-50 text-black transition-all"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedClient(null);
                  }}
                />

                <div className="mt-4 max-h-64 overflow-y-auto grid gap-2">
                  {shouldShowEmptyState && (
                    <div className="text-center text-xs text-gray-400 py-6">
                      No clients match your search.
                    </div>
                  )}
                  {clientList.map((c) => {
                    const isActive = selectedClient?.id === c.id;
                    const name = formatClientName(c);
                    return (
                      <button
                        key={c.id}
                        disabled={loading}
                        onClick={() => {
                          setSelectedClient(c);
                          setSearch("");
                        }}
                        className={`w-full text-left p-4 rounded-xl border transition ${
                          isActive
                            ? "border-[#9d4edd] bg-purple-50"
                            : "border-gray-100 hover:border-[#9d4edd]"
                        }`}
                      >
                        <span className="font-bold text-[#333333]">
                          {name || "Unnamed Client"}
                        </span>
                        {c.business_name && (
                          <span className="text-[#525252]">
                            {" "}
                            ({c.business_name})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {selectedClient && (
            <div className="relative p-4 bg-green-50 border border-green-100 rounded-2xl text-center">
              <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">
                Target Client
              </p>
              <p className="font-bold text-green-900">
                {selectedClient.first_name} {selectedClient.surname}
              </p>
              {!isClientLocked && (
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setSearch("");
                  }}
                  className="absolute bottom-3 right-3 text-red-400 hover:text-red-500"
                  aria-label="Remove client"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <button
            disabled={loading || !selectedClient || !selectedType}
            onClick={handleCreate}
            className="w-full bg-[#9d4edd] text-white p-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#7b2cbf] transition-all shadow-lg shadow-purple-100 disabled:bg-gray-300"
          >
            {loading ? "Generating..." : "Generate Document"}
          </button>
        </div>
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
