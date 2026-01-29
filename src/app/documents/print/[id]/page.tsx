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
  type: "proposal" | "booking_form" | "invoice" | "upload";
  status: string;
  content: Partial<ProposalContent>;
};

export default function DocumentPrintPage({
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

  useEffect(() => {
    if (!doc || doc.type !== "invoice") return;
    const merged = mergeInvoiceContent(doc.content as InvoiceContent);
    if (!merged.time_report_id || !merged.show_time_report_to_client) {
      setInvoiceReport(null);
      return;
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
        .select(
          "entry_date, task_title, duration_seconds, notes, time_entries(session_id, task_id)",
        )
        .eq("report_id", merged.time_report_id)
        .order("entry_date", { ascending: false });

      setInvoiceReport({
        ...(reportData as InvoiceTimeReport),
        entries:
          (entryData as (InvoiceTimeReport["entries"][number] & {
            time_entries?: { session_id: string | null; task_id: string | null } | null;
          })[] | null)?.map((entry) => ({
            entry_date: entry.entry_date,
            task_title: entry.task_title,
            duration_seconds: entry.duration_seconds,
            notes: entry.notes ?? null,
            session_id: entry.time_entries?.session_id ?? null,
            task_id: entry.time_entries?.task_id ?? null,
          })) || [],
      });
    }
    loadReport();
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => {
      window.print();
    }, 150);
    return () => clearTimeout(timer);
  }, [doc]);

  if (loading)
    return <div className="p-10 text-gray-500 italic">Loading document...</div>;
  if (!doc)
    return <div className="p-10 text-red-500 font-bold">Document not found.</div>;

  if (doc.type === "upload") {
    return (
      <div className="min-h-screen bg-white text-black p-8 font-sans">
        <div className="max-w-4xl mx-auto border border-gray-100 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#333333]">{doc.title}</h1>
          <p className="mt-4 text-sm text-gray-500">
            This document is an uploaded file. Please download it directly from
            the portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-4">
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
