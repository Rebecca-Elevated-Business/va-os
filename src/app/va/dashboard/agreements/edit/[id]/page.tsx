"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Define Types
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
  custom_structure: AgreementStructure;
  status: string;
};

export default function EditAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

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

  // --- EDITING LOGIC ---

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    if (!agreement) return;
    const newStructure = { ...agreement.custom_structure };
    newStructure.sections[sectionIndex].items.splice(itemIndex, 1);
    setAgreement({ ...agreement, custom_structure: newStructure });
  };

  const addOption = (sectionIndex: number, itemIndex: number) => {
    if (!agreement) return;
    const option = window.prompt("Enter new option:");
    if (!option) return;

    const newStructure = { ...agreement.custom_structure };
    const item = newStructure.sections[sectionIndex].items[itemIndex];
    if (item.options) {
      item.options.push(option);
      setAgreement({ ...agreement, custom_structure: newStructure });
    }
  };

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
      alert("Error saving: " + updateError.message);
      setSaving(false);
      return;
    }

    // 2. Create Version Control Log
    // This tracks that the VA (user.id) made this specific update
    await supabase.from("agreement_logs").insert([
      {
        agreement_id: id,
        changed_by: userData.user.id,
        change_summary: "VA updated agreement structure/content",
        snapshot: agreement.custom_structure,
      },
    ]);

    alert("Changes saved successfully.");
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
          <h1 className="text-2xl font-bold">Customize Service Agreement</h1>
          <p className="text-gray-500 text-sm">Managing: {agreement.title}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/va/dashboard/agreements")}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-black"
          >
            Back to Library
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="bg-[#9d4edd] text-white px-8 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {agreement.custom_structure.sections.map((section, sIndex) => (
          <div
            key={section.id}
            className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"
          >
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 border-b pb-2">
              {section.title}
            </h2>

            <div className="space-y-6">
              {section.items.map((item, iIndex) => (
                <div
                  key={item.id}
                  className="group relative border-l-2 border-gray-100 pl-4 py-2 hover:border-[#9d4edd] transition-all"
                >
                  <button
                    onClick={() => removeItem(sIndex, iIndex)}
                    className="absolute -right-2 top-0 text-gray-300 hover:text-red-500 text-xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete Item ✕
                  </button>

                  <label className="block text-sm font-bold mb-2">
                    {item.label}
                  </label>

                  {item.type === "checkbox_group" && (
                    <div className="flex flex-wrap gap-2">
                      {item.options?.map((opt, oIndex) => (
                        <span
                          key={oIndex}
                          className="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full text-xs text-gray-600"
                        >
                          {opt}
                        </span>
                      ))}
                      <button
                        onClick={() => addOption(sIndex, iIndex)}
                        className="bg-purple-50 text-[#9d4edd] border border-purple-100 px-3 py-1 rounded-full text-xs font-bold hover:bg-purple-100"
                      >
                        + Add Option
                      </button>
                    </div>
                  )}

                  {(item.type === "text" ||
                    item.type === "date" ||
                    item.type === "textarea") && (
                    <div className="bg-gray-50 rounded border border-gray-200 border-dashed w-full flex items-center px-4 py-3 text-gray-400 text-xs italic">
                      Input field for Client (Editable by VA in Client Portal
                      view)
                    </div>
                  )}

                  {item.type === "checkbox" && (
                    <div className="w-5 h-5 border-2 border-gray-200 rounded" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-gray-400 text-xs italic">
        Changes saved here update the agreement structure. To fill in client
        details yourself, you can access the document via the Client List.
      </div>
    </div>
  );
}
