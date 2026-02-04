"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";

type AgreementValue = string | string[] | boolean | undefined;

type AgreementItem = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "checkbox" | "checkbox_group";
  options?: string[];
  value?: AgreementValue;
  hidden?: boolean;
  hidden_options?: string[];
  layout?: "inline";
};

type AgreementSection = {
  id: string;
  title: string;
  items: AgreementItem[];
};

type AgreementStructure = {
  sections: AgreementSection[];
  authorisation_disclaimer?: string;
  authorisation_confirmation?: string;
};

type Agreement = {
  id: string;
  title: string;
  custom_structure: AgreementStructure;
  status: string;
  client_id: string;
  va_id?: string | null;
  is_locked?: boolean;
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
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [isVA, setIsVA] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [clientAuthId, setClientAuthId] = useState<string | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState<string>("Client");
  const [vaDisplayName, setVaDisplayName] = useState<string>("VA");
  const [logsOpen, setLogsOpen] = useState(false);
  const [agreementLogs, setAgreementLogs] = useState<
    {
      id: string;
      changed_by: string | null;
      change_summary: string | null;
      created_at: string | null;
    }[]
  >([]);

  useEffect(() => {
    async function loadInitialData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role === "va") setIsVA(true);
        if (profile?.role === "va") {
          const { data: profileName } = await supabase
            .from("profiles")
            .select("full_name, first_name, surname")
            .eq("id", user.id)
            .single();
          const vaName =
            profileName?.full_name ||
            `${profileName?.first_name || ""} ${profileName?.surname || ""}`.trim();
          if (vaName) setVaDisplayName(vaName);
        }
      }

      const { data } = await supabase
        .from("client_agreements")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setAgreement(data as Agreement);
      if (data) {
        const { data: client } = await supabase
          .from("clients")
          .select("auth_user_id, first_name, surname, business_name")
          .eq("id", (data as Agreement).client_id)
          .single();
        if (client?.auth_user_id) setClientAuthId(client.auth_user_id);
        if (client) {
          const name = `${client.first_name || ""} ${client.surname || ""}`.trim();
          setClientDisplayName(
            name || client.business_name || "Client",
          );
        }
      }
      setLoading(false);
    }
    loadInitialData();
  }, [id]);

  useEffect(() => {
    if (!logsOpen || !agreement) return;
    const loadLogs = async () => {
      const { data } = await supabase
        .from("agreement_logs")
        .select("id, changed_by, change_summary, created_at")
        .eq("agreement_id", agreement.id)
        .order("created_at", { ascending: false });
      setAgreementLogs(
        (data as { id: string; changed_by: string | null; change_summary: string | null; created_at: string | null }[]) ||
          [],
      );
    };
    void loadLogs();
  }, [logsOpen, agreement]);

  const handleUpdateValue = (
    sectionId: string,
    itemId: string,
    newValue: AgreementValue
  ) => {
    if (!agreement || (!isVA && agreement.is_locked)) return;
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
    const { error } = isVA
      ? await supabase
          .from("client_agreements")
          .update({ custom_structure: agreement.custom_structure })
          .eq("id", id)
      : await supabase.rpc("client_save_agreement_progress", {
          agreement_id: id,
          new_structure: agreement.custom_structure,
        });

    if (!error) {
      if (isVA) {
        await supabase.from("agreement_logs").insert([
          {
            agreement_id: id,
            change_summary: "VA updated agreement content",
            snapshot: agreement.custom_structure,
          },
        ]);
        if (agreement.status === "in_use") {
          await supabase.from("client_notifications").insert([
            {
              client_id: agreement.client_id,
              type: "agreement_updated",
              message: `Agreement updated: ${agreement.title}`,
            },
          ]);
        }
      }
      await alert({
        title: "Progress saved",
        message: "Progress saved successfully.",
      });
    }
    setIsSaving(false);
  };

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
        status: "issued",
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
    const { error } = await supabase.rpc("client_authorise_agreement", {
      agreement_id: id,
      new_structure: agreement.custom_structure,
    });

    if (!error) {
      await alert({
        title: "Workflow authorised",
        message: "Workflow Authorised Successfully.",
      });
      router.push("/client/dashboard");
    }
    setIsAuthorising(false);
  };

  const handlePrint = () => {
    if (!agreement) return;
    window.print();
  };

  const handleRequestChanges = async () => {
    if (!agreement) return;
    setIsRequestingChanges(true);
    const { error } = await supabase.rpc("client_request_agreement_changes", {
      agreement_id: id,
      message: "",
      new_structure: agreement.custom_structure,
    });

    if (!error) {
      await alert({
        title: "Request sent",
        message: "Your VA has been notified and will review your changes.",
      });
      router.push("/client/dashboard");
    }
    setIsRequestingChanges(false);
  };

  const handleAcknowledgeChanges = async () => {
    if (!agreement) return;
    const ok = await confirm({
      title: "Acknowledge changes?",
      message:
        "This will acknowledge the client's updates and move the agreement to in use.",
      confirmLabel: "Acknowledge",
    });
    if (!ok) return;
    setIsAcknowledging(true);
    const { error } = await supabase
      .from("client_agreements")
      .update({ status: "in_use", last_updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      await supabase.from("agreement_logs").insert([
        {
          agreement_id: id,
          change_summary: "VA acknowledged client changes",
          snapshot: agreement.custom_structure,
        },
      ]);
      await supabase.from("client_notifications").insert([
        {
          client_id: agreement.client_id,
          type: "agreement_acknowledged",
          message: `Changes acknowledged: ${agreement.title}`,
        },
      ]);
      setAgreement({ ...agreement, status: "in_use" });
      await alert({
        title: "Changes acknowledged",
        message: "The agreement is now in use.",
      });
    }
    setIsAcknowledging(false);
  };

  const handleToggleLock = async () => {
    if (!agreement || !isVA) return;
    const nextLocked = !agreement.is_locked;
    const ok = await confirm({
      title: nextLocked ? "Lock agreement?" : "Unlock agreement?",
      message: nextLocked
        ? "Clients will no longer be able to edit this agreement."
        : "Clients will be able to edit this agreement again.",
      confirmLabel: nextLocked ? "Lock agreement" : "Unlock agreement",
    });
    if (!ok) return;
    setIsTogglingLock(true);
    const { error } = await supabase
      .from("client_agreements")
      .update({ is_locked: nextLocked })
      .eq("id", id);
    if (!error) {
      setAgreement({ ...agreement, is_locked: nextLocked });
      await supabase.from("agreement_logs").insert([
        {
          agreement_id: id,
          change_summary: nextLocked
            ? "VA locked the agreement"
            : "VA unlocked the agreement",
          snapshot: agreement.custom_structure,
        },
      ]);
      await alert({
        title: nextLocked ? "Agreement locked" : "Agreement unlocked",
        message: nextLocked
          ? "Clients can no longer edit this agreement."
          : "Clients can edit this agreement again.",
      });
    }
    setIsTogglingLock(false);
  };

  if (loading) return <div className="p-10 text-black">Loading Portal...</div>;
  if (!agreement)
    return <div className="p-10 text-black">Agreement not found.</div>;

  const isReadOnly = Boolean(!isVA && agreement.is_locked);
  const statusLabel = (() => {
    if (isVA) {
      if (agreement.status === "draft") return "Draft";
      if (agreement.status === "issued") return "Issued";
      if (agreement.status === "change_submitted") return "Client change made";
      if (agreement.status === "in_use") return "Agreement in use";
      return agreement.status.replace("_", " ");
    }
    if (agreement.status === "issued") return "Agreement received";
    if (agreement.status === "change_submitted") return "Change submitted";
    if (agreement.status === "in_use") return "Agreement in use";
    return agreement.status.replace("_", " ");
  })();
  const defaultAuthorisationDisclaimer =
    "I understand this workflow agreement describes how work will be delivered and does not amend or replace the booking agreement.";
  const defaultAuthorisationConfirmation =
    'By clicking "Authorise Workflow", I confirm that the details provided above are accurate and I grant permission for the VA to proceed with these specific instruction parameters.';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-black">
      <div className="max-w-4xl mx-auto mt-6 flex flex-wrap items-center justify-end gap-4 print:hidden">
        <div className="flex items-center gap-4 mr-auto text-sm font-semibold">
          <button
            onClick={() => setLogsOpen(true)}
            className="text-[#9d4edd] hover:text-[#4A2E6F] transition-colors"
          >
            View change log
          </button>
          {!isReadOnly && (
            <button
              disabled={isSaving}
              onClick={handleSaveProgress}
              className="text-[#9d4edd] hover:text-[#4A2E6F] transition-colors"
            >
              {isSaving ? "Saving..." : "Save progress"}
            </button>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="px-6 py-2 border-2 border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
        >
          Download / Print
        </button>
      </div>

      <div className="max-w-4xl mx-auto mt-4 flex flex-wrap items-center justify-end gap-4 print:hidden">
        {isVA && agreement.status === "draft" && (
          <button
            disabled={isPublishing}
            onClick={handlePublish}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow-xl transition-all"
          >
            {isPublishing ? "Issuing..." : "ISSUE TO CLIENT"}
          </button>
        )}

        {isVA && agreement.status === "change_submitted" && (
          <button
            disabled={isAcknowledging}
            onClick={handleAcknowledgeChanges}
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded font-bold text-sm hover:border-gray-300 hover:text-gray-900 transition-all"
          >
            {isAcknowledging ? "Acknowledging..." : "ACKNOWLEDGE CHANGES"}
          </button>
        )}

        {isVA && (
          <button
            disabled={isTogglingLock}
            onClick={handleToggleLock}
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded font-bold text-sm hover:border-gray-300 hover:text-gray-900 transition-all"
          >
            {agreement.is_locked ? "UNLOCK AGREEMENT" : "LOCK AGREEMENT"}
          </button>
        )}

        {!isVA &&
          !agreement.is_locked &&
          (agreement.status === "issued" ||
            agreement.status === "change_submitted" ||
            agreement.status === "in_use") && (
          <>
            <button
              disabled={isRequestingChanges}
              onClick={handleRequestChanges}
              className="border border-gray-200 text-gray-700 px-4 py-2 rounded font-bold text-sm hover:border-gray-300 hover:text-gray-900 transition-all"
            >
              {isRequestingChanges ? "Submitting..." : "SUBMIT CHANGES"}
            </button>
          </>
        )}

        {!isVA &&
          (agreement.status === "issued" ||
            agreement.status === "change_submitted") && (
            <button
              disabled={isAuthorising}
              onClick={handleAuthorise}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow-xl animate-pulse"
            >
              {isAuthorising ? "Authorising..." : "AUTHORISE WORKFLOW"}
            </button>
          )}
      </div>

      {logsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Change log</h2>
              <button
                onClick={() => setLogsOpen(false)}
                className="text-sm font-semibold text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>
            <div className="max-h-105 overflow-auto px-6 py-4 space-y-4">
              {agreementLogs.length === 0 ? (
                <div className="text-sm text-gray-400">No changes yet.</div>
              ) : (
                agreementLogs.map((log) => {
                  const actor =
                    log.changed_by && log.changed_by === currentUserId
                      ? "You"
                      : log.changed_by && log.changed_by === clientAuthId
                      ? clientDisplayName
                      : vaDisplayName || "VA";
                  return (
                    <div
                      key={log.id}
                      className="border border-gray-100 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {actor}
                        </div>
                        <div className="text-xs text-gray-400">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString()
                            : ""}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {log.change_summary || "Update"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {!isVA && (
        <div className="max-w-4xl mx-auto mt-6 text-sm font-semibold">
          <button
            onClick={() => router.push("/client/dashboard")}
            className="text-[#333333] hover:text-[#4a2e6f] transition-colors"
          >
            Back to homepage
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto mt-6 bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-900 p-12 text-white text-center">
          <h1 className="text-4xl font-black mb-2 tracking-tight text-white!">
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
              <h2 className="text-xl font-normal mb-6 text-[#333333]">
                {section.title.replace(/^\s*\d+\.\s*/, "")}
              </h2>

              <div className="space-y-6">
                {section.items
                  .filter((item) => !item.hidden)
                  .map((item) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    {item.type !== "checkbox" &&
                      !(
                        item.layout === "inline" &&
                        (item.type === "text" || item.type === "date")
                      ) && (
                      <label className="text-sm font-normal text-[#333333]">
                        {item.label}
                      </label>
                    )}

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
                      <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
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
                              className="w-5 h-5 rounded border-[#333333] text-[#333333] accent-[#333333]"
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
                    ) : item.type === "checkbox" ? (
                      <label className="flex items-center gap-3">
                        <input
                          disabled={isReadOnly}
                          type="checkbox"
                          className="w-5 h-5 rounded border-[#333333] text-[#333333] accent-[#333333]"
                          checked={Boolean(item.value)}
                          onChange={(event) =>
                            handleUpdateValue(
                              section.id,
                              item.id,
                              event.target.checked
                            )
                          }
                        />
                        <span className="text-sm font-normal text-[#333333]">
                          {item.label}
                        </span>
                      </label>
                    ) : item.type === "text" || item.type === "date" ? (
                      <div
                        className={
                          item.layout === "inline"
                            ? "grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start"
                            : ""
                        }
                      >
                        {item.layout === "inline" && (
                          <div className="text-sm font-normal text-[#333333]">
                            {item.label}
                          </div>
                        )}
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

          <div className="bg-purple-50 p-8 rounded-xl border border-purple-100 mt-10">
            <h3 className="font-bold text-gray-900 mb-4">
              Final Authorisation
            </h3>
            <div className="space-y-3 mb-6 text-sm text-gray-600 leading-relaxed">
              <p>
                {agreement.custom_structure.authorisation_disclaimer ??
                  defaultAuthorisationDisclaimer}
              </p>
              <p>
                {agreement.custom_structure.authorisation_confirmation ??
                  defaultAuthorisationConfirmation}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Authorised By (Print Name)
                </label>
                <input
                  disabled={isReadOnly || isVA}
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
