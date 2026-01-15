"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Define the document types based on your workflow
const DOCUMENT_TYPES = [
  {
    id: "proposal",
    title: "Project Proposal",
    description:
      "Outline project scope, service options, and estimated timelines for potential clients.",
    icon: "📋",
    category: "Pre-Onboarding",
  },
  {
    id: "booking_form",
    title: "Booking Form (Contract)",
    description:
      "Formal legal agreement and booking confirmation with E-Signature requirements.",
    icon: "🖋️",
    category: "Legal",
  },
  {
    id: "invoice",
    title: "Professional Invoice",
    description:
      "Generate billable item summaries with British Pound (£) currency and due dates.",
    icon: "💰",
    category: "Financial",
  },
  {
    id: "upload",
    title: "Upload & send own document",
    description:
      "Upload an existing PDF or document from your device to send directly to the client portal.",
    icon: "📤",
    category: "Custom",
  },
];

export default function DocumentLibraryPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<
    (typeof DOCUMENT_TYPES)[0] | null
  >(null);

  return (
    <div className="text-black">
      {/* 1. HEADER SECTION (Mirrors Service Agreements) */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Centre</h1>
        <p className="text-gray-500 max-w-3xl">
          Select a document type below to generate professional{" "}
          <strong>Proposals, Contracts, or Invoices</strong>. Once generated,
          you can customise the content before issuing it to the client portal.
        </p>
      </div>

      {/* 2. DOCUMENT SELECTOR GRID (Mirrors Service Agreements Icons) */}
      {!selectedType ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl">
          {DOCUMENT_TYPES.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedType(doc)}
              className="group cursor-pointer flex flex-col items-center text-center space-y-3"
            >
              {/* PDF Style Icon Card */}
              <div className="w-full aspect-3/4 bg-white rounded-lg border-2 border-gray-100 shadow-sm group-hover:border-[#9d4edd] group-hover:shadow-md transition-all flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-gray-50 border-l border-b border-gray-100 rounded-bl-lg" />
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">
                  {doc.icon}
                </div>
                <div className="h-1 w-12 bg-[#9d4edd] rounded-full mb-4" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {doc.category}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm group-hover:text-[#9d4edd] transition-colors uppercase tracking-tight">
                  {doc.title}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1 px-4">
                  {doc.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 3. PREVIEW & INFORMATION VIEW (Mirrors Playbook View) */
        <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div>
              <span className="text-xs font-bold text-[#9d4edd] uppercase tracking-widest">
                {selectedType.category}
              </span>
              <h1 className="text-2xl font-bold">{selectedType.title}</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedType(null)}
                className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-black"
              >
                Back
              </button>
              <button
                onClick={() =>
                  router.push(
                    `/va/dashboard/documents/create?type=${selectedType.id}`
                  )
                }
                className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all"
              >
                {selectedType.id === "upload"
                  ? "Go to Upload"
                  : "Generate Document"}
              </button>
            </div>
          </div>

          <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 min-h-75">
            <h2 className="text-xl font-bold mb-4 uppercase text-[#9d4edd] tracking-tight">
              {selectedType.id === "upload"
                ? "Upload Instructions"
                : "Document Overview"}
            </h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              {selectedType.id === "upload"
                ? "Upload your custom files (PDF, Docx) to share them directly with your client via their secure portal. You can add a personal note before sending."
                : `This ${selectedType.title} will be pre-populated with your standard VA-OS branding. After clicking generate, you will select your client and enter the specific operational or financial details required.`}
            </p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                ✅ Automatically stored in Client Vault
              </li>
              <li className="flex items-center gap-2">
                ✅ Instant notification to client
              </li>
              <li className="flex items-center gap-2">
                ✅ Secure SSL protected delivery
              </li>
            </ul>
          </div>

          <div className="mt-8 p-6 bg-purple-50 rounded-xl border border-purple-100 text-center">
            <p className="text-purple-900 font-medium">
              Ready to{" "}
              {selectedType.id === "upload"
                ? "upload this file?"
                : "issue this to a client?"}
            </p>
            <p className="text-sm text-purple-700 mb-4 italic">
              {selectedType.id === "upload"
                ? "Ensure your file is finalized before uploading."
                : "Generate the draft to begin adding project-specific details."}
            </p>
            <button
              onClick={() =>
                router.push(
                  `/va/dashboard/documents/create?type=${selectedType.id}`
                )
              }
              className="text-[#9d4edd] font-bold hover:underline"
            >
              {selectedType.id === "upload"
                ? "Start Upload"
                : `Issue ${selectedType.title}`}{" "}
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
