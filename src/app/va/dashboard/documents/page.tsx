"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileSignature,
  ReceiptText,
  Upload,
  Search,
} from "lucide-react";

// Define the document types based on your workflow
const DOCUMENT_TYPES = [
  {
    id: "proposal",
    title: "Project Proposal",
    description:
      "Outline project scope, service options, and estimated timelines for potential clients.",
    icon: FileText,
    category: "Pre-Onboarding",
  },
  {
    id: "booking_form",
    title: "Booking Form (Contract)",
    description:
      "Formal legal agreement and booking confirmation with E-Signature requirements.",
    icon: FileSignature,
    category: "Legal",
  },
  {
    id: "invoice",
    title: "Professional Invoice",
    description:
      "Generate billable item summaries with British Pound (£) currency and due dates.",
    icon: ReceiptText,
    category: "Financial",
  },
  {
    id: "upload",
    title: "Upload & send own document",
    description:
      "Upload an existing PDF or document from your device to send directly to the client portal.",
    icon: Upload,
    category: "Custom",
  },
];

export default function DocumentLibraryPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<
    (typeof DOCUMENT_TYPES)[0] | null
  >(null);
  const [search, setSearch] = useState("");

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return DOCUMENT_TYPES;
    const value = search.toLowerCase();
    return DOCUMENT_TYPES.filter(
      (doc) =>
        doc.title.toLowerCase().includes(value) ||
        doc.description.toLowerCase().includes(value) ||
        doc.category.toLowerCase().includes(value)
    );
  }, [search]);

  return (
    <div className="text-black">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Document Centre</h1>
          <p className="text-gray-500 max-w-2xl">
            Create polished proposals, contracts, and invoices in minutes.
            Drafts are saved to the client vault for review and sending.
          </p>
        </div>
        <div className="w-full max-w-md">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            Search Document Type
          </label>
          <div className="flex items-center gap-2 bg-white border border-[#333333] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#9d4edd]/20">
            <Search className="h-4 w-4 text-[#9d4edd]" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search proposals, invoices, uploads..."
              className="w-full bg-transparent text-sm text-gray-700 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredTypes.map((doc) => {
          const Icon = doc.icon;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedType(doc)}
              className="group text-left bg-white border border-gray-100 rounded-2xl p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-[#9d4edd]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#9d4edd]">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {doc.category}
                </span>
              </div>
              <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#9d4edd] transition-colors uppercase tracking-tight">
                {doc.title}
              </h3>
              <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                {doc.description}
              </p>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-[#9d4edd] uppercase tracking-widest">
                  {selectedType.category}
                </span>
                <h1 className="text-2xl font-bold">{selectedType.title}</h1>
              </div>
              <button
                onClick={() => setSelectedType(null)}
                className="h-9 w-9 rounded-full border border-gray-200 text-gray-400 hover:text-black hover:border-gray-300 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold mb-4 uppercase text-[#9d4edd] tracking-tight">
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

              <div className="bg-purple-50 rounded-xl border border-purple-100 p-6 text-center flex flex-col justify-between gap-6">
                <div>
                  <p className="text-purple-900 font-medium">
                    Ready to{" "}
                    {selectedType.id === "upload"
                      ? "upload this file?"
                      : "issue this to a client?"}
                  </p>
                  <p className="text-sm text-purple-700 mt-2 italic">
                    {selectedType.id === "upload"
                      ? "Ensure your file is finalized before uploading."
                      : "Generate the draft to begin adding project-specific details."}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
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
                    className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#7b2cbf] transition-all"
                  >
                    {selectedType.id === "upload"
                      ? "Go to Upload"
                      : "Generate Document"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
