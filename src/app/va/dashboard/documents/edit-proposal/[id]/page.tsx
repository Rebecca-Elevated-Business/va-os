"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
  content: {
    header_image?: string;
    intro_text?: string;
    scope_of_work?: string;
    quote_details?: string;
    closing_statement?: string;
    va_name?: string;
    custom_sections?: { id: string; label: string; value: string }[];
  };
};

export default function EditProposalPage({
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
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        const clientDoc = data as ClientDoc;
        // If content is empty (brand new), inject the template
        if (!clientDoc.content.intro_text) {
          const template = DOCUMENT_TEMPLATES.proposal;
          clientDoc.content = {
            header_image: template.header_image,
            intro_text:
              "Many thanks for your enquiry. It was a pleasure to learn more about your requirements...",
            scope_of_work: "• Task 1\n• Task 2\n• Task 3",
            quote_details: "£00.00 per hour/month",
            closing_statement: template.sections.closing,
            va_name: "Your Name",
            custom_sections: [],
          };
        }
        setDoc(clientDoc);
      }
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  const updateField = (
    field: keyof ClientDoc["content"],
    value: string | { id: string; label: string; value: string }[]
  ) => {
    if (!doc) return;
    setDoc({ ...doc, content: { ...doc.content, [field]: value } });
  };

  const addCustomSection = () => {
    if (!doc) return;
    const newSection = {
      id: Date.now().toString(),
      label: "New Section Title",
      value: "",
    };
    const customs = doc.content.custom_sections || [];
    updateField("custom_sections", [...customs, newSection]);
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
      alert(isIssuing ? "Proposal issued to client!" : "Draft saved.");
      if (isIssuing) router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-gray-400 italic">
        Loading Proposal Editor...
      </div>
    );
  if (!doc) return <div className="p-10 text-red-500">Proposal not found.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto text-black pb-40">
      {/* TRAINING ALERT */}
      <div className="mb-8 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-start gap-4">
        <span className="text-xl">💡</span>
        <div>
          <p className="font-bold text-[#9d4edd] text-sm">VA Training Note</p>
          <p className="text-xs text-purple-700/70 leading-relaxed">
            Your professional template has been pre-filled below. You can
            **over-type any text**, delete sections you don&apos;t need, or add
            custom fields to tailor this proposal to your client&apos;s specific
            needs.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-end mb-10 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Proposal Builder
          </h1>
          <p className="text-xs font-bold text-gray-400">
            STATUS: {doc.status.toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            className="px-6 py-2 border-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave(true)}
            className="px-6 py-2 bg-[#9d4edd] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#7b2cbf] shadow-xl shadow-purple-100 transition-all"
          >
            Issue to Client
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {/* WELCOME SECTION */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Warm Welcome
          </label>
          <textarea
            className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-37.5 leading-relaxed shadow-sm text-sm"
            value={doc.content.intro_text}
            onChange={(e) => updateField("intro_text", e.target.value)}
          />
        </div>

        {/* SCOPE SECTION */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Proposed Scope of Work
          </label>
          <textarea
            className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-50 shadow-sm text-sm"
            value={doc.content.scope_of_work}
            onChange={(e) => updateField("scope_of_work", e.target.value)}
          />
        </div>

        {/* INVESTMENT SECTION */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Investment Details
          </label>
          <input
            type="text"
            className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 shadow-sm font-bold text-lg"
            value={doc.content.quote_details}
            onChange={(e) => updateField("quote_details", e.target.value)}
          />
        </div>

        {/* CUSTOM SECTIONS */}
        {doc.content.custom_sections?.map((section, index) => (
          <div
            key={section.id}
            className="p-8 bg-gray-50 rounded-4xl border-2 border-dashed border-gray-100 space-y-4 relative group"
          >
            <button
              onClick={() => {
                const updated = [...(doc.content.custom_sections || [])];
                updated.splice(index, 1);
                updateField("custom_sections", updated);
              }}
              className="absolute top-4 right-4 text-xs font-bold text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              REMOVE SECTION
            </button>
            <input
              className="bg-transparent font-black text-[#9d4edd] uppercase tracking-widest outline-none w-full"
              value={section.label}
              onChange={(e) => {
                const updated = [...(doc.content.custom_sections || [])];
                updated[index].label = e.target.value;
                updateField("custom_sections", updated);
              }}
            />
            <textarea
              className="w-full p-4 bg-white border rounded-xl outline-none min-h-25 text-sm"
              value={section.value}
              onChange={(e) => {
                const updated = [...(doc.content.custom_sections || [])];
                updated[index].value = e.target.value;
                updateField("custom_sections", updated);
              }}
            />
          </div>
        ))}

        {/* ADD SECTION BUTTON */}
        <button
          onClick={addCustomSection}
          className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-black text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all uppercase tracking-widest"
        >
          + Add Custom Section (e.g. Next Steps, FAQs)
        </button>

        {/* FOOTER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10 border-t">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              Closing Statement
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none text-sm"
              value={doc.content.closing_statement}
              onChange={(e) => updateField("closing_statement", e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              VA Signature Name
            </label>
            <input
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none font-bold"
              value={doc.content.va_name}
              onChange={(e) => updateField("va_name", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
