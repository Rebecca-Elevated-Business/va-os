"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    // Invoice specific
    invoice_number?: string;
    due_date?: string;
    line_items?: { id: string; description: string; amount: string }[];
    bank_details?: string;
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
    "accept" | "edit" | "sign" | null
  >(null);
  const [comment, setComment] = useState("");

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
    <div className="min-h-screen bg-gray-50 pb-20 text-black p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100">
        {/* HEADER IMAGE */}
        {doc.content.header_image && doc.type !== "upload" && (
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
          <header>
            <div className="inline-block px-3 py-1 bg-purple-100 text-[#9d4edd] text-[10px] font-black uppercase tracking-widest rounded-full mb-4">
              {doc.type.replace("_", " ")}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter leading-none">
              {doc.title}
            </h1>
          </header>

          {/* DYNAMIC CONTENT SWITCHER */}
          {(() => {
            switch (doc.type) {
              case "proposal":
                return (
                  <div className="space-y-10">
                    <section className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {doc.content.intro_text}
                    </section>
                    <section className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                      <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                        Scope of Work
                      </h2>
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {doc.content.scope_of_work}
                      </p>
                    </section>
                    <section className="p-8 bg-purple-900 text-white rounded-3xl flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                        Investment
                      </span>
                      <span className="text-3xl font-black">
                        {doc.content.quote_details}
                      </span>
                    </section>
                    <div className="grid grid-cols-2 gap-4 pt-6">
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

              case "booking_form":
                return (
                  <div className="space-y-10">
                    <section className="text-gray-700 whitespace-pre-wrap">
                      {doc.content.intro_text}
                    </section>
                    <section className="h-96 overflow-y-auto p-8 bg-gray-900 text-gray-400 rounded-3xl font-mono text-[11px] leading-relaxed border-4 border-gray-800">
                      {doc.content.legal_text}
                    </section>
                    {doc.status !== "signed" ? (
                      <button
                        onClick={() => setResponseMode("sign")}
                        className="w-full bg-[#9d4edd] text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl"
                      >
                        Confirm & Sign Agreement
                      </button>
                    ) : (
                      <div className="p-6 bg-green-50 border border-green-100 rounded-2xl text-green-700 font-bold text-center">
                        ✓ This agreement was signed and finalized.
                      </div>
                    )}
                  </div>
                );

              case "invoice":
                return (
                  <div className="space-y-8">
                    <div className="flex justify-between border-b pb-6">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase">
                          Invoice #
                        </p>
                        <p className="font-bold">
                          {doc.content.invoice_number}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase">
                          Due Date
                        </p>
                        <p className="font-bold text-red-500">
                          {doc.content.due_date}
                        </p>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-left text-[10px] font-black text-gray-400 uppercase">
                          <th className="py-4">Service</th>
                          <th className="py-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {doc.content.line_items?.map((item) => (
                          <tr key={item.id}>
                            <td className="py-4 text-gray-600">
                              {item.description}
                            </td>
                            <td className="py-4 text-right font-bold">
                              £{item.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-8 bg-gray-900 text-green-400 rounded-3xl font-mono text-xs whitespace-pre-wrap">
                      {doc.content.bank_details}
                    </div>
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
            <div className="mt-8 p-8 bg-white border-4 border-[#9d4edd] rounded-4xl shadow-2xl animate-in fade-in slide-in-from-top-4">
              <h3 className="text-xl font-black mb-4 tracking-tight">
                {responseMode === "accept"
                  ? "Accept Proposal"
                  : responseMode === "sign"
                  ? "Digitally Sign Agreement"
                  : "Request Changes"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {responseMode === "sign"
                  ? "By clicking 'Send Response', you are applying your digital signature to this document."
                  : "Your message to your Virtual Assistant:"}
              </p>
              <textarea
                className="w-full border-2 border-gray-100 p-5 rounded-2xl bg-gray-50 focus:ring-4 focus:ring-purple-50 outline-none mb-6 transition-all"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  responseMode === "sign"
                    ? "Add a note (optional)..."
                    : "Details here..."
                }
              />
              <div className="flex items-center gap-6">
                <button
                  onClick={handleSubmitResponse}
                  className="bg-gray-900 text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-[#9d4edd] transition-colors"
                >
                  {responseMode === "sign" ? "Sign & Confirm" : "Send Response"}
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

          <footer className="pt-10 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Kind Regards,
            </p>
            <p className="text-2xl font-black text-[#9d4edd] tracking-tight">
              {doc.content.va_name}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
