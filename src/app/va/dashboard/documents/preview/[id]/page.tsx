"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import ProposalDocument from "@/components/documents/ProposalDocument";
import BookingFormDocument from "@/components/documents/BookingFormDocument";
import InvoiceDocument, {
  type InvoiceTimeReport,
} from "@/components/documents/InvoiceDocument";
import { mergeProposalContent, type ProposalContent } from "@/lib/proposalContent";
import {
  mergeBookingContent,
  type BookingFormContent,
} from "@/lib/bookingFormContent";
import { mergeInvoiceContent, type InvoiceContent } from "@/lib/invoiceContent";

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
  const [invoiceReport, setInvoiceReport] =
    useState<InvoiceTimeReport | null>(null);

  useEffect(() => {
    if (!doc || doc.type !== "invoice") return;
    const merged = mergeInvoiceContent(doc.content as InvoiceContent);
    if (!merged.time_report_id || !merged.show_time_report_to_client) {
      const timer = setTimeout(() => {
        setInvoiceReport(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    async function loadReport() {
      const { data: reportData } = await supabase
        .from("time_reports")
        .select("id, name, date_from, date_to, total_seconds, entry_count")
        .eq("id", merged.time_report_id)
        .single();
      if (!reportData) {
        setInvoiceReport(null);
        return;
      }
      const { data: entryData } = await supabase
        .from("time_report_entries")
        .select("entry_date, task_title, duration_seconds, notes")
        .eq("report_id", merged.time_report_id)
        .order("entry_date", { ascending: false });

      setInvoiceReport({
        ...(reportData as InvoiceTimeReport),
        entries: (entryData as InvoiceTimeReport["entries"]) || [],
      });
    }
    loadReport();
  }, [doc]);

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
    if (!doc) return;
    window.open(`/documents/print/${doc.id}`, "_blank", "noopener,noreferrer");
  };


  if (loading)
    return <div className="p-10 text-gray-500 italic">Loading preview...</div>;
  if (!doc)
    return <div className="p-10 text-red-500 font-bold">Document not found.</div>;

  if (
    doc.type !== "proposal" &&
    doc.type !== "booking_form" &&
    doc.type !== "invoice"
  ) {
    return (
      <div className="p-10 text-gray-500 italic">
        Preview is only available for proposals, booking forms, and invoices at
        the moment.
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
        ) : doc.type === "booking_form" ? (
          <BookingFormDocument
            content={mergeBookingContent(doc.content as BookingFormContent)}
            mode="preview"
          />
        ) : (
          <InvoiceDocument
            content={mergeInvoiceContent(doc.content as InvoiceContent)}
            report={invoiceReport}
          />
        )}
      </div>
    </div>
  );
}
