"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Define exactly what the document content can hold
interface DocumentContent {
  body_text?: string;
  sections?: Array<{ title: string; text: string }>;
  line_items?: Array<{ description: string; amount: number }>;
}

type Document = {
  id: string;
  type: "proposal" | "booking_form" | "invoice";
  title: string;
  status: string;
  content: DocumentContent | string; // Allow string for the initial "rough" drafts
  client_id: string;
  amount_decimal?: number;
  due_date?: string;
};

export default function DocumentEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        // Ensure content is at least an empty string if null
        const formattedData = {
          ...data,
          content: data.content || "",
        };
        setDoc(formattedData as Document);
      }
      setLoading(false);
    }
    loadDocument();
  }, [id]);

  const handleSave = async (status: string = "draft") => {
    if (!doc) return;
    setSaving(true);

    const { error } = await supabase
      .from("client_documents")
      .update({
        title: doc.title,
        content: doc.content,
        amount_decimal: doc.amount_decimal,
        due_date: doc.due_date,
        status: status,
      })
      .eq("id", id);

    if (error) alert(error.message);
    else {
      alert(
        status === "issued" ? "Document Issued to Client!" : "Draft Saved."
      );
      if (status === "issued")
        router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-black">Loading Editor...</div>;
  if (!doc) return <div className="p-10 text-black">Document not found.</div>;

  // Helper to get string value for the textarea safely
  const getContentValue = (): string => {
    if (typeof doc.content === "string") return doc.content;
    return JSON.stringify(doc.content, null, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black">
      {/* Editor Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-50 flex justify-between items-center px-8">
        <div>
          <span className="text-[10px] font-black uppercase bg-purple-100 text-[#9d4edd] px-2 py-1 rounded">
            {doc.type.replace("_", " ")} Editor
          </span>
          <input
            className="block text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-gray-200"
            value={doc.title}
            onChange={(e) => setDoc({ ...doc, title: e.target.value })}
          />
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => handleSave("draft")}
            className="text-sm font-bold text-gray-400 hover:text-gray-600"
          >
            {saving ? "..." : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave("issued")}
            className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md"
          >
            Issue to Client
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-10 space-y-8">
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200">
          {doc.type === "invoice" && (
            <div className="space-y-6 mb-10 pb-10 border-b">
              <h3 className="font-bold text-lg">Invoice Details</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                    Total Amount (£)
                  </label>
                  <input
                    type="number"
                    className="w-full border p-3 rounded-lg bg-gray-50"
                    value={doc.amount_decimal || ""}
                    onChange={(e) =>
                      setDoc({
                        ...doc,
                        amount_decimal: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full border p-3 rounded-lg bg-gray-50"
                    value={doc.due_date || ""}
                    onChange={(e) =>
                      setDoc({ ...doc, due_date: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="font-bold text-lg capitalize">
              {doc.type} Body Content
            </h3>
            <textarea
              className="w-full border p-4 rounded-xl bg-gray-50 min-h-100 outline-none focus:bg-white transition-all font-mono text-sm"
              placeholder={`Paste or type your ${doc.type} content here...`}
              value={getContentValue()}
              onChange={(e) => setDoc({ ...doc, content: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
