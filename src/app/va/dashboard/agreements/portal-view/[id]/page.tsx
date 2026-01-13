"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// 1. Define specific allowed types for values
type AgreementValue = string | string[] | undefined;

type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  value?: AgreementValue; // Replaced 'any'
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
  custom_structure: AgreementStructure;
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
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    async function loadAgreement() {
      const { data } = await supabase
        .from("client_agreements")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setAgreement(data as Agreement);
      setLoading(false);
    }
    loadAgreement();
  }, [id]);

  // 2. Updated to use the AgreementValue type
  const handleUpdateValue = (
    sectionId: string,
    itemId: string,
    newValue: AgreementValue
  ) => {
    if (!agreement) return;
    const newStructure = { ...agreement.custom_structure };
    const section = newStructure.sections.find((s) => s.id === sectionId);
    const item = section?.items.find((i) => i.id === itemId);
    if (item) {
      item.value = newValue;
      setAgreement({ ...agreement, custom_structure: newStructure });
    }
  };

  const handleSaveProgress = async () => {
    if (!agreement) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("client_agreements")
      .update({ custom_structure: agreement.custom_structure })
      .eq("id", id);

    if (!error) alert("Progress saved successfully!");
    setIsSaving(false);
  };

  const handlePublish = async () => {
    if (!agreement) return;
    if (!window.confirm("Issue this to the client portal?")) return;

    setIsPublishing(true);
    const { error } = await supabase
      .from("client_agreements")
      .update({
        status: "pending_client",
        custom_structure: agreement.custom_structure,
      })
      .eq("id", id);

    if (!error) {
      await supabase.from("agreement_logs").insert([
        {
          agreement_id: id,
          change_summary: "VA pre-populated and issued agreement",
        },
      ]);
      alert("Agreement Issued!");
      router.push(`/va/dashboard/crm/profile/${agreement.client_id}`);
    }
    setIsPublishing(false);
  };

  if (loading) return <div className="p-10 text-black">Loading Portal...</div>;
  if (!agreement)
    return <div className="p-10 text-black">Agreement not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black">
      {/* ACTION BAR */}
      <div className="bg-[#9d4edd] p-4 sticky top-0 z-50 shadow-lg flex justify-between items-center px-8">
        <div className="text-white">
          <p className="font-bold text-sm uppercase tracking-widest">
            {agreement.status === "draft"
              ? "Internal Prep Mode"
              : "Reviewing Agreement"}
          </p>
          <p className="text-xs">Fill in client details here before issuing.</p>
        </div>
        <div className="flex gap-4">
          <button
            disabled={isSaving}
            onClick={handleSaveProgress}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded font-bold text-sm transition-all"
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </button>
          {agreement.status === "draft" && (
            <button
              disabled={isPublishing}
              onClick={handlePublish}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow-xl transition-all"
            >
              {isPublishing ? "Issuing..." : "ISSUE TO CLIENT"}
            </button>
          )}
        </div>
      </div>

      {/* AGREEMENT FORM */}
      <div className="max-w-4xl mx-auto mt-10 bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-900 p-12 text-white text-center">
          <h1 className="text-4xl font-black mb-2 tracking-tight uppercase">
            Service Agreement
          </h1>
          <p className="text-gray-400 uppercase tracking-[0.2em] text-sm">
            {agreement.title}
          </p>
        </div>

        <div className="p-12 space-y-12">
          {agreement.custom_structure.sections.map((section) => (
            <div
              key={section.id}
              className="border-b border-gray-100 pb-8 last:border-0"
            >
              <h2 className="text-xl font-bold mb-6 text-[#9d4edd] uppercase tracking-wide">
                {section.title}
              </h2>

              <div className="space-y-6">
                {section.items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700">
                      {item.label}
                    </label>

                    {item.type === "textarea" ? (
                      <textarea
                        className="w-full border p-3 rounded-lg min-h-32 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none transition-all text-black"
                        placeholder="Type response here..."
                        value={(item.value as string) || ""}
                        onChange={(e) =>
                          handleUpdateValue(section.id, item.id, e.target.value)
                        }
                      />
                    ) : item.type === "checkbox_group" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.options?.map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              className="w-5 h-5 rounded border-gray-300 text-[#9d4edd]"
                              checked={
                                Array.isArray(item.value)
                                  ? item.value.includes(opt)
                                  : false
                              }
                              onChange={(e) => {
                                const currentValues = Array.isArray(item.value)
                                  ? item.value
                                  : [];
                                const nextValues = e.target.checked
                                  ? [...currentValues, opt]
                                  : currentValues.filter((v) => v !== opt);
                                handleUpdateValue(
                                  section.id,
                                  item.id,
                                  nextValues
                                );
                              }}
                            />
                            <span className="text-sm text-gray-600">{opt}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <input
                        type={item.type}
                        className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none transition-all text-black"
                        value={(item.value as string) || ""}
                        onChange={(e) =>
                          handleUpdateValue(section.id, item.id, e.target.value)
                        }
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
