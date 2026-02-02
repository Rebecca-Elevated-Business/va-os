"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AgreementEditor, {
  Agreement,
} from "@/app/va/dashboard/workflows/AgreementEditor";
import { usePrompt } from "@/components/ui/PromptProvider";

export default function EditAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { alert } = usePrompt();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // --- SAVE & LOGGING LOGIC ---
  const handleSave = async () => {
    if (!agreement) return;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // 1. Update the Agreement (Structure remains as is, status stays 'draft')
    const { error: updateError } = await supabase
      .from("client_agreements")
      .update({
        custom_structure: agreement.custom_structure,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      await alert({
        title: "Error saving",
        message: `Error saving: ${updateError.message}`,
        tone: "danger",
      });
      setSaving(false);
      return;
    }

    // 2. Create Version Control Log
    await supabase.from("agreement_logs").insert([
      {
        agreement_id: id,
        changed_by: userData.user.id,
        change_summary: "VA updated agreement structure/content",
        snapshot: agreement.custom_structure,
      },
    ]);

    await alert({
      title: "Changes saved",
      message: "Changes saved successfully.",
    });
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-black">Loading Editor...</div>;
  if (!agreement)
    return <div className="p-10 text-black">Agreement not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20 text-black">
      {/* Header Info Bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Customise Service Agreement</h1>
          <p className="text-gray-500 text-sm">
            Managing: <span className="font-semibold">{agreement.title}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/va/dashboard/workflows/")}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-black"
          >
            Back to Library
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="bg-[#9d4edd] text-white px-8 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as Draft"}
          </button>
        </div>
      </div>

      <AgreementEditor agreement={agreement} onChange={setAgreement} />
    </div>
  );
}
