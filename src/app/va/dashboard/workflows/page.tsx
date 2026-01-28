"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { FileText, Search, X } from "lucide-react";

type SOPTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
};

export default function SOPLibraryPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SOPTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<SOPTemplate | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const { data, error } = await supabase.from("sop_templates").select("*");

      if (error) {
        console.error("Error loading templates:", error.message);
      } else if (data) {
        setTemplates(data);
      }

      setLoading(false);
    }
    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const value = search.toLowerCase();
    return templates.filter(
      (template) =>
        template.title.toLowerCase().includes(value) ||
        template.description.toLowerCase().includes(value) ||
        template.category.toLowerCase().includes(value)
    );
  }, [search, templates]);

  return (
    <div className="text-black">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Client Workflow Library</h1>
          <p className="text-gray-500 max-w-2xl">
            Deploy polished Client Workflow Agreements in minutes. Templates
            help set clear scope, authority, and delivery standards for each
            client.
          </p>
        </div>
        <div className="w-full max-w-md">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            Search Templates
          </label>
          <div className="flex items-center gap-2 bg-white border border-[#333333] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#9d4edd]/20">
            <Search className="h-4 w-4 text-[#9d4edd]" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workflows"
              className="w-full bg-transparent text-sm text-gray-700 outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading blueprints...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="group text-left bg-white border border-gray-100 rounded-2xl p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-[#9d4edd]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-[#333333]">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-black text-[#333333] uppercase tracking-widest">
                  {template.category}
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#333333] group-hover:text-[#9d4edd] transition-colors uppercase tracking-tight">
                {template.title}
              </h3>
            </button>
          ))}
          <div className="text-left bg-white border border-dashed border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-[#333333]">
                <FileText className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-black text-[#333333] uppercase tracking-widest">
                Placeholder
              </span>
            </div>
            <h3 className="font-bold text-sm text-[#333333] uppercase tracking-tight">
              Request a Workflow
            </h3>
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-[#333333] uppercase tracking-widest">
                  {selectedTemplate.category}
                </span>
                <h1 className="text-2xl font-bold text-[#333333]">
                  {selectedTemplate.title}
                </h1>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="h-9 w-9 rounded-full border border-gray-200 text-gray-400 hover:text-black hover:border-gray-300 transition"
                aria-label="Close"
              >
                <X className="h-4 w-4 mx-auto" />
              </button>
            </div>

            <div className="p-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold mb-4 uppercase text-[#333333] tracking-tight">
                  Workflow Summary
                </h2>
                <p className="text-gray-700 leading-relaxed mb-6">
                  This workflow template defines scope, response standards, and
                  delivery responsibilities for the selected client. Customize
                  the clauses during deployment to match each engagement.
                </p>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    • Core responsibilities and service boundaries
                  </li>
                  <li className="flex items-center gap-2">
                    • Response times and escalation rules
                  </li>
                  <li className="flex items-center gap-2">
                    • Reporting cadence and communication channels
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-[#333333] font-medium">
                    What you will set up
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Configure the workflow details, assign the client, and
                    deploy the final version to their portal.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-black"
                  >
                    Back
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/va/dashboard/workflows/deploy/${selectedTemplate.id}`
                      )
                    }
                    className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-[#7b2cbf] transition-all"
                  >
                    Deploy / Set Up for Client
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
