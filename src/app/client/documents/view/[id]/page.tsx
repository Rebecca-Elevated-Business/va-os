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
import { usePrompt } from "@/components/ui/PromptProvider";

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
    file_url?: string;
    file_path?: string;
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
  const { alert } = usePrompt();
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseMode, setResponseMode] = useState<
    "accept" | "edit" | "sign" | "message" | "paid" | null
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
  const [signedUploadUrl, setSignedUploadUrl] = useState<string | null>(null);

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
    if (!doc || doc.type !== "upload") return;
    const filePath = doc.content.file_path;
    if (!filePath) return;
    const loadSignedUrl = async () => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 60 * 60);
      if (error) {
        console.error("Failed to create signed URL", error);
        return;
      }
      setSignedUploadUrl(data.signedUrl);
    };
    loadSignedUrl();
  }, [doc]);

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

    loadInvoiceReport();
  }, [doc]);

  const handleSubmitResponse = async () => {
    if (!doc) return;

    const statusUpdate =
      responseMode === "accept" ? "accepted" : "feedback_received";

    const finalStatus = doc.type === "booking_form" ? "signed" : statusUpdate;

    if (doc.type === "invoice" && responseMode === "paid") {
      await supabase.rpc("client_mark_invoice_paid", {
        doc_id: id,
      });
    } else if (doc.type === "proposal") {
      await supabase.rpc("client_accept_proposal", {
        doc_id: id,
        new_status: finalStatus,
      });
    } else if (doc.type === "booking_form" && responseMode === "sign") {
      if (!bookingContent) return;
      setSignatureError("");
      if (!isBookingReadyToSign(bookingContent)) {
        setSignatureError("Please complete all required boxes.");
        return;
      }
      if (!clientAgreed) {
        setSignatureError(
          "Please confirm you agree to the terms before signing.",
        );
        return;
      }
      const updates = pickBookingClientUpdates(bookingContent);
      await supabase.rpc("client_sign_booking_form", {
        doc_id: id,
        updates,
      });
    } else {
      await supabase
        .from("client_documents")
        .update({
          status: finalStatus,
          signed_at: finalStatus === "signed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
    }

    const fallbackMessage =
      doc.type === "invoice" && responseMode === "paid"
        ? "Invoice marked as paid."
        : doc.type === "booking_form" && responseMode === "sign"
          ? "Booking form signed."
          : "Action taken by client.";

    await supabase.from("client_requests").insert([
      {
        client_id: doc.client_id,
        type: "work",
        status: "new",
        message: `${doc.type.toUpperCase()} RESPONSE: ${
          comment || fallbackMessage
        }`,
      },
    ]);

    await alert({
      title: "Response recorded",
      message: "Your VA has been notified.",
    });
    router.push("/client/dashboard");
  };

  const requiredBookingFields: (keyof BookingFormContent)[] = [
    "client_business_name",
    "client_contact_name",
    "client_job_title",
    "client_postal_address",
    "client_email",
    "client_phone",
    "personal_data_processing",
    "purchase_order_number",
    "client_signature_name",
    "client_print_name",
    "client_business_name_signature",
  ];

  const bookingClientUpdateFields: (keyof BookingFormContent)[] = [
    "client_business_name",
    "client_contact_name",
    "client_job_title",
    "client_postal_address",
    "client_email",
    "client_phone",
    "personal_data_processing",
    "purchase_order_number",
    "client_signature_style",
    "client_signature_name",
    "client_print_name",
    "client_business_name_signature",
  ];

  const pickBookingClientUpdates = (
    content: BookingFormContent,
  ): Partial<BookingFormContent> => {
    const updates = {} as Partial<BookingFormContent>;
    bookingClientUpdateFields.forEach((key) => {
      (updates as Record<
        string,
        BookingFormContent[keyof BookingFormContent]
      >)[key] = content[key];
    });
    return updates;
  };

  const hasValue = (value: string) => value.trim().length > 0;

  const isBookingReadyToSign = (content: BookingFormContent) => {
    const hiddenFields = new Set<string>([
      ...(content.section1_hidden_fields || []),
      ...(content.section2_hidden_fields || []),
      ...(content.section3_hidden_fields || []),
      ...(content.section4_hidden_fields || []),
      ...(content.section5_hidden_fields || []),
    ]);
    const missingFields = requiredBookingFields.filter(
      (field) =>
        !hiddenFields.has(field) && !hasValue(String(content[field] || ""))
    );
    const missingServiceFields = hiddenFields.has("services")
      ? false
      : content.services.some(
          (service) => !hasValue(service.title) || !hasValue(service.details)
        );

    return missingFields.length === 0 && !missingServiceFields;
  };

  const handleSignBooking = async () => {
    if (!doc || !bookingContent) return;
    setSignatureError("");
    if (!isBookingReadyToSign(bookingContent)) {
      setSignatureError("Please complete all required boxes.");
    }
    if (!clientAgreed) {
      setSignatureError("Please confirm you agree to the terms before signing.");
    }
    setResponseMode("sign");
  };

  const handleSendMessage = async () => {
    if (!doc) return;
    if (bookingContent) {
      const updates = pickBookingClientUpdates(bookingContent);
      await supabase.rpc("client_update_booking_form", {
        doc_id: doc.id,
        updates,
      });
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
    await alert({
      title: "Message sent",
      message: "Message sent to your VA.",
    });
    router.push("/client/dashboard");
  };

  const handleMarkInvoicePaid = async () => {
    if (!doc || doc.type !== "invoice") return;
    setResponseMode("paid");
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 text-sm font-semibold print:hidden">
          <button
            onClick={() => router.push("/client/dashboard")}
            className="text-[#333333] hover:text-[#4a2e6f] transition-colors"
          >
            Back to homepage
          </button>
        </div>
        <div className="bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">
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
                        className="border-2 border-[#4a2e6f] bg-[#DED4ED] text-[#4a2e6f] py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5 hover:bg-[#B29AD5]"
                      >
                        Accept Proposal
                      </button>
                      <button
                        onClick={() => setResponseMode("edit")}
                        className="border-2 border-[#333333] text-[#333333] py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
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
                        {!signatureError &&
                          bookingContent &&
                          !isBookingReadyToSign(bookingContent) && (
                            <p className="text-xs text-gray-500">
                              Please complete all required boxes.
                            </p>
                          )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={handleSignBooking}
                            className={`border-2 border-[#4a2e6f] bg-[#DED4ED] text-[#4a2e6f] py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5 hover:bg-[#B29AD5] ${
                              !bookingContent ||
                              !isBookingReadyToSign(bookingContent) ||
                              !clientAgreed
                                ? "opacity-60"
                                : ""
                            }`}
                          >
                            Sign & Send
                          </button>
                          <button
                            onClick={() => setResponseMode("message")}
                            className="border-2 border-[#333333] text-[#333333] py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
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
                          <span className="font-bold uppercase">
                            Please note:
                          </span>{" "}
                          Marking this invoice as paid does not process payment,
                          but notifies your VA that payment has been made.
                          Please ensure payment is still processed.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={handleMarkInvoicePaid}
                            className="border-2 border-[#4a2e6f] bg-[#DED4ED] text-[#4a2e6f] py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5 hover:bg-[#B29AD5]"
                          >
                            Mark as Paid
                          </button>
                          <button
                            onClick={() => setResponseMode("message")}
                            className="border-2 border-[#333333] text-[#333333] py-4 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
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
                      {(() => {
                        const downloadUrl =
                          doc.content.file_url || signedUploadUrl;
                        if (!downloadUrl) {
                          return (
                            <p className="text-sm text-gray-400 italic">
                              File unavailable.
                            </p>
                          );
                        }
                        return (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            className="inline-block bg-[#9d4edd] text-white px-12 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg"
                          >
                            View / Download PDF
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                );
            }
          })()}

          {responseMode && (
            <div className="mt-8 p-8 bg-white border-2 border-[#4A2E6F] rounded-4xl shadow-2xl animate-in fade-in slide-in-from-top-4 print:hidden">
              <h3 className="text-xl font-black mb-4 tracking-tight">
                {responseMode === "accept"
                  ? "Accept Proposal"
                  : responseMode === "sign"
                  ? "Sign & Send"
                  : responseMode === "paid"
                  ? "Mark as Paid"
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
                  className="bg-gray-900 text-white px-10 py-3 rounded-xl font-bold hover:bg-[#9d4edd] transition-colors"
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
    </div>
  );
}
