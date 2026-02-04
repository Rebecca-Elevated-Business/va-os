"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";
type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
  issued_at: string | null;
  content: {
    header_image?: string;
    intro_text?: string;
    scope_of_work?: string;
    legal_text?: string;
    quote_details?: string;
    closing_statement?: string;
    va_name?: string;
  };
};

export default function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { alert, confirm } = usePrompt();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    async function loadDoc() {
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setDoc(data as ClientDoc);
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  const handleSave = async (isIssuing = false) => {
    if (!doc) return;
    setSaving(true);

    const wasIssued = doc.status === "issued";
    const updates = {
      content: doc.content,
      title: doc.title,
      status: isIssuing ? "issued" : doc.status,
      issued_at: isIssuing ? new Date().toISOString() : doc.issued_at,
    };

    const { error } = await supabase
      .from("client_documents")
      .update(updates)
      .eq("id", id);

    setSaving(false);
    if (!error && isIssuing) {
      if (!wasIssued) {
        await supabase.from("client_notifications").insert([
          {
            client_id: doc.client_id,
            type: "document_issued",
            message: `New document available: ${doc.title}`,
          },
        ]);
      }
      await alert({
        title: "Document issued",
        message: "Document Issued to Client!",
      });
      router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    } else if (!error) {
      await alert({
        title: "Draft saved",
        message: "Draft Saved.",
      });
    }
  };

  const updateContent = (field: keyof ClientDoc["content"], value: string) => {
    if (!doc) return;
    setDoc({
      ...doc,
      content: { ...doc.content, [field]: value },
    });
  };

  if (loading)
    return <div className="p-10 text-gray-400 italic">Loading editor...</div>;
  if (!doc) return <div className="p-10 text-red-500">Document not found.</div>;

  const handleMarkCompleted = async () => {
    if (!doc || doc.status === "completed") return;
    const ok = await confirm({
      title: "Mark as completed?",
      message:
        "This will mark the document as completed for both you and the client.",
      confirmLabel: "Mark completed",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_documents")
      .update({ status: "completed" })
      .eq("id", id);
    if (!error) {
      await alert({
        title: "Marked as completed",
        message: "The document is now marked as completed.",
      });
      setDoc({ ...doc, status: "completed" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto text-black pb-20">
      <div className="flex justify-between items-end mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">
            Document Editor
          </h1>
          <p className="text-gray-400 text-sm font-bold">
            Drafting: {doc.title}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
          >
            Preview as Client
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave(true)}
            className="px-6 py-2 bg-[#9d4edd] text-white rounded-xl font-bold text-sm hover:bg-[#7b2cbf] shadow-lg shadow-purple-100 transition-all"
          >
            Issue to Client
          </button>
          {doc.status !== "completed" && (
            <button
              onClick={handleMarkCompleted}
              className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
            >
              Mark as Completed
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              1. Professional Branding
            </h2>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">
              Header Image URL
            </label>
            <input
              type="text"
              className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100"
              value={doc.content.header_image || ""}
              onChange={(e) => updateContent("header_image", e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            2. Welcome Message
          </h2>
          <textarea
            className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100 min-h-37.5 leading-relaxed"
            value={doc.content.intro_text || ""}
            onChange={(e) => updateContent("intro_text", e.target.value)}
            placeholder="Write your warm welcome here..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              3. Scope of Work
            </h2>
            <textarea
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100 min-h-50"
              value={doc.content.scope_of_work || ""}
              onChange={(e) => updateContent("scope_of_work", e.target.value)}
              placeholder="List the specific tasks and deliverables..."
            />
          </div>
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              4. Investment / Pricing
            </h2>
            <textarea
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100 min-h-50"
              value={doc.content.quote_details || ""}
              onChange={(e) => updateContent("quote_details", e.target.value)}
              placeholder="e.g. £500 per month or £35 per hour"
            />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            5. Final Details
          </h2>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">
              Legal Terms / Booking Conditions
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100 min-h-25"
              value={doc.content.legal_text || ""}
              onChange={(e) => updateContent("legal_text", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">
              Closing Statement
            </label>
            <textarea
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100"
              value={doc.content.closing_statement || ""}
              onChange={(e) =>
                updateContent("closing_statement", e.target.value)
              }
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">
              Signature / VA Name
            </label>
            <input
              type="text"
              className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-purple-100"
              value={doc.content.va_name || ""}
              onChange={(e) => updateContent("va_name", e.target.value)}
            />
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-10">
          <div className="bg-white w-full max-w-5xl h-full rounded-4xl overflow-hidden flex flex-col relative">
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-6 right-6 z-10 bg-gray-900 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold"
            >
              ✕
            </button>
            <div className="flex-1 overflow-y-auto p-10 bg-gray-50">
              <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden min-h-screen p-12">
                <h1 className="text-4xl font-black mb-6">{doc.title}</h1>
                <p className="whitespace-pre-wrap text-gray-600 mb-10">
                  {doc.content.intro_text}
                </p>

                {doc.content.scope_of_work && (
                  <div className="bg-purple-50 p-6 rounded-xl mb-10">
                    <h3 className="text-xs font-bold text-[#9d4edd] uppercase mb-2">
                      Scope
                    </h3>
                    <p className="whitespace-pre-wrap">
                      {doc.content.scope_of_work}
                    </p>
                  </div>
                )}

                {doc.content.quote_details && (
                  <div className="text-2xl font-bold mb-10">
                    Investment: {doc.content.quote_details}
                  </div>
                )}

                <p className="italic text-gray-400">
                  {doc.content.closing_statement}
                </p>
                <p className="font-black mt-4 text-[#9d4edd]">
                  {doc.content.va_name}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
