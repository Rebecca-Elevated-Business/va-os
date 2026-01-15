"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UploadContent = {
  file_url?: string;
  file_name?: string;
  va_note?: string;
};

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  content: UploadContent;
};

export default function EditUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [doc, setDoc] = useState<ClientDoc | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !doc) return;

    setUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${doc.client_id}/${Date.now()}.${fileExt}`;
    const filePath = `client-uploads/${fileName}`;

    // 1. Upload to Supabase Storage Bucket
    const { error: uploadError } = await supabase.storage
      .from("documents") // Ensure you have a bucket named 'documents'
      .upload(filePath, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    // 2. Get Public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(filePath);

    // 3. Update Local State
    setDoc({
      ...doc,
      content: { ...doc.content, file_url: publicUrl, file_name: file.name },
    });
    setUploading(false);
  };

  const handleSave = async (isIssuing = false) => {
    if (!doc || !doc.content.file_url)
      return alert("Please upload a file first.");

    const { error } = await supabase
      .from("client_documents")
      .update({
        content: doc.content,
        status: isIssuing ? "issued" : "draft",
        issued_at: isIssuing ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (!error) {
      alert(isIssuing ? "Document Issued!" : "Draft Saved.");
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

  return (
    <div className="p-6 max-w-2xl mx-auto text-black pb-40 font-sans">
      <div className="flex justify-between items-end mb-10 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Upload Document
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
            Send your own PDF/Doc to the client
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* UPLOAD BOX */}
        <div
          className={`relative border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all ${
            doc.content.file_url
              ? "border-green-100 bg-green-50"
              : "border-gray-100 bg-gray-50"
          }`}
        >
          {!doc.content.file_url ? (
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
                    content: { ...doc.content, file_url: undefined },
                  })
                }
                className="text-[10px] font-black text-red-400 underline uppercase tracking-widest"
              >
                Remove and Replace
              </button>
            </div>
          )}
        </div>

        {/* OPTIONAL NOTE */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">
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

        {/* FINAL ACTIONS */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <button
            onClick={() => handleSave(false)}
            className="py-4 border-2 border-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            Save as Draft
          </button>
          <button
            disabled={!doc.content.file_url}
            onClick={() => handleSave(true)}
            className="py-4 bg-[#9d4edd] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#7b2cbf] shadow-xl shadow-purple-100 transition-all disabled:opacity-50 disabled:bg-gray-300"
          >
            Issue to Client
          </button>
        </div>
      </div>
    </div>
  );
}
