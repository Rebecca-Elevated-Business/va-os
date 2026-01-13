"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";

// 1. Define the specific Document structure to remove 'any'
interface DocumentContent {
  body_text?: string;
  sections?: Array<{ title: string; text: string }>;
  line_items?: Array<{ description: string; amount: number }>;
}

interface Document {
  id: string;
  type: "proposal" | "booking_form" | "invoice";
  title: string;
  status: string;
  content: DocumentContent | string;
  amount_decimal?: number;
  due_date?: string;
}

export default function ClientDocumentView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // State is now strictly typed
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDoc() {
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setDoc(data as Document);
      }
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  if (loading)
    return <div className="p-10 text-black">Loading Document...</div>;
  if (!doc) return <div className="p-10 text-black">Document not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        {/* Header Section */}
        <div className="bg-gray-900 p-10 text-white flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">
              {doc.title}
            </h1>
            <p className="text-gray-400 text-sm uppercase tracking-widest">
              {doc.type.replace("_", " ")}
            </p>
          </div>
          {doc.type === "invoice" && doc.amount_decimal && (
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">
                Amount Due
              </p>
              <p className="text-3xl font-black text-[#9d4edd]">
                £{doc.amount_decimal.toFixed(2)}
              </p>
              {doc.due_date && (
                <p className="text-[10px] text-gray-500 mt-1 uppercase">
                  Due by: {new Date(doc.due_date).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-12 whitespace-pre-wrap leading-relaxed text-gray-800">
          {typeof doc.content === "string"
            ? doc.content
            : JSON.stringify(doc.content, null, 2)}
        </div>

        {/* Action Logic based on Type */}
        <div className="p-12 bg-gray-50 border-t flex justify-end gap-4">
          {doc.type === "booking_form" && doc.status === "issued" && (
            <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all">
              Sign & Authorise Contract
            </button>
          )}
          {doc.type === "proposal" && doc.status === "issued" && (
            <button className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all">
              Accept Proposal
            </button>
          )}
          {doc.type === "invoice" && doc.status === "issued" && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all">
              Pay Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
