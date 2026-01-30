"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usePrompt } from "@/components/ui/PromptProvider";
import {
  FileText,
  FileSignature,
  ReceiptText,
  Upload,
  Search,
} from "lucide-react";

// Define the document types based on your workflow
const DOCUMENT_TYPES = [
  {
    id: "proposal",
    title: "Proposal",
    description:
      "Outline project scope, service options, and estimated timelines for potential clients.",
    icon: FileText,
  },
  {
    id: "booking_form",
    title: "Booking Form",
    description:
      "Confirm client details, project information, and booking particulars in a personalised form.",
    icon: FileSignature,
  },
  {
    id: "invoice",
    title: "Invoice",
    description:
      "Generate billable item summaries with British Pound (£) currency and due dates.",
    icon: ReceiptText,
  },
  {
    id: "upload",
    title: "Upload",
    description:
      "Upload an existing PDF or document from your device to send directly to the client portal.",
    icon: Upload,
  },
];

export default function DocumentLibraryPage() {
  const router = useRouter();
  const { alert } = usePrompt();
  const [selectedType, setSelectedType] = useState<
    (typeof DOCUMENT_TYPES)[0] | null
  >(null);
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<
    { id: string; first_name: string; surname: string; business_name: string }[]
  >([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    first_name: string;
    surname: string;
    business_name: string;
  } | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    if (!selectedType || clients.length > 0) return;
    async function loadClients() {
      setLoadingClients(true);
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .order("surname");
      if (data) setClients(data);
      setLoadingClients(false);
    }
    loadClients();
  }, [selectedType, clients.length]);

  const closeModal = () => {
    setSelectedType(null);
    setSelectedClient(null);
    setClientSearch("");
  };

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return DOCUMENT_TYPES;
    const value = search.toLowerCase();
    return DOCUMENT_TYPES.filter(
      (doc) =>
        doc.title.toLowerCase().includes(value) ||
        doc.description.toLowerCase().includes(value),
    );
  }, [search]);

  const filteredClients = useMemo(() => {
    const value = clientSearch.toLowerCase();
    return clients.filter(
      (client) =>
        client.first_name.toLowerCase().includes(value) ||
        client.surname.toLowerCase().includes(value) ||
        client.business_name?.toLowerCase().includes(value),
    );
  }, [clients, clientSearch]);

  const canShowResults =
    !selectedClient && clientSearch.trim().length >= 2 && !loadingClients;
  const clientList = canShowResults ? filteredClients : [];
  const shouldShowEmptyState = canShowResults && clientList.length === 0;

  const handleGenerate = async () => {
    if (!selectedType || !selectedClient) return;
    const { data, error } = await supabase
      .from("client_documents")
      .insert([
        {
          client_id: selectedClient.id,
          type: selectedType.id,
          title: `Draft ${selectedType.id.replace("_", " ")}`,
          status: "draft",
          content: { sections: [] },
        },
      ])
      .select()
      .single();

    if (error || !data) {
      await alert({
        title: "Error",
        message: `Error: ${error?.message || "Unable to create document"}`,
        tone: "danger",
      });
      return;
    }

    const editRoute =
      selectedType.id === "upload"
        ? "edit-upload"
        : `edit-${selectedType.id}`;
    router.push(`/va/dashboard/documents/${editRoute}/${data.id}`);
    closeModal();
  };

  return (
    <div className="text-black">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Document Centre</h1>
          <p className="text-gray-500 max-w-2xl">
            Create polished proposals, contracts, and invoices in minutes.
            Drafts are saved to the client vault for review and sending.
          </p>
        </div>
        <div className="w-full max-w-md">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            Search Document Type
          </label>
          <div className="flex items-center gap-2 bg-white border border-[#333333] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#9d4edd]/20">
            <Search className="h-4 w-4 text-[#9d4edd]" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search proposals, invoices, uploads..."
              className="w-full bg-transparent text-sm text-gray-700 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredTypes.map((doc) => {
          const Icon = doc.icon;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedType(doc)}
              className="group text-left bg-white border border-gray-100 rounded-2xl p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-[#9d4edd]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#9d4edd]">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#9d4edd] transition-colors uppercase tracking-tight">
                {doc.title}
              </h3>
              <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                {doc.description}
              </p>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 border-b border-gray-100">
              <div>
                <h1 className="text-2xl font-bold">{selectedType.title}</h1>
              </div>
              <button
                onClick={closeModal}
                className="h-9 w-9 rounded-full border border-[#525252] text-[#525252] hover:text-[#333333] hover:border-[#333333] transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold mb-4 uppercase text-[#9d4edd] tracking-tight">
                  Document Overview
                </h2>
                {selectedType.id === "proposal" && (
                  <>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      Create a polished, personalised proposal that clearly
                      outlines how you&apos;ll support your client and what
                      working together will look like. Designed to help you
                      present your services with clarity, confidence, and
                      credibility.
                    </p>
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Professionally structured and client-ready
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Easy to tailor to each client&apos;s needs
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Helps set expectations and build trust from the start
                      </li>
                    </ul>
                  </>
                )}
                {selectedType.id === "booking_form" && (
                  <>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      Create a clear, professional booking form to gather key
                      client details and confirm how you&apos;ll be working
                      together. Designed to help you start projects smoothly,
                      set expectations, and keep everything organised from day
                      one.
                    </p>
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Collect essential client and project information
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Simple for clients to complete and sign
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Supports a confident, well-structured onboarding
                        experience
                      </li>
                    </ul>
                  </>
                )}
                {selectedType.id === "invoice" && (
                  <>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      Create a clear, professional invoice to request payment
                      for your services and keep client finances organised.
                      Designed to help you bill with confidence and present your
                      work in a way that feels straightforward and polished.
                    </p>
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Clearly itemise services and amounts
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Simple for clients to review and process
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Supports a professional, stress-free payment experience
                      </li>
                    </ul>
                  </>
                )}
                {selectedType.id === "upload" && (
                  <>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      Upload and share documents securely with your client,
                      keeping everything related to their work in one central
                      place. Designed to reduce back-and-forth and ensure
                      important files are always easy to find.
                    </p>
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Secure document sharing in one location
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Keeps client information organised and accessible
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#9d4edd]">✓</span>
                        Supports smooth, transparent collaboration
                      </li>
                    </ul>
                  </>
                )}
              </div>

              <div className="bg-purple-50 rounded-xl border border-purple-100 p-6 text-center flex flex-col justify-between gap-6">
                <div>
                  <p className="text-purple-900 font-medium">
                    Ready to{" "}
                    {selectedType.id === "upload"
                      ? "upload this file?"
                      : "issue this to a client?"}
                  </p>
                  <p className="text-sm text-purple-700 mt-2 italic">
                    {selectedType.id === "upload"
                      ? "Ensure your file is finalized before uploading."
                      : "Generate the draft to begin adding project-specific details."}
                  </p>
                </div>
                <div className="text-left space-y-3">
                  <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                    Select Client
                  </label>
                  {selectedClient ? (
                    <div className="flex items-center justify-between bg-white border border-purple-100 rounded-2xl px-4 py-3">
                      <div className="text-sm text-purple-900 font-semibold">
                        {selectedClient.business_name ||
                          `${selectedClient.first_name} ${selectedClient.surname}`}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(null);
                          setClientSearch("");
                        }}
                        className="text-xs font-bold text-purple-500 hover:text-purple-700 uppercase tracking-widest"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 bg-white border border-purple-100 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#9d4edd]/20">
                        <Search
                          className="h-4 w-4 text-[#9d4edd]"
                          aria-hidden
                        />
                        <input
                          value={clientSearch}
                          onChange={(event) =>
                            setClientSearch(event.target.value)
                          }
                          placeholder="Search clients..."
                          className="w-full bg-transparent text-sm text-gray-700 outline-none"
                        />
                      </div>
                      {clientList.length > 0 && (
                        <div className="bg-white border border-purple-100 rounded-2xl p-2 max-h-48 overflow-y-auto">
                          {clientList.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setSelectedClient(client);
                                setClientSearch(
                                  client.business_name ||
                                    `${client.first_name} ${client.surname}`,
                                );
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-purple-50"
                            >
                              <div className="font-semibold text-gray-900">
                                {client.business_name ||
                                  `${client.first_name} ${client.surname}`}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {client.business_name
                                  ? `${client.first_name} ${client.surname}`
                                  : "Client"}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {shouldShowEmptyState && (
                        <div className="text-xs text-purple-500">
                          No clients match that search.
                        </div>
                      )}
                      {loadingClients && (
                        <div className="text-xs text-purple-500">
                          Loading clients...
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-black"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!selectedClient}
                    className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#7b2cbf] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedType.id === "upload"
                      ? "Go to Upload"
                      : "Generate Document"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
