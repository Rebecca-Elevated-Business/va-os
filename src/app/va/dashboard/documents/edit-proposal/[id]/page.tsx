"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Eye, Plus, Trash2 } from "lucide-react";
import {
  mergeProposalContent,
  type ProposalContent,
  type ProposalScopeItem,
  type ProposalTrustSignal,
} from "@/lib/proposalContent";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
  issued_at: string | null;
  content: ProposalContent;
};

const TRUST_ICON_OPTIONS: {
  value: ProposalTrustSignal["icon"];
  label: string;
}[] = [
  { value: "gdpr", label: "GDPR" },
  { value: "experience", label: "Experience" },
  { value: "communication", label: "Communication" },
  { value: "awards", label: "Awards" },
  { value: "insured", label: "Insured" },
  { value: "member", label: "Membership" },
  { value: "custom", label: "Custom" },
];

const buildSignatureBlock = (seed: {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
}) => {
  const lines = [seed.name, seed.company, seed.email, seed.phone, seed.website];
  return lines.filter(Boolean).join("\n");
};

export default function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [doc, setDoc] = useState<ClientDoc | null>(null);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    async function loadDoc() {
      const { data } = await supabase
        .from("client_documents")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        const clientDoc = data as ClientDoc;
        let preparedBy = "VA/Business Name";
        let signatureText = "";

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", user.id)
            .maybeSingle();
          const { data: business } = await supabase
            .from("va_business_details")
            .select("company_name, email, phone, website_url")
            .eq("va_id", user.id)
            .maybeSingle();

          preparedBy =
            business?.company_name ||
            profile?.display_name ||
            profile?.full_name ||
            preparedBy;

          signatureText = buildSignatureBlock({
            name: profile?.display_name || profile?.full_name || "",
            company: business?.company_name || "",
            email: business?.email || user.email || "",
            phone: business?.phone || "",
            website: business?.website_url || "",
          });
        }

        const mergedContent = mergeProposalContent(clientDoc.content, {
          preparedBy,
          signatureText,
        });
        clientDoc.content = mergedContent;
        setDoc(clientDoc);
        lastSavedRef.current = JSON.stringify({
          title: clientDoc.title,
          content: mergedContent,
          status: clientDoc.status,
        });
      }

      setLoading(false);
    }
    loadDoc();
  }, [id]);

  const updateContent = (updates: Partial<ProposalContent>) => {
    if (!doc) return;
    setDoc({
      ...doc,
      content: { ...doc.content, ...updates },
    });
  };

  const handleHeroUpload = (file: File) => {
    if (!doc) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateContent({ hero_image_url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const updateInvestment = (updates: Partial<ProposalContent["investment"]>) => {
    if (!doc) return;
    updateContent({
      investment: { ...doc.content.investment, ...updates },
    });
  };

  const updateScopeItem = (index: number, updates: Partial<ProposalScopeItem>) => {
    if (!doc) return;
    const items = [...doc.content.scope_items];
    items[index] = { ...items[index], ...updates };
    updateContent({ scope_items: items });
  };

  const updateTrustSignal = (
    index: number,
    updates: Partial<ProposalTrustSignal>
  ) => {
    if (!doc) return;
    const items = [...doc.content.trust_signals];
    items[index] = { ...items[index], ...updates };
    updateContent({ trust_signals: items });
  };

  const updateNextStep = (index: number, value: string) => {
    if (!doc) return;
    const steps = [...doc.content.next_steps];
    steps[index] = { ...steps[index], text: value };
    updateContent({ next_steps: steps });
  };

  const persistDoc = useCallback(
    async (options?: { issue?: boolean; silent?: boolean }) => {
      if (!doc) return;
      const shouldIssue = Boolean(options?.issue);
      const silent = Boolean(options?.silent);
      if (silent) {
        setAutosaving(true);
      } else {
        setSaving(true);
      }

      const payload = {
        content: doc.content,
        status: shouldIssue ? "issued" : doc.status,
        issued_at: shouldIssue ? new Date().toISOString() : doc.issued_at,
      };

      const { error } = await supabase
        .from("client_documents")
        .update(payload)
        .eq("id", id);

      if (silent) {
        setAutosaving(false);
      } else {
        setSaving(false);
      }

      if (!error) {
        lastSavedRef.current = JSON.stringify({
          title: doc.title,
          content: doc.content,
          status: shouldIssue ? "issued" : doc.status,
        });
        if (!silent) {
          alert(shouldIssue ? "Proposal issued to client!" : "Draft saved.");
          if (shouldIssue)
            router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
        }
      }
    },
    [doc, id, router]
  );

  useEffect(() => {
    if (!doc || loading || saving) return;
    const snapshot = JSON.stringify({
      title: doc.title,
      content: doc.content,
      status: doc.status,
    });
    if (snapshot === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      persistDoc({ silent: true });
    }, 1200);

    return () => clearTimeout(timer);
  }, [doc, loading, saving, persistDoc]);

  if (loading)
    return (
      <div className="p-10 text-gray-400 italic">
        Loading Proposal Editor...
      </div>
    );
  if (!doc) return <div className="p-10 text-red-500">Proposal not found.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto text-black pb-40">
      <div className="mb-8 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-start gap-4">
        <span className="text-xl">💡</span>
        <div>
          <p className="font-bold text-[#9d4edd] text-sm">VA Training Note</p>
          <p className="text-xs text-purple-700/70 leading-relaxed">
            Your professional template has been pre-filled below. You can edit
            any text, hide sections you don&apos;t need, or add extra items to
            tailor the proposal for your client.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Proposal Builder
          </h1>
          <p className="text-xs font-bold text-gray-400">
            STATUS: {doc.status.toUpperCase()}
            {autosaving && " · Autosaving..."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              window.open(`/va/dashboard/documents/preview/${id}`, "_blank")
            }
            className="px-6 py-2 border-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={() => persistDoc({ issue: false })}
            disabled={saving}
            className="px-6 py-2 border-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            onClick={() => persistDoc({ issue: true })}
            disabled={saving}
            className="px-6 py-2 bg-[#9d4edd] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#7b2cbf] shadow-xl shadow-purple-100 transition-all"
          >
            Issue to Client
          </button>
        </div>
      </div>

      <div className="space-y-10">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Hero Section
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500">
                Hero Image (optional)
              </label>
              <input
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                placeholder="Paste image URL (optional)"
                value={doc.content.hero_image_url}
                onChange={(e) =>
                  updateContent({ hero_image_url: e.target.value })
                }
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-500">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHeroUpload(file);
                    }}
                  />
                  <span className="px-4 py-2 border-2 border-gray-100 rounded-xl cursor-pointer hover:border-purple-200">
                    Upload image
                  </span>
                </label>
                {doc.content.hero_image_url && (
                  <button
                    type="button"
                    onClick={() => updateContent({ hero_image_url: "" })}
                    className="text-xs font-bold text-red-400 hover:text-red-500"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">
                Proposal Title
              </label>
              <input
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                value={doc.content.hero_title}
                onChange={(e) => updateContent({ hero_title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">
                Prepared for
              </label>
              <input
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                value={doc.content.prepared_for}
                onChange={(e) => updateContent({ prepared_for: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">
                Prepared by
              </label>
              <input
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                value={doc.content.prepared_by}
                onChange={(e) => updateContent({ prepared_by: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">Date</label>
              <input
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                value={doc.content.prepared_date}
                onChange={(e) =>
                  updateContent({ prepared_date: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Warm Welcome
            </label>
            <button
              onClick={() =>
                updateContent({ show_warm_welcome: !doc.content.show_warm_welcome })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_warm_welcome ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_warm_welcome && (
            <textarea
              className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-37.5 leading-relaxed shadow-sm text-sm"
              value={doc.content.warm_welcome_text}
              onChange={(e) =>
                updateContent({ warm_welcome_text: e.target.value })
              }
            />
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Proposed Scope of Work
            </label>
            <button
              onClick={() =>
                updateContent({ show_scope: !doc.content.show_scope })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_scope ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_scope && (
            <div className="space-y-4">
              {doc.content.scope_items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-3 relative"
                >
                  <button
                    onClick={() => {
                      const items = [...doc.content.scope_items];
                      items.splice(index, 1);
                      updateContent({ scope_items: items });
                    }}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500"
                    aria-label="Remove scope item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <input
                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-purple-100"
                    value={item.title}
                    onChange={(e) =>
                      updateScopeItem(index, { title: e.target.value })
                    }
                  />
                  <textarea
                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none min-h-20 focus:border-purple-100"
                    value={item.summary}
                    onChange={(e) =>
                      updateScopeItem(index, { summary: e.target.value })
                    }
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  updateContent({
                    scope_items: [
                      ...doc.content.scope_items,
                      {
                        id: `scope-${Date.now()}`,
                        title: "New service title",
                        summary: "",
                      },
                    ],
                  })
                }
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-black text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Scope Item
              </button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Investment
            </label>
            <button
              onClick={() =>
                updateContent({ show_investment: !doc.content.show_investment })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_investment ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_investment && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500">
                  Pricing model
                </label>
                <select
                  className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                  value={doc.content.investment.model}
                  onChange={(e) =>
                    updateInvestment({
                      model: e.target.value as ProposalContent["investment"]["model"],
                    })
                  }
                >
                  <option value="one_off">One-off package</option>
                  <option value="monthly_retainer">Monthly retainer</option>
                  <option value="hourly">Hourly allocation</option>
                  <option value="custom">Add your own</option>
                </select>
              </div>
              {doc.content.investment.model === "custom" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500">
                    Custom label
                  </label>
                  <input
                    className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                    value={doc.content.investment.custom_label || ""}
                    onChange={(e) =>
                      updateInvestment({ custom_label: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500">Price</label>
                <input
                  className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                  value={doc.content.investment.price}
                  onChange={(e) =>
                    updateInvestment({ price: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500">
                  Billing frequency
                </label>
                <input
                  className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                  value={doc.content.investment.billing_frequency}
                  onChange={(e) =>
                    updateInvestment({ billing_frequency: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={doc.content.investment.include_vat}
                  onChange={(e) =>
                    updateInvestment({ include_vat: e.target.checked })
                  }
                />
                Include VAT
              </label>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500">
                  Optional pricing note
                </label>
                <textarea
                  className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm min-h-20"
                  value={doc.content.investment.note}
                  onChange={(e) => updateInvestment({ note: e.target.value })}
                />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Trust Signals
            </label>
            <button
              onClick={() =>
                updateContent({
                  show_trust_signals: !doc.content.show_trust_signals,
                })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_trust_signals ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_trust_signals && (
            <div className="space-y-4">
              {doc.content.trust_signals.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 md:grid-cols-[1fr_200px_auto] items-center bg-gray-50 border border-gray-100 rounded-2xl p-4"
                >
                  <input
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-100"
                    value={item.label}
                    onChange={(e) =>
                      updateTrustSignal(index, { label: e.target.value })
                    }
                  />
                  <select
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-100"
                    value={item.icon}
                    onChange={(e) =>
                      updateTrustSignal(index, {
                        icon: e.target.value as ProposalTrustSignal["icon"],
                      })
                    }
                  >
                    {TRUST_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const items = [...doc.content.trust_signals];
                      items.splice(index, 1);
                      updateContent({ trust_signals: items });
                    }}
                    className="text-gray-300 hover:text-red-500"
                    aria-label="Remove trust signal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  updateContent({
                    trust_signals: [
                      ...doc.content.trust_signals,
                      {
                        id: `trust-${Date.now()}`,
                        label: "New trust signal",
                        icon: "custom",
                      },
                    ],
                  })
                }
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-black text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Trust Signal
              </button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              What Happens Next
            </label>
            <button
              onClick={() =>
                updateContent({ show_next_steps: !doc.content.show_next_steps })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_next_steps ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_next_steps && (
            <div className="space-y-3">
              {doc.content.next_steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3"
                >
                  <span className="text-xs font-black text-gray-400">
                    {index + 1}
                  </span>
                  <input
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-100"
                    value={step.text}
                    onChange={(e) => updateNextStep(index, e.target.value)}
                  />
                  <button
                    onClick={() => {
                      const steps = [...doc.content.next_steps];
                      steps.splice(index, 1);
                      updateContent({ next_steps: steps });
                    }}
                    className="text-gray-300 hover:text-red-500"
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  updateContent({
                    next_steps: [
                      ...doc.content.next_steps,
                      { id: `step-${Date.now()}`, text: "New step" },
                    ],
                  })
                }
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-black text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Step
              </button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Additional Notes
            </label>
            <button
              onClick={() =>
                updateContent({
                  show_additional_notes: !doc.content.show_additional_notes,
                })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_additional_notes ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_additional_notes && (
            <textarea
              className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-25 leading-relaxed shadow-sm text-sm"
              value={doc.content.additional_notes}
              onChange={(e) =>
                updateContent({ additional_notes: e.target.value })
              }
            />
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
              Thank You & Sign Off
            </label>
            <button
              onClick={() =>
                updateContent({ show_thank_you: !doc.content.show_thank_you })
              }
              className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
            >
              {doc.content.show_thank_you ? "Hide section" : "Show section"}
            </button>
          </div>
          {doc.content.show_thank_you && (
            <textarea
              className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-25 leading-relaxed shadow-sm text-sm"
              value={doc.content.thank_you_text}
              onChange={(e) =>
                updateContent({ thank_you_text: e.target.value })
              }
            />
          )}
        </section>

        <section className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Signature / Footer
          </label>
          <textarea
            className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-20 leading-relaxed shadow-sm text-sm"
            value={doc.content.signature_text}
            onChange={(e) => updateContent({ signature_text: e.target.value })}
          />
        </section>
      </div>
    </div>
  );
}
