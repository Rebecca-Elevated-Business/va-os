"use client";

import { useState, useEffect, use, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AgreementEditor, {
  Agreement,
} from "@/app/va/dashboard/workflows/AgreementEditor";
import { usePrompt } from "@/components/ui/PromptProvider";

type Template = {
  id: string;
  title: string;
  guidance_content?: {
    sections?: {
      id: string;
      title: string;
      body: string;
      sort_order?: number;
    }[];
  } | null;
};

type AgreementWithMeta = Agreement & {
  client_id: string;
  template_id: string;
};

export default function EditAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { alert, confirm } = usePrompt();

  const [agreement, setAgreement] = useState<AgreementWithMeta | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [activeTab, setActiveTab] = useState<"internal" | "client">("client");
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadAgreement() {
      const { data } = await supabase
        .from("client_agreements")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        const nextAgreement = data as AgreementWithMeta;
        setAgreement(nextAgreement);
        if (nextAgreement.template_id) {
          const { data: t } = await supabase
            .from("sop_templates")
            .select("*")
            .eq("id", nextAgreement.template_id)
            .single();
          if (t) setTemplate(t);
        }
      }
      setLoading(false);
    }
    loadAgreement();
  }, [id]);

  useEffect(() => {
    if (!template?.guidance_content?.sections?.length) return;
    const sortedSections = [...template.guidance_content.sections].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const timeoutId = window.setTimeout(() => {
      setOpenSectionIds(sortedSections[0]?.id ? [sortedSections[0].id] : []);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [template]);

  const guidanceSections = useMemo(() => {
    const sections = template?.guidance_content?.sections ?? [];
    return [...sections].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [template]);

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((idValue) => idValue !== sectionId)
        : [...prev, sectionId]
    );
  };

  const persistAgreement = async (notify = true) => {
    if (!agreement) return false;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { error: updateError } = await supabase
      .from("client_agreements")
      .update({
        custom_structure: agreement.custom_structure,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      if (notify) {
        await alert({
          title: "Error saving",
          message: `Error saving: ${updateError.message}`,
          tone: "danger",
        });
      }
      setSaving(false);
      return false;
    }

    await supabase.from("agreement_logs").insert([
      {
        agreement_id: id,
        changed_by: userData.user.id,
        change_summary: "VA updated agreement structure/content",
        snapshot: agreement.custom_structure,
      },
    ]);

    if (notify) {
      await alert({
        title: "Changes saved",
        message: "Changes saved successfully.",
      });
    }
    setSaving(false);
    return true;
  };

  const handleSave = async () => {
    await persistAgreement(true);
  };

  const handlePreview = async () => {
    if (!agreement) return;
    const saved = await persistAgreement(false);
    if (!saved) return;
    window.open(
      `/va/dashboard/workflows/portal-view/${agreement.id}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleIssue = async () => {
    if (!agreement) return;
    const ok = await confirm({
      title: "Issue to client?",
      message:
        "Are you sure you want to issue this workflow to the client portal?",
      confirmLabel: "Issue to Client",
    });
    if (!ok) return;

    setIsIssuing(true);
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
    setIsIssuing(false);
  };

  const handleAgreementChange = (nextAgreement: Agreement) => {
    setAgreement((current) =>
      current
        ? {
            ...nextAgreement,
            client_id: current.client_id,
            template_id: current.template_id,
          }
        : ({ ...nextAgreement, client_id: "", template_id: "" } as AgreementWithMeta)
    );
  };

  if (loading) return <div className="p-10 text-black">Loading Editor...</div>;
  if (!agreement)
    return <div className="p-10 text-black">Agreement not found.</div>;

  return (
    <div className="max-w-5xl mx-auto pb-20 text-black">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Workflow Template
            </p>
            <h1 className="text-2xl font-bold">{agreement.title}</h1>
            <p className="text-sm text-gray-500 mt-2">
              Internal guidance for yourself, plus the client-facing workflow
              builder.
            </p>
          </div>
          <button
            onClick={() =>
              router.push(`/va/dashboard/crm/profile/${agreement.client_id}`)
            }
            className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
          >
            Back to CRM
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("internal")}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              activeTab === "internal"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            Internal Guidance
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              activeTab === "client"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            Client Workflow
          </button>
        </div>
      </div>

      {activeTab === "internal" ? (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              VA-Facing Guidance
            </p>
            <p className="text-sm text-gray-600 mt-2">
              This content is for internal use only. It outlines how to deliver
              this service, the steps required, and any operational notes for
              your VA team.
            </p>
          </div>

          {guidanceSections.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500">
              No internal guidance has been added for this template yet.
            </div>
          ) : (
            <div className="space-y-3">
              {guidanceSections.map((section) => {
                const isOpen = openSectionIds.includes(section.id);
                return (
                  <div
                    key={section.id}
                    className="bg-white border border-gray-100 rounded-xl shadow-sm"
                  >
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left"
                    >
                      <span className="font-semibold text-gray-900">
                        {section.title}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 text-sm text-gray-600 leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({ children }) => (
                              <h2 className="mt-4 text-base font-semibold text-gray-900">
                                {children}
                              </h2>
                            ),
                            p: ({ children }) => (
                              <p className="mt-3">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="mt-3 list-disc pl-5 space-y-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mt-3 list-decimal pl-5 space-y-1">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => <li>{children}</li>,
                            strong: ({ children }) => (
                              <strong className="font-semibold text-gray-900">
                                {children}
                              </strong>
                            ),
                            hr: () => (
                              <hr className="my-6 border-gray-200" />
                            ),
                          }}
                        >
                          {section.body}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                Draft Workflow
              </p>
              <p className="text-lg font-bold text-gray-900">
                {agreement.title}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePreview}
                className="border border-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-300 hover:text-gray-900 transition-all"
              >
                Preview
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="border border-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-300 hover:text-gray-900 transition-all disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button
                onClick={handleIssue}
                disabled={isIssuing}
                className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all disabled:opacity-60"
              >
                {isIssuing ? "Issuing..." : "Issue to Client"}
              </button>
            </div>
          </div>

          <AgreementEditor
            agreement={agreement}
            onChange={handleAgreementChange}
          />

          <div className="pt-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handlePreview}
                className="border border-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-300 hover:text-gray-900 transition-all"
              >
                Preview
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="border border-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:border-gray-300 hover:text-gray-900 transition-all disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button
                onClick={handleIssue}
                disabled={isIssuing}
                className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all disabled:opacity-60"
              >
                {isIssuing ? "Issuing..." : "Issue to Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
