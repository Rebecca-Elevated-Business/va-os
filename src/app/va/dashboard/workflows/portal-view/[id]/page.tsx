"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";

type AgreementValue = string | string[] | undefined;

type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  value?: AgreementValue;
  hidden?: boolean;
  hidden_options?: string[];
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
  const { confirm, alert } = usePrompt();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAuthorising, setIsAuthorising] = useState(false);
  const [isVA, setIsVA] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      // 1. Check if viewer is VA or Client
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role === "va") setIsVA(true);
      }

      // 2. Load Agreement
      const { data } = await supabase
        .from("client_agreements")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setAgreement(data as Agreement);
      setLoading(false);
    }
    loadInitialData();
  }, [id]);

  const handleUpdateValue = (
    sectionId: string,
    itemId: string,
    newValue: AgreementValue
  ) => {
    if (!agreement || agreement.status === "active") return; // Prevent edits if active
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

    if (!error) {
      await alert({
        title: "Progress saved",
        message: "Progress saved successfully.",
      });
    }
    setIsSaving(false);
  };

  // 1. VA ISSUE LOGIC (Restored)
  const handlePublish = async () => {
    if (!agreement) return;
    const ok = await confirm({
      title: "Issue to client?",
      message: "Issue this to the client portal?",
      confirmLabel: "Issue",
    });
    if (!ok) return;

    setIsPublishing(true);
    const { error } = await supabase
      .from("client_agreements")
      .update({
        status: "pending_client",
        custom_structure: agreement.custom_structure,
      })
      .eq("id", id);

    if (!error) {
      await supabase.from("client_notifications").insert([
        {
          client_id: agreement.client_id,
          type: "agreement_issued",
          message: `New service agreement available: ${agreement.title}`,
        },
      ]);
      await supabase.from("agreement_logs").insert([
        {
          agreement_id: id,
          change_summary: "VA pre-populated and issued agreement",
        },
      ]);
      await alert({
        title: "Agreement issued",
        message: "Agreement Issued!",
      });
      router.push(`/va/dashboard/crm/profile/${agreement.client_id}`);
    }
    setIsPublishing(false);
  };

  // 3. CLIENT AUTHORISATION LOGIC
  const handleAuthorise = async () => {
    if (!agreement) return;
    const ok = await confirm({
      title: "Authorise workflow?",
      message:
        "Are you sure you want to authorise this workflow? This will lock the document and notify your VA.",
      confirmLabel: "Authorise",
      tone: "danger",
    });
    if (!ok) return;

    setIsAuthorising(true);
    const { error } = await supabase
      .from("client_agreements")
      .update({
        status: "active",
        custom_structure: agreement.custom_structure,
      })
      .eq("id", id);

    if (!error) {
      await supabase.from("agreement_logs").insert([
        {
          agreement_id: id,
          change_summary: "Client officially AUTHORISED the workflow",
          snapshot: agreement.custom_structure,
        },
      ]);

      await alert({
        title: "Workflow authorised",
        message: "Workflow Authorised Successfully.",
      });
      router.push("/client/dashboard");
    }
    setIsAuthorising(false);
  };

  if (loading) return <div className="p-10 text-black">Loading Portal...</div>;
  if (!agreement)
    return <div className="p-10 text-black">Agreement not found.</div>;

  const isReadOnly = agreement.status === "active";

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black">
      {/* ACTION BAR */}
      <div className="bg-[#9d4edd] p-4 sticky top-0 z-50 shadow-lg flex justify-between items-center px-8">
        <div className="text-white">
          <p className="font-bold text-sm uppercase tracking-widest">
            {agreement.status === "active"
              ? "Authorised Workflow"
              : agreement.status === "pending_client"
              ? "Pending Authorisation"
              : "Internal Prep Mode"}
          </p>
          <p className="text-xs">
            {agreement.status === "active"
              ? "This document is now locked and active."
              : "Please review details and save progress as needed."}
          </p>
        </div>
        <div className="flex gap-4">
          {!isReadOnly && (
            <button
              disabled={isSaving}
              onClick={handleSaveProgress}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded font-bold text-sm"
            >
              {isSaving ? "Saving..." : "Save Progress"}
            </button>
          )}

          {isVA && agreement.status === "draft" && (
            <button
              disabled={isPublishing}
              onClick={handlePublish}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow-xl transition-all"
            >
              {isPublishing ? "Issuing..." : "ISSUE TO CLIENT"}
            </button>
          )}

          {/* CLIENT ACTIONS: Authorise (only if pending) */}
          {!isVA && agreement.status === "pending_client" && (
            <button
              disabled={isAuthorising}
              onClick={handleAuthorise}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow-xl animate-pulse"
            >
              {isAuthorising ? "Authorising..." : "AUTHORISE WORKFLOW"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-10 bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-900 p-12 text-white text-center">
          <h1 className="text-4xl font-black mb-2 tracking-tight uppercase">
            Service Authorisation
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
              <h2 className="text-xl font-normal mb-6 text-[#333333]">
                {section.title.replace(/^\s*\d+\.\s*/, "")}
              </h2>

              <div className="space-y-6">
                {section.items
                  .filter((item) => !item.hidden)
                  .map((item) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <label className="text-sm font-normal text-[#333333]">
                      {item.label}
                    </label>

                    {item.type === "textarea" ? (
                      <textarea
                        disabled={isReadOnly}
                        className={`w-full border p-3 rounded-lg min-h-32 outline-none transition-all text-[#333333] ${
                          isReadOnly
                            ? "bg-gray-50 border-transparent"
                            : "bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200"
                        }`}
                        value={(item.value as string) || ""}
                        onChange={(e) =>
                          handleUpdateValue(section.id, item.id, e.target.value)
                        }
                      />
                    ) : item.type === "checkbox_group" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.options
                          ?.filter(
                            (opt) => !item.hidden_options?.includes(opt)
                          )
                          .map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <input
                              disabled={isReadOnly}
                              type="checkbox"
                              className="w-5 h-5 rounded border-gray-300 text-[#333333]"
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
                            <span className="text-sm font-normal text-[#333333]">
                              {opt}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <input
                        disabled={isReadOnly}
                        type={item.type}
                        className={`w-full border p-3 rounded-lg outline-none transition-all text-[#333333] ${
                          isReadOnly
                            ? "bg-gray-50 border-transparent"
                            : "bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-200"
                        }`}
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

          {/* SIGNATURE SECTION */}
          <div className="bg-purple-50 p-8 rounded-xl border border-purple-100 mt-10">
            <h3 className="font-bold text-gray-900 mb-4">
              Final Authorisation
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              By clicking &quot;Authorise Workflow&quot;, I confirm that the
              details provided above are accurate and I grant permission for the
              VA to proceed with these specific instruction parameters.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Authorised By (Print Name)
                </label>
                <input
                  disabled={isReadOnly}
                  type="text"
                  placeholder="Type your full name..."
                  className="w-full border-b-2 border-gray-200 bg-transparent p-2 outline-none focus:border-[#9d4edd] text-black font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Date of Authorisation
                </label>
                <input
                  disabled={true}
                  type="text"
                  value={new Date().toLocaleDateString("en-GB")}
                  className="w-full border-b-2 border-gray-200 bg-transparent p-2 text-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
