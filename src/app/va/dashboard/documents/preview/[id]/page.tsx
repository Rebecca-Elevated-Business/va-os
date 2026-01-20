"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import ProposalDocument from "@/components/documents/ProposalDocument";
import BookingFormDocument from "@/components/documents/BookingFormDocument";
import { mergeProposalContent, type ProposalContent } from "@/lib/proposalContent";
import {
  mergeBookingContent,
  type BookingFormContent,
} from "@/lib/bookingFormContent";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
  content: Partial<ProposalContent>;
};

export default function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handlePrint = () => {
    window.print();
  };

  if (loading)
    return <div className="p-10 text-gray-500 italic">Loading preview...</div>;
  if (!doc)
    return <div className="p-10 text-red-500 font-bold">Document not found.</div>;

  if (doc.type !== "proposal" && doc.type !== "booking_form") {
    return (
      <div className="p-10 text-gray-500 italic">
        Preview is only available for proposals and booking forms at the moment.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black p-4 md:p-8 print:bg-white">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-end gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            Download / Print
          </button>
        </div>

        {doc.type === "proposal" ? (
          <ProposalDocument content={mergeProposalContent(doc.content)} />
        ) : (
          <BookingFormDocument
            content={mergeBookingContent(doc.content as BookingFormContent)}
            mode="preview"
            standardTerms={
              DOCUMENT_TEMPLATES.booking_form.sections.legal_text ||
              "Terms not available."
            }
          />
        )}
      </div>
    </div>
  );
}
