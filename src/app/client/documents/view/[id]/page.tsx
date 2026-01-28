"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProposalDocument from "@/components/documents/ProposalDocument";
import BookingFormDocument from "@/components/documents/BookingFormDocument";
import InvoiceDocument, {
  type InvoiceTimeReport,
} from "@/components/documents/InvoiceDocument";
import {
  mergeProposalContent,
  type ProposalContent,
} from "@/lib/proposalContent";
import {
  mergeBookingContent,
  type BookingFormContent,
} from "@/lib/bookingFormContent";
import {
  mergeInvoiceContent,
  type InvoiceContent,
} from "@/lib/invoiceContent";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: "proposal" | "booking_form" | "invoice" | "upload";
  status: string;
  content: {
    header_image?: string;
    intro_text?: string;
    scope_of_work?: string;
    legal_text?: string;
    quote_details?: string;
    closing_statement?: string;
    va_name?: string;
    hero_image_url?: string;
    hero_title?: string;
    prepared_for?: string;
    prepared_by?: string;
    prepared_date?: string;
    show_warm_welcome?: boolean;
    warm_welcome_text?: string;
    show_scope?: boolean;
    scope_items?: ProposalContent["scope_items"];
    show_investment?: boolean;
    investment?: ProposalContent["investment"];
    show_trust_signals?: boolean;
    trust_signals?: ProposalContent["trust_signals"];
    show_next_steps?: boolean;
    next_steps?: ProposalContent["next_steps"];
    show_additional_notes?: boolean;
    additional_notes?: string;
    show_thank_you?: boolean;
    thank_you_text?: string;
    signature_text?: string;
    // Invoice specific
    invoice_number?: string;
    issue_date?: string;
    due_date?: string;
    po_number?: string;
    show_po?: boolean;
    business_name?: string;
    business_logo_url?: string;
    business_email?: string;
    business_phone?: string;
    business_address?: string;
    client_business_name?: string;
    client_contact_name?: string;
    client_address?: string;
    client_email?: string;
    line_items?: InvoiceContent["line_items"];
    notes?: string;
    payment_details?: string;
    va_email?: string;
    va_business_name?: string;
    time_report_id?: string;
    show_time_report_to_client?: boolean;
    // Upload specific
    file_url?: string;
    file_name?: string;
    va_note?: string;
  };
};

export default function ClientDocumentView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseMode, setResponseMode] = useState<
    "accept" | "edit" | "sign" | "message" | null
  >(null);
  const [comment, setComment] = useState("");
  const [bookingContent, setBookingContent] =
    useState<BookingFormContent | null>(null);
  const [invoiceContent, setInvoiceContent] =
    useState<InvoiceContent | null>(null);
  const [invoiceReport, setInvoiceReport] =
    useState<InvoiceTimeReport | null>(null);
  const [clientAgreed, setClientAgreed] = useState(false);
  const [signatureError, setSignatureError] = useState("");

  useEffect(() => {
    async function loadDoc() {
      const { data } = await supabase
        .from("client_documents")
        .select("*, clients(first_name, surname, email)")
        .eq("id", id)
        .single();
      if (data) setDoc(data as ClientDoc);
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => {
      if (doc.type === "booking_form") {
        setBookingContent(
          mergeBookingContent(doc.content as BookingFormContent)
        );
      } else {
        setBookingContent(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => {
      if (doc.type !== "invoice") {
        setInvoiceContent(null);
        setInvoiceReport(null);
        return;
      }

      const merged = mergeInvoiceContent(doc.content as InvoiceContent);
      setInvoiceContent(merged);

      if (!merged.time_report_id || !merged.show_time_report_to_client) {
        setInvoiceReport(null);
        return;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [doc]);

  useEffect(() => {
    if (!doc || doc.type !== "invoice") return;
    const merged = mergeInvoiceContent(doc.content as InvoiceContent);
    if (!merged.time_report_id || !merged.show_time_report_to_client) return;

    async function loadInvoiceReport() {
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

    loadInvoiceReport();
  }, [doc]);

  const handleSubmitResponse = async () => {
    if (!doc) return;

    // Logic for Proposals or Invoices
    const statusUpdate =
      responseMode === "accept" ? "accepted" : "feedback_received";

    // Logic for Booking Forms (Contract Signing)
    const finalStatus = doc.type === "booking_form" ? "signed" : statusUpdate;

    await supabase
      .from("client_documents")
      .update({
        status: finalStatus,
        signed_at: finalStatus === "signed" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    await supabase.from("client_requests").insert([
      {
        client_id: doc.client_id,
        type: "work",
        status: "new",
        message: `${doc.type.toUpperCase()} RESPONSE: ${
          comment || "Action taken by client."
        }`,
      },
    ]);

    alert("Response recorded! Your VA has been notified.");
    router.push("/client/dashboard");
  };

  const requiredBookingFields: (keyof BookingFormContent)[] = [
    "client_business_name",
    "client_contact_name",
    "client_job_title",
    "client_postal_address",
    "client_email",
    "client_phone",
    "va_business_name",
    "va_contact_name",
    "va_job_title",
    "va_contact_details",
    "timeline_key_dates",
    "working_hours",
    "communication_channels",
    "fee",
    "payment_terms",
    "prepayment_expiration",
    "additional_hourly_rate",
    "out_of_hours_rate",
    "urgent_work_rate",
    "additional_payment_charges",
    "late_payment_interest",
    "purchase_order_number",
    "data_privacy_link",
    "insurance_cover",
    "notice_period",
    "special_terms",
    "courts_jurisdiction",
    "accept_by_date",
    "client_signature_name",
    "client_print_name",
    "client_business_name_signature",
  ];

  const hasValue = (value: string) => value.trim().length > 0;

  const isBookingReadyToSign = (content: BookingFormContent) => {
    const missingFields = requiredBookingFields.filter(
      (field) => !hasValue(String(content[field] || ""))
    );
    const missingServiceFields = content.services.some(
      (service) => !hasValue(service.title) || !hasValue(service.details)
    );

    return missingFields.length === 0 && !missingServiceFields;
  };

  const handleSignBooking = async () => {
    if (!doc || !bookingContent) return;
    setSignatureError("");

    if (!isBookingReadyToSign(bookingContent)) {
      setSignatureError(
        "All required fields must be completed before signing."
      );
      return;
    }

    if (!clientAgreed) {
      setSignatureError("Please confirm you agree to the terms before signing.");
      return;
    }

    const signedAt = new Date().toISOString();
    const updatedContent = {
      ...bookingContent,
      client_signed_at: signedAt,
    };

    await supabase
      .from("client_documents")
      .update({
        content: updatedContent,
        status: "signed",
        signed_at: signedAt,
      })
      .eq("id", doc.id);

    await supabase.from("client_requests").insert([
      {
        client_id: doc.client_id,
        type: "work",
        status: "new",
        message: "BOOKING FORM SIGNED: Client completed and signed the form.",
      },
    ]);

    alert("Booking form signed and sent to your VA.");
    router.push("/client/dashboard");
  };

  const handleSendMessage = async () => {
    if (!doc) return;
    if (bookingContent) {
      await supabase
        .from("client_documents")
        .update({ content: bookingContent })
        .eq("id", doc.id);
    }
    await supabase.from("client_requests").insert([
      {
        client_id: doc.client_id,
        type: "work",
        status: "new",
        message: `${doc.type.toUpperCase()} MESSAGE: ${
          comment || "Client message sent."
        }`,
      },
    ]);
    alert("Message sent to your VA.");
    router.push("/client/dashboard");
  };

  const handleMarkInvoicePaid = async () => {
    if (!doc || doc.type !== "invoice") return;
    await supabase
      .from("client_documents")
      .update({ status: "paid" })
      .eq("id", doc.id);

    await supabase.from("client_requests").insert([
      {
        client_id: doc.client_id,
        type: "work",
        status: "new",
        message: "INVOICE PAID: Client marked the invoice as paid.",
      },
    ]);

    alert("Marked as paid. Your VA has been notified.");
    router.push("/client/dashboard");
  };

  const handlePrint = () => {
    if (!doc) return;
    window.open(`/documents/print/${doc.id}`, "_blank", "noopener,noreferrer");
  };


  if (loading)
    return (
      <div className="p-10 text-gray-500 italic">
        Loading secure document...
      </div>
    );
  if (!doc)
    return (
      <div className="p-10 text-red-500 font-bold">Document not found.</div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black p-4 md:p-8 font-sans print:bg-white">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">
        {/* HEADER IMAGE */}
        {doc.content.header_image &&
          doc.type !== "upload" &&
          doc.type !== "proposal" &&
          doc.type !== "booking_form" &&
          doc.type !== "invoice" && (
          <div className="h-64 w-full relative">
            <Image
              src={doc.content.header_image}
              alt="Header"
              fill
              className="object-cover"
              unoptimized={doc.content.header_image.includes("unsplash")}
            />
            <div className="absolute inset-0 bg-linear-to-t from-white/90 via-transparent to-transparent"></div>
          </div>
        )}

        <div
          className={`p-8 md:p-16 space-y-10 ${
            doc.content.header_image ? "-mt-12" : ""
          } relative bg-white rounded-t-4xl`}
        >
          {doc.type !== "proposal" &&
            doc.type !== "booking_form" &&
            doc.type !== "invoice" && (
            <header>
              <div className="inline-block px-3 py-1 bg-purple-100 text-[#9d4edd] text-[10px] font-black uppercase tracking-widest rounded-full mb-4">
                {doc.type.replace("_", " ")}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter leading-none">
                {doc.title}
              </h1>
            </header>
          )}

          {/* DYNAMIC CONTENT SWITCHER */}
          {(() => {
            switch (doc.type) {
              case "proposal": {
                const proposalContent = mergeProposalContent(
                  doc.content as ProposalContent
                );
                return (
                  <div className="space-y-10">
                    <div className="flex justify-end print:hidden">
                      <button
                        onClick={handlePrint}
                        className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                      >
                        Download / Print
                      </button>
                    </div>
                    <ProposalDocument content={proposalContent} />
                    <div className="grid grid-cols-2 gap-4 pt-6 print:hidden">
                      <button
                        onClick={() => setResponseMode("accept")}
                        className="bg-[#9d4edd] text-white py-4 rounded-2xl font-black uppercase tracking-widest"
                      >
                        Accept Proposal
                      </button>
                      <button
                        onClick={() => setResponseMode("edit")}
                        className="border-2 border-gray-100 text-gray-400 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs"
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                );
              }

              case "booking_form":
                if (!bookingContent) return null;
                return (
                  <div className="space-y-10">
                    <div className="flex justify-end print:hidden">
                      <button
                        onClick={handlePrint}
                        className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                      >
                        Download / Print
                      </button>
                    </div>
                    <BookingFormDocument
                      content={bookingContent}
                      mode="client"
                      clientAgreed={clientAgreed}
                      onClientAgreeChange={setClientAgreed}
                      onUpdate={(updates) =>
                        setBookingContent((prev) =>
                          prev ? { ...prev, ...updates } : prev
                        )
                      }
                    />
                    {doc.status !== "signed" ? (
                      <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 space-y-4 print:hidden">
                        {signatureError && (
                          <p className="text-xs text-red-500 font-semibold">
                            {signatureError}
                          </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={handleSignBooking}
                            disabled={
                              !isBookingReadyToSign(bookingContent) ||
                              !clientAgreed
                            }
                            className="bg-[#9d4edd] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:bg-gray-300"
                          >
                            Sign & Send
                          </button>
                          <button
                            onClick={() => setResponseMode("message")}
                            className="border-2 border-gray-200 text-gray-500 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs"
                          >
                            Send Message
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-green-50 border border-green-100 rounded-2xl text-green-700 font-bold text-center print:hidden">
                        ✓ This agreement was signed and finalized.
                      </div>
                    )}
                  </div>
                );

              case "invoice":
                if (!invoiceContent) return null;
                return (
                  <div className="space-y-8">
                    <div className="flex justify-end print:hidden">
                      <button
                        onClick={handlePrint}
                        className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                      >
                        Download / Print
                      </button>
                    </div>
                    <InvoiceDocument
                      content={invoiceContent}
                      report={invoiceReport}
                    />
                    {doc.status === "paid" ? (
                      <div className="p-6 bg-green-50 border border-green-100 rounded-2xl text-green-700 font-bold text-center print:hidden">
                        ✓ This invoice is marked as paid.
                      </div>
                    ) : (
                      <div className="space-y-3 print:hidden">
                        <p className="text-xs text-gray-500">
                          Marking as paid does not process payment. It only
                          notifies your VA.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={handleMarkInvoicePaid}
                            className="bg-[#9d4edd] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl"
                          >
                            Mark as Paid
                          </button>
                          <button
                            onClick={() => setResponseMode("message")}
                            className="border-2 border-gray-200 text-gray-500 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs"
                          >
                            Send Message
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );

              case "upload":
                return (
                  <div className="text-center space-y-8 py-10">
                    <div className="p-12 border-4 border-dashed border-gray-100 rounded-4xl bg-gray-50">
                      <div className="text-6xl mb-6">📄</div>
                      <h2 className="text-xl font-black uppercase mb-2">
                        {doc.content.file_name}
                      </h2>
                      <p className="text-sm text-gray-400 mb-8 italic">
                        &quot;{doc.content.va_note}&quot;
                      </p>
                      <a
                        href={doc.content.file_url}
                        target="_blank"
                        className="inline-block bg-[#9d4edd] text-white px-12 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg"
                      >
                        View / Download PDF
                      </a>
                    </div>
                  </div>
                );
            }
          })()}

          {/* SIGNATURE / FEEDBACK OVERLAY */}
          {responseMode && (
            <div className="mt-8 p-8 bg-white border-4 border-[#9d4edd] rounded-4xl shadow-2xl animate-in fade-in slide-in-from-top-4 print:hidden">
              <h3 className="text-xl font-black mb-4 tracking-tight">
                {responseMode === "accept"
                  ? "Accept Proposal"
                  : responseMode === "message"
                  ? "Send Message"
                  : "Request Changes"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {"Your message to your Virtual Assistant:"}
              </p>
              <textarea
                className="w-full border-2 border-gray-100 p-5 rounded-2xl bg-gray-50 focus:ring-4 focus:ring-purple-50 outline-none mb-6 transition-all"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  "Details here..."
                }
              />
              <div className="flex items-center gap-6">
                <button
                  onClick={() => {
                    if (responseMode === "message") {
                      handleSendMessage();
                    } else {
                      handleSubmitResponse();
                    }
                  }}
                  className="bg-gray-900 text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-[#9d4edd] transition-colors"
                >
                  {responseMode === "message" ? "Send Message" : "Send Response"}
                </button>
                <button
                  onClick={() => setResponseMode(null)}
                  className="text-gray-400 font-bold hover:text-red-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {doc.type !== "proposal" &&
            doc.type !== "booking_form" &&
            doc.type !== "invoice" && (
            <footer className="pt-10 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Kind Regards,
              </p>
              <p className="text-2xl font-black text-[#9d4edd] tracking-tight">
                {doc.content.va_name}
              </p>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
