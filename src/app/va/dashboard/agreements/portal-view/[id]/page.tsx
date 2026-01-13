"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// 1. DEFINE STRICT TYPES (Copied from Editor Page)
type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  placeholder?: string;
};

type AgreementSection = {
  id: string;
  title: string;
  items: AgreementItem[];
};

type AgreementStructure = {
  sections: AgreementSection[];
};

type Agreement = {
  id: string;
  title: string;
  custom_structure: AgreementStructure; // Now strictly typed
  status: string;
  client_id: string;
};

export default function AgreementPortalView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    async function loadAgreement() {
      const { data } = await supabase
        .from("client_agreements")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setAgreement(data);
      setLoading(false);
    }
    loadAgreement();
  }, [id]);

  const handlePublish = async () => {
    if (!agreement) return;
    if (
      !window.confirm(
        "Are you sure? This will issue the agreement to the Client Portal and notify the client."
      )
    )
      return;

    setIsPublishing(true);

    const { error } = await supabase
      .from("client_agreements")
      .update({ status: "pending_client" })
      .eq("id", id);

    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("agreement_logs").insert([
        {
          agreement_id: id,
          changed_by: userData.user?.id,
          change_summary: "Agreement officially PUBLISHED to client portal",
        },
      ]);

      alert("Agreement Issued Successfully!");
      router.push(`/va/dashboard/crm/profile/${agreement.client_id}`);
    }
    setIsPublishing(false);
  };

  if (loading)
    return <div className="p-10 text-black">Loading Portal View...</div>;
  if (!agreement)
    return <div className="p-10 text-black">Agreement not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black">
      {/* VA-Only Action Bar */}
      {agreement.status === "draft" && (
        <div className="bg-[#9d4edd] p-4 sticky top-0 z-50 shadow-lg flex justify-between items-center px-8">
          <div className="text-white">
            <p className="font-bold text-sm text-purple-200 uppercase tracking-widest">
              Draft Mode
            </p>
            <p className="text-xs">
              Review exactly how this looks. The client cannot see this yet.
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() =>
                router.push(`/va/dashboard/agreements/edit/${agreement.id}`)
              }
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded font-bold text-sm transition-all"
            >
              Return to Editor
            </button>
            <button
              disabled={isPublishing}
              onClick={handlePublish}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow-xl transition-all"
            >
              {isPublishing ? "Publishing..." : "ISSUE TO CLIENT"}
            </button>
          </div>
        </div>
      )}

      {/* SERVICE AGREEMENT VIEW */}
      <div className="max-w-4xl mx-auto mt-10 bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-900 p-12 text-white text-center">
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            SERVICE AGREEMENT
          </h1>
          <p className="text-gray-400 uppercase tracking-[0.2em] text-sm">
            {agreement.title}
          </p>
        </div>

        <div className="p-12 space-y-12">
          {/* Now using strict types for section mapping */}
          {agreement.custom_structure.sections.map((section) => (
            <div
              key={section.id}
              className="border-b border-gray-100 pb-8 last:border-0"
            >
              <h2 className="text-xl font-bold mb-6 text-[#9d4edd] uppercase tracking-wide">
                {section.title}
              </h2>

              <div className="space-y-6">
                {/* Now using strict types for item mapping */}
                {section.items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700">
                      {item.label}
                    </label>

                    {item.type === "checkbox_group" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.options?.map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              className="w-5 h-5 rounded border-gray-300 text-[#9d4edd]"
                            />
                            <span className="text-sm text-gray-600">{opt}</span>
                          </div>
                        ))}
                      </div>
                    ) : item.type === "textarea" ? (
                      <textarea
                        className="w-full border p-3 rounded-lg min-h-25 bg-gray-50"
                        placeholder="Client response goes here..."
                      />
                    ) : (
                      <input
                        type={item.type}
                        className="w-full border p-3 rounded-lg bg-gray-50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
