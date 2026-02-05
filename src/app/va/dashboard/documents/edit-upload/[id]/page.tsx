"use client";

import { useState, useEffect, use, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";

type UploadContent = {
  file_url?: string;
  file_path?: string;
  file_name?: string;
  va_note?: string;
};

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  type: string;
  content: UploadContent;
};

export default function EditUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { alert, confirm } = usePrompt();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadDoc() {
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        const incoming = data as ClientDoc;
        const normalizedTitle =
          incoming.type === "upload" && incoming.title === "Upload"
            ? ""
            : incoming.title;
        setDoc({ ...incoming, title: normalizedTitle });
      }
      setLoading(false);
    }
    loadDoc();
  }, [id]);

  useEffect(() => {
    if (!isActionMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActionMenuOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !doc) return;

    setUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${doc.client_id}/${Date.now()}.${fileExt}`;
    const filePath = `client-uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      await alert({
        title: "Upload failed",
        message: `Upload failed: ${uploadError.message}`,
        tone: "danger",
      });
      setUploading(false);
      return;
    }

    setDoc({
      ...doc,
      content: { ...doc.content, file_path: filePath, file_name: file.name },
    });
    setUploading(false);
  };

  const handleSave = async (isIssuing = false) => {
    const trimmedTitle = (doc?.title || "").trim();
    if (!trimmedTitle) {
      await alert({
        title: "Title required",
        message: "Please add a document title before saving.",
        tone: "danger",
      });
      return;
    }
    const hasFile = Boolean(doc?.content.file_path || doc?.content.file_url);
    if (!doc || !hasFile) {
      await alert({
        title: "File required",
        message: "Please upload a file first.",
        tone: "danger",
      });
      return;
    }

    const wasIssued = doc.status === "issued";
    const { error } = await supabase
      .from("client_documents")
      .update({
        title: trimmedTitle,
        content: doc.content,
        status: isIssuing ? "issued" : "draft",
        issued_at: isIssuing ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (!error) {
      if (isIssuing && !wasIssued) {
        await supabase.from("client_notifications").insert([
          {
            client_id: doc.client_id,
            type: "document_issued",
            message: `New document available: ${doc.title}`,
          },
        ]);
      }
      await alert({
        title: isIssuing ? "Document issued" : "Draft saved",
        message: isIssuing ? "Document Issued!" : "Draft Saved.",
      });
      if (isIssuing) router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center text-gray-400 italic">
        Loading Upload Tool...
      </div>
    );
  if (!doc)
    return (
      <div className="p-10 text-center text-red-500 font-bold">
        Document not found.
      </div>
    );

  const handleMarkCompleted = async () => {
    if (!doc || doc.status === "completed") return;
    const ok = await confirm({
      title: "Mark as completed?",
      message:
        "This will mark the uploaded document as completed for both you and the client.",
      confirmLabel: "Mark completed",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_documents")
      .update({ status: "completed" })
      .eq("id", id);
    if (!error) {
      await alert({
        title: "Marked as completed",
        message: "The document is now marked as completed.",
      });
      setDoc({ ...doc, status: "completed" });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto text-black pb-40 font-sans">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Upload Document
          </h1>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">
            Send your own PDF/Doc to the client
          </p>
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest mt-1">
            Accepted formats: PDF, PNG, JPG
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative" ref={actionMenuRef}>
            <button
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
              className="border border-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-300 hover:text-gray-900 transition-all"
            >
              Actions
            </button>
            {isActionMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-lg z-50">
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handleSave(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handleSave(true);
                  }}
                  disabled={!doc.content.file_path && !doc.content.file_url}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Issue to Client
                </button>
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    handleMarkCompleted();
                  }}
                  disabled={doc.status === "completed"}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Mark as Completed
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-gray-500 tracking-widest block ml-2">
            Document title
          </label>
          <input
            className="w-full p-4 bg-white border-2 border-gray-50 rounded-2xl outline-none focus:border-purple-100 shadow-sm text-sm"
            placeholder="e.g. Onboarding Guide"
            value={doc.title || ""}
            onChange={(e) => setDoc({ ...doc, title: e.target.value })}
          />
        </div>
        <div
          className={`relative border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all ${
            doc.content.file_path || doc.content.file_url
              ? "border-green-100 bg-green-50"
              : "border-gray-100 bg-gray-50"
          }`}
        >
          {!doc.content.file_path && !doc.content.file_url ? (
            <>
              <div className="text-4xl mb-4">📄</div>
              <p className="text-sm font-bold text-gray-500 mb-6">
                Click to select or drag and drop your document
              </p>
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest">
                {uploading ? "Uploading..." : "Browse Files"}
              </button>
            </>
          ) : (
            <div className="animate-in zoom-in duration-300">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-sm font-black text-green-700 uppercase tracking-widest mb-1">
                File Uploaded Successfully
              </p>
              <p className="text-xs text-green-600 mb-6 font-medium">
                {doc.content.file_name}
              </p>
              <button
                onClick={() =>
                  setDoc({
                    ...doc,
                    content: {
                      ...doc.content,
                      file_url: undefined,
                      file_path: undefined,
                    },
                  })
                }
                className="text-[10px] font-black text-red-400 underline uppercase tracking-widest"
              >
                Remove and Replace
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-gray-500 tracking-widest block ml-2">
            Personal Note for Client (Optional)
          </label>
          <textarea
            className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-30 shadow-sm text-sm"
            placeholder="e.g. Please see the attached onboarding guide for your reference..."
            value={doc.content.va_note || ""}
            onChange={(e) =>
              setDoc({
                ...doc,
                content: { ...doc.content, va_note: e.target.value },
              })
            }
          />
        </div>

      </div>
    </div>
  );
}
