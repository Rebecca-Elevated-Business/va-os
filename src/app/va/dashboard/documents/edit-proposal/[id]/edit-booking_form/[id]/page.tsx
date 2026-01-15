"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";

// 1. Define the internal content structure
type BookingContent = {
  header_image?: string;
  client_name?: string;
  va_name?: string;
  scope_of_work?: string;
  pricing_summary?: string;
  start_date?: string;
  further_agreements?: string;
  legal_terms?: string;
};

// 2. Define the main Document type
type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  content: BookingContent;
};

// 3. Define the shape of the data coming back from Supabase Join
type FetchedDoc = ClientDoc & {
  clients: {
    first_name: string;
    surname: string;
  };
};

export default function EditBookingFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<ClientDoc | null>(null);

  useEffect(() => {
    async function loadDoc() {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*, clients(first_name, surname)")
        .eq("id", id)
        .single();

      if (data && !error) {
        // Cast to our Intersection Type to safely access .clients
        const fetchedData = data as FetchedDoc;

        // Initialise with Library Template if content is empty
        if (!fetchedData.content.legal_terms) {
          const template = DOCUMENT_TEMPLATES.booking_form;

          fetchedData.content = {
            ...fetchedData.content,
            header_image: template.header_image,
            client_name: `${fetchedData.clients.first_name} ${fetchedData.clients.surname}`,
            va_name: "Your Name",
            scope_of_work: "Detailed in Proposal",
            pricing_summary: "£",
            start_date: "",
            further_agreements: "None",
            legal_terms:
              template.sections.legal_text ||
              "Master terms not found in library.",
          };
        }
        setDoc(fetchedData);
      }
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  const updateField = (field: keyof BookingContent, value: string) => {
    if (!doc) return;
    setDoc({
      ...doc,
      content: { ...doc.content, [field]: value },
    });
  };

  const handleSave = async (isIssuing = false) => {
    if (!doc) return;
    setSaving(true);

    const { error } = await supabase
      .from("client_documents")
      .update({
        content: doc.content,
        status: isIssuing ? "issued" : "draft",
        issued_at: isIssuing ? new Date().toISOString() : null,
      })
      .eq("id", id);

    setSaving(false);
    if (!error) {
      alert(isIssuing ? "Booking Form Issued!" : "Draft Saved.");
      if (isIssuing) router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    } else {
      alert("Error: " + error.message);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center text-gray-400 italic">
        Loading Booking Form...
      </div>
    );
  if (!doc)
    return (
      <div className="p-10 text-center text-red-500 font-bold">
        Document not found.
      </div>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto text-black pb-40 font-sans">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Booking Form Builder
          </h1>
          <p className="text-[10px] font-black text-[#9d4edd] uppercase tracking-[0.2em] mt-2">
            Contract for: {doc.content.client_name}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {saving ? "..." : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-6 py-2 bg-[#9d4edd] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#7b2cbf] shadow-xl shadow-purple-100 transition-all disabled:opacity-50"
          >
            {saving ? "..." : "Issue for Signature"}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* BASIC DETAILS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-4xl border border-gray-100 shadow-sm">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              VA Legal Name (Signatory)
            </label>
            <input
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 font-bold border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.va_name || ""}
              onChange={(e) => updateField("va_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Proposed Start Date
            </label>
            <input
              type="date"
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.start_date || ""}
              onChange={(e) => updateField("start_date", e.target.value)}
            />
          </div>
        </div>

        {/* WORK & PAYMENT SUMMARY */}
        <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Agreed Scope Summary
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 text-sm min-h-25 border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.scope_of_work || ""}
              onChange={(e) => updateField("scope_of_work", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Pricing & Payment Schedule
            </label>
            <input
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 font-bold text-[#9d4edd] border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.pricing_summary || ""}
              onChange={(e) => updateField("pricing_summary", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Further Agreements
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 text-sm border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.further_agreements || ""}
              onChange={(e) =>
                updateField("further_agreements", e.target.value)
              }
            />
          </div>
        </div>

        {/* MASTER TERMS (FROM LIBRARY) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Master Terms of Service
            </label>
            <span className="text-[10px] font-bold text-red-400 uppercase bg-red-50 px-2 py-1 rounded">
              Locked Template
            </span>
          </div>
          <div className="w-full p-8 bg-gray-900 text-gray-400 rounded-[2.5rem] text-[11px] leading-relaxed h-80 overflow-y-auto font-mono border-4 border-gray-800 custom-scrollbar">
            <p className="whitespace-pre-wrap">{doc.content.legal_terms}</p>
          </div>
        </div>

        {/* SIGNATURE PLACEHOLDER */}
        <div className="p-10 bg-purple-50 rounded-[2.5rem] border-2 border-dashed border-purple-100 text-center">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">
            Digital Signature Area
          </p>
          <p className="text-sm text-purple-900/40 italic font-medium">
            This section will become active for the client to sign once issued.
          </p>
        </div>
      </div>
    </div>
  );
}
