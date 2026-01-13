"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
};

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

  // Search/Selection State
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deploying, setDeploying] = useState(false);

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
      // Redirect to the Agreement Editor where the VA can customize the fields
      router.push(`/va/dashboard/agreements/edit/${agreement.id}`);
    } else {
      alert("Error deploying: " + error?.message);
      setDeploying(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.surname.toLowerCase().includes(search.toLowerCase()) ||
      c.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!template) return <div className="p-10">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto text-black">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold mb-2">Deploy Service Agreement</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Select a client to issue the <strong>{template.title}</strong>{" "}
          blueprint to.
        </p>

        {/* Searchable Client Picker */}
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

        <div className="mt-10 pt-6 border-t flex flex-col gap-3">
          <button
            disabled={!selectedClient || deploying}
            onClick={handleDeploy}
            className="w-full bg-[#9d4edd] text-white py-3 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] disabled:opacity-50 transition-all"
          >
            {deploying ? "Deploying..." : "Create Draft Agreement"}
          </button>
          <button
            onClick={() => router.back()}
            className="text-gray-400 text-sm hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-lg text-xs leading-relaxed">
        <strong>VA Note:</strong> Clicking deploy will create a private draft.
        You will be able to review and add/remove specific authorization
        checkboxes before the client sees it in their portal.
      </div>
    </div>
  );
}
