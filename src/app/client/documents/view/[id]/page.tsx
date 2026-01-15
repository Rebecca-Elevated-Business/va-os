"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";

// 1. Define the local type to remove the 'any' error
type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
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

export default function ClientDocumentView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // 2. Apply the type to useState
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseMode, setResponseMode] = useState<"accept" | "edit" | null>(
    null
  );
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
    const statusUpdate =
      responseMode === "accept" ? "accepted" : "feedback_received";

    await supabase
      .from("client_documents")
      .update({ status: statusUpdate })
      .eq("id", id);

    await supabase.from("client_requests").insert([
      {
        client_id: doc.client_id,
        type: "work",
        status: "new",
        message: `PROPOSAL RESPONSE (${responseMode?.toUpperCase()}): ${
          comment || "No additional comments provided."
        }`,
      },
    ]);

    alert(
      responseMode === "accept"
        ? "Proposal Accepted! Your VA has been notified."
        : "Feedback Sent! Your VA will review this shortly."
    );
    router.push("/client/dashboard");
  };

  if (loading)
    return (
      <div className="p-10 text-gray-500 italic">Loading your document...</div>
    );
  if (!doc)
    return (
      <div className="p-10 text-red-500 font-bold">Document not found.</div>
    );

  const content = doc.content;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100">
        {/* 3. Optimized Next.js Image */}
        {content.header_image && (
          <div className="h-72 w-full relative">
            <Image
              src={content.header_image}
              alt="Header"
              fill
              priority
              className="object-cover"
              unoptimized={content.header_image.includes("unsplash")} // Unsplash handles its own optimization
            />
            <div className="absolute inset-0 bg-linear-to-t from-white/80 to-transparent"></div>
          </div>
        )}

        <div className="p-8 md:p-16 space-y-12 -mt-10 relative bg-white rounded-t-4xl">
          <header>
            <div className="inline-block px-3 py-1 bg-purple-100 text-[#9d4edd] text-[10px] font-black uppercase tracking-widest rounded-full mb-4">
              {doc.type.replace("_", " ")}
            </div>
            <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-none mb-6">
              {doc.title}
            </h1>
          </header>

          <section className="text-lg text-gray-700 leading-relaxed">
            <p className="whitespace-pre-wrap">{content.intro_text}</p>
          </section>

          {content.scope_of_work && (
            <section className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
                Proposed Scope of Work
              </h2>
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-lg font-medium">
                {content.scope_of_work}
              </p>
            </section>
          )}

          {content.legal_text && (
            <section className="p-8 border-2 border-dashed border-gray-100 rounded-3xl">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Terms & Conditions
              </h2>
              <div className="text-sm text-gray-500 leading-relaxed h-48 overflow-y-auto pr-4">
                {content.legal_text}
              </div>
            </section>
          )}

          {content.quote_details && (
            <section className="flex flex-col md:flex-row md:items-center justify-between p-8 bg-purple-900 text-white rounded-3xl shadow-xl shadow-purple-200">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">
                  Total Investment
                </h2>
                <p className="text-sm opacity-90 italic">
                  Inclusive of all services outlined above
                </p>
              </div>
              <div className="text-4xl font-black mt-4 md:mt-0 tracking-tighter">
                {content.quote_details}
              </div>
            </section>
          )}

          <footer className="pt-10 border-t border-gray-100">
            <p className="text-gray-600 mb-8 leading-relaxed italic">
              {content.closing_statement}
            </p>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Kind Regards,
              </p>
              <p className="text-2xl font-black text-[#9d4edd] tracking-tight">
                {content.va_name}
              </p>
            </div>
          </footer>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-10">
            <button
              onClick={() => setResponseMode("accept")}
              className="bg-[#9d4edd] hover:bg-[#7b2cbf] text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg transform transition active:scale-95"
            >
              Accept & Proceed
            </button>
            <button
              onClick={() => setResponseMode("edit")}
              className="border-2 border-gray-200 text-gray-500 py-5 rounded-2xl font-bold hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
            >
              Request Edits
            </button>
          </div>

          {responseMode && (
            <div className="mt-8 p-8 bg-white border-4 border-[#9d4edd] rounded-4xl shadow-2xl animate-in fade-in slide-in-from-top-4">
              <h3 className="text-xl font-black mb-4 tracking-tight">
                {responseMode === "accept"
                  ? "Confirm Acceptance"
                  : "What should we change?"}
              </h3>
              <textarea
                className="w-full border-2 border-gray-100 p-5 rounded-2xl bg-gray-50 focus:ring-4 focus:ring-purple-50 focus:border-[#9d4edd] outline-none mb-6 transition-all"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type your message here..."
              />
              <div className="flex items-center gap-6">
                <button
                  onClick={handleSubmitResponse}
                  className="bg-gray-900 text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-[#9d4edd] transition-colors"
                >
                  Send Response
                </button>
                <button
                  onClick={() => setResponseMode(null)}
                  className="text-gray-400 font-bold hover:text-red-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
