"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";

// 1. Define specific types for the Invoice structure
type InvoiceItem = {
  id: string;
  description: string;
  amount: string;
};

type InvoiceContent = {
  header_image?: string;
  client_name?: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  line_items?: InvoiceItem[];
  payment_notes?: string;
  bank_details?: string;
  va_name?: string;
};

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  content: InvoiceContent;
};

// Intersection type for the database join
type FetchedDoc = ClientDoc & {
  clients: { first_name: string; surname: string };
};

export default function EditInvoicePage({
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
        const fetchedData = data as FetchedDoc;

        // Auto-populate if it's a fresh document
        if (!fetchedData.content.invoice_number) {
          const template = DOCUMENT_TEMPLATES.invoice;
          fetchedData.content = {
            ...fetchedData.content,
            header_image: template.header_image,
            client_name: `${fetchedData.clients.first_name} ${fetchedData.clients.surname}`,
            invoice_number: `INV-${Date.now().toString().slice(-6)}`,
            issue_date: new Date().toISOString().split("T")[0],
            due_date: "",
            line_items: [
              { id: "1", description: "Service Description", amount: "0.00" },
            ],
            payment_notes: template.sections.closing,
            bank_details: template.sections.footer,
            va_name: "Your Name",
          };
        }
        setDoc(fetchedData);
      }
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  // FIX: Explicitly typed 'value' to avoid 'any'
  const updateField = (
    field: keyof InvoiceContent,
    value: string | InvoiceItem[]
  ) => {
    if (!doc) return;
    setDoc({
      ...doc,
      content: { ...doc.content, [field]: value },
    });
  };

  const addLineItem = () => {
    if (!doc) return;
    const currentItems = doc.content.line_items || [];
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: "",
      amount: "",
    };
    updateField("line_items", [...currentItems, newItem]);
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
      alert(isIssuing ? "Invoice issued to client!" : "Draft saved.");
      if (isIssuing) router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    } else {
      alert("Error: " + error.message);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center text-gray-400 italic">
        Loading Invoice Editor...
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
      {/* HEADER ACTIONS */}
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">
            Invoice Builder
          </h1>
          <p className="text-[10px] font-black text-[#9d4edd] uppercase tracking-widest mt-2">
            Billed to: {doc.content.client_name}
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
            {saving ? "..." : "Issue Invoice"}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* INVOICE META DATA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-8 rounded-4xlrder border-gray-100 shadow-sm">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Invoice Number
            </label>
            <input
              className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100 font-bold"
              value={doc.content.invoice_number || ""}
              onChange={(e) => updateField("invoice_number", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Date Issued
            </label>
            <input
              type="date"
              className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100"
              value={doc.content.issue_date || ""}
              onChange={(e) => updateField("issue_date", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Due Date
            </label>
            <input
              type="date"
              className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100 font-bold text-red-500"
              value={doc.content.due_date || ""}
              onChange={(e) => updateField("due_date", e.target.value)}
            />
          </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <div className="bg-white p-8 rounded-4xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Description of Services
            </h3>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Amount (£)
            </h3>
          </div>

          {doc.content.line_items?.map((item, index) => (
            <div key={item.id} className="flex gap-4 group">
              <input
                className="flex-1 p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-purple-100 text-sm transition-all"
                placeholder="Work description..."
                value={item.description}
                onChange={(e) => {
                  const items = [...(doc.content.line_items || [])];
                  items[index].description = e.target.value;
                  updateField("line_items", items);
                }}
              />
              <input
                className="w-36 p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-purple-100 font-bold text-right"
                placeholder="0.00"
                value={item.amount}
                onChange={(e) => {
                  const items = [...(doc.content.line_items || [])];
                  items[index].amount = e.target.value;
                  updateField("line_items", items);
                }}
              />
            </div>
          ))}

          <button
            onClick={addLineItem}
            className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[10px] font-black text-gray-400 hover:text-[#9d4edd] hover:border-[#9d4edd] transition-all uppercase tracking-widest"
          >
            + Add New Line Item
          </button>
        </div>

        {/* FOOTER & BANKING */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Notes / Instructions
            </label>
            <textarea
              className="w-full p-5 bg-gray-50 rounded-4xl outline-none border-2 border-transparent focus:border-purple-100 text-sm min-h-30"
              value={doc.content.payment_notes || ""}
              onChange={(e) => updateField("payment_notes", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Payment / Bank Details
            </label>
            <textarea
              className="w-full p-5 bg-gray-900 text-green-400 rounded-4xl outline-none font-mono text-xs min-h-30 border-4 border-gray-800"
              value={doc.content.bank_details || ""}
              onChange={(e) => updateField("bank_details", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
