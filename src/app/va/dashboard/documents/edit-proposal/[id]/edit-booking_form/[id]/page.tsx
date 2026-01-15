"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  content: {
    header_image?: string;
    client_name?: string;
    va_name?: string;
    scope_of_work?: string;
    pricing_summary?: string;
    start_date?: string;
    further_agreements?: string;
    legal_terms?: string;
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
        // Intersection Type: Combines our Doc type with the joined Client data from Supabase
        const fetchedDoc = data as ClientDoc & {
          clients: { first_name: string; surname: string };
        };

        // Inject defaults and auto-populate names if legal_terms is missing
        if (!fetchedDoc.content.legal_terms) {
          const template = DOCUMENT_TEMPLATES.booking_form;
          fetchedDoc.content = {
            ...fetchedDoc.content,
            header_image: template.header_image,
            client_name: `${fetchedDoc.clients.first_name} ${fetchedDoc.clients.surname}`,
            va_name: "Your Name",
            scope_of_work: "As discussed in the proposal...",
            pricing_summary: "£",
            start_date: "",
            further_agreements: "None",
            legal_terms:
              `1. APPOINTMENT & TERM\nThis agreement begins on the Start Date... \n\n` +
              Array(20)
                .fill("Standard legal clause text sample line...")
                .join("\n"),
          };
        }
        setDoc(fetchedDoc);
      }
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  const updateField = (field: keyof ClientDoc["content"], value: string) => {
    if (!doc) return;
    setDoc({ ...doc, content: { ...doc.content, [field]: value } });
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
      alert(isIssuing ? "Booking Form issued to client!" : "Draft saved.");
      if (isIssuing) router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-gray-400 italic font-sans text-center">
        Loading Booking Form...
      </div>
    );
  if (!doc)
    return (
      <div className="p-10 text-red-500 font-sans text-center">
        Document not found.
      </div>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto text-black pb-40 font-sans">
      {/* ACTION HEADER */}
      <div className="flex justify-between items-end mb-10 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Booking Form Builder
          </h1>
          <p className="text-xs font-bold text-[#9d4edd] uppercase tracking-widest">
            Client: {doc.content.client_name}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            className="px-6 py-2 border-2 rounded-xl font-bold text-xs uppercase hover:bg-gray-50 transition-all"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave(true)}
            className="px-6 py-2 bg-[#9d4edd] text-white rounded-xl font-bold text-xs uppercase hover:bg-[#7b2cbf] shadow-xl shadow-purple-100 transition-all"
          >
            Issue for Signature
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* TOP INFO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-4xl border border-gray-100 shadow-sm">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              VA Name (Your Signature)
            </label>
            <input
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 font-bold border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.va_name}
              onChange={(e) => updateField("va_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Anticipated Start Date
            </label>
            <input
              type="date"
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.start_date}
              onChange={(e) => updateField("start_date", e.target.value)}
            />
          </div>
        </div>

        {/* WORK DETAILS */}
        <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Agreed Scope summary
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 text-sm min-h-25 border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.scope_of_work}
              onChange={(e) => updateField("scope_of_work", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Pricing & Payment Schedule
            </label>
            <input
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 font-bold text-[#9d4edd] border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.pricing_summary}
              onChange={(e) => updateField("pricing_summary", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Further Agreements / Variations
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-4 focus:ring-purple-50 text-sm min-h-20 border-2 border-transparent focus:border-purple-100 transition-all"
              value={doc.content.further_agreements}
              onChange={(e) =>
                updateField("further_agreements", e.target.value)
              }
            />
          </div>
        </div>

        {/* THE LEGAL ANCHOR */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Master Terms of Service
            </label>
            <span className="text-[10px] font-bold text-red-400 uppercase bg-red-50 px-2 py-1 rounded">
              Template View
            </span>
          </div>
          <div className="w-full p-8 bg-gray-900 text-gray-400 rounded-[2.5rem] text-[11px] leading-relaxed h-80 overflow-y-auto font-mono border-4 border-gray-800">
            <p className="whitespace-pre-wrap">{doc.content.legal_terms}</p>
          </div>
        </div>

        {/* PLACEHOLDER FOR E-SIGN */}
        <div className="p-8 bg-purple-50 rounded-4xl border-2 border-dashed border-purple-100 text-center">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
            Digital Signature Required
          </p>
          <p className="text-sm text-purple-700/60 mt-2 italic">
            Upon issuance, the client will be required to digitally sign this
            form within their portal.
          </p>
        </div>
      </div>
    </div>
  );
}
