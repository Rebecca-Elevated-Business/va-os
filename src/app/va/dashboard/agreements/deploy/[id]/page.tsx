"use client";

import { useState, useEffect, use, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import AgreementEditor, {
  Agreement,
  AgreementStructure,
} from "@/app/va/dashboard/agreements/AgreementEditor";

type Client = {
  id: string;
  first_name: string;
  surname: string;
  business_name: string;
};

type Template = {
  id: string;
  title: string;
  default_structure: AgreementStructure;
  guidance_content?: {
    sections?: {
      id: string;
      title: string;
      body: string;
      sort_order?: number;
    }[];
  } | null;
};

export default function DeployAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Data State
  const [template, setTemplate] = useState<Template | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [agreement, setAgreement] = useState<Agreement | null>(null);

  // Search/Selection State
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState<"internal" | "client">("internal");
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      // 1. Load Template
      const { data: t } = await supabase
        .from("sop_templates")
        .select("*")
        .eq("id", id)
        .single();
      if (t) setTemplate(t);

      // 2. Load all clients for the picker
      const { data: c } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .order("surname");
      if (c) setClients(c);
    }
    loadData();
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

  const handleDeploy = async () => {
    if (!selectedClient || !template) return;
    setDeploying(true);

    const { data: userData } = await supabase.auth.getUser();

    // 1. Create the Client Agreement record
    // This CLONES the master structure into a client-specific instance
    const { data: agreement, error } = await supabase
      .from("client_agreements")
      .insert([
        {
          client_id: selectedClient.id,
          va_id: userData.user?.id,
          template_id: template.id,
          title: `${template.title} Agreement`,
          custom_structure: template.default_structure, // This is the clone
          status: "draft",
        },
      ])
      .select()
      .single();

    if (!error && agreement) {
      setAgreement(agreement);
    } else {
      alert("Error deploying: " + error?.message);
    }
    setDeploying(false);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.surname.toLowerCase().includes(search.toLowerCase()) ||
      c.business_name?.toLowerCase().includes(search.toLowerCase())
  );

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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { error: updateError } = await supabase
      .from("client_agreements")
      .update({
        custom_structure: agreement.custom_structure,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", agreement.id);

    if (updateError) {
      if (notify) alert("Error saving: " + updateError.message);
      return false;
    }

    await supabase.from("agreement_logs").insert([
      {
        agreement_id: agreement.id,
        changed_by: userData.user.id,
        change_summary: "VA updated agreement structure/content",
        snapshot: agreement.custom_structure,
      },
    ]);

    if (notify) alert("Changes saved successfully.");
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
      `/va/dashboard/agreements/portal-view/${agreement.id}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (!template) return <div className="p-10">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-20 text-black">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Service Agreement Template
            </p>
            <h1 className="text-2xl font-bold">{template.title}</h1>
            <p className="text-sm text-gray-500 mt-2">
              Internal guidance for your VA team, plus the client-facing
              agreement builder.
            </p>
          </div>
          <button
            onClick={() => router.push("/va/dashboard/agreements")}
            className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest"
          >
            Back to Library
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
            Client Agreement
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
                        {section.body}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {!agreement && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-2">Create Client Draft</h2>
              <p className="text-gray-500 mb-6 text-sm">
                Select a client to create a draft of the agreement based on this
                template.
              </p>

              <div className="space-y-4">
                <label className="text-xs font-bold text-gray-400 uppercase">
                  Search Client by Surname or Business
                </label>
                <input
                  type="text"
                  placeholder="Type to search..."
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#9d4edd]"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedClient(null);
                  }}
                />

                {search && !selectedClient && (
                  <div className="border rounded-lg max-h-60 overflow-y-auto divide-y shadow-sm">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedClient(c);
                          setSearch(`${c.first_name} ${c.surname}`);
                        }}
                        className="w-full text-left p-3 hover:bg-purple-50 flex justify-between items-center"
                      >
                        <span className="font-medium">
                          {c.first_name} {c.surname}
                        </span>
                        <span className="text-xs text-gray-400">
                          {c.business_name}
                        </span>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="p-4 text-center text-gray-400 text-sm">
                        No clients found.
                      </p>
                    )}
                  </div>
                )}

                {selectedClient && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs text-green-600 font-bold uppercase">
                        Ready to deploy to:
                      </p>
                      <p className="font-bold text-green-900">
                        {selectedClient.first_name} {selectedClient.surname} (
                        {selectedClient.business_name})
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedClient(null)}
                      className="text-xs text-green-700 underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  disabled={!selectedClient || deploying}
                  onClick={handleDeploy}
                  className="w-full bg-[#9d4edd] text-white py-3 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] disabled:opacity-50 transition-all"
                >
                  {deploying ? "Creating..." : "Create Draft Agreement"}
                </button>
              </div>
            </div>
          )}

          {agreement && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                    Draft Agreement
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
                    className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all"
                  >
                    Save as Draft
                  </button>
                </div>
              </div>

              <AgreementEditor agreement={agreement} onChange={setAgreement} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
