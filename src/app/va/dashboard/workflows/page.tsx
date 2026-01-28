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

const WORKFLOW_OVERVIEWS: Record<
  string,
  { summary: string; bullets: string[] }
> = {
  "Inbox Management": {
    summary:
      "A structured process for managing client inboxes efficiently and consistently. Designed to ensure messages are handled promptly, prioritised correctly, and responded to in line with agreed expectations.",
    bullets: [
      "Clear steps for triaging and responding to messages",
      "Helps maintain consistent communication standards",
      "Reduces missed or delayed client correspondence",
    ],
  },
  "Diary & Calendar Management": {
    summary:
      "A clear, repeatable process for managing client calendars, appointments, and scheduling requests. Designed to keep diaries organised and prevent clashes or missed commitments.",
    bullets: [
      "Guides appointment booking and updates",
      "Supports proactive calendar organisation",
      "Helps maintain control over busy schedules",
    ],
  },
  "Social Media Scheduling": {
    summary:
      "A defined workflow for preparing, scheduling, and managing social media content on behalf of clients. Designed to ensure posts are published accurately and on time.",
    bullets: [
      "Outlines steps from content preparation to scheduling",
      "Helps maintain posting consistency",
      "Reduces last-minute or ad-hoc publishing",
    ],
  },
  "Invoice & Payment Administration": {
    summary:
      "A step-by-step process for issuing invoices, tracking payments, and following up where needed. Designed to keep client finances organised and reduce payment delays.",
    bullets: [
      "Supports consistent invoicing practices",
      "Helps track outstanding and completed payments",
      "Reduces admin time around billing",
    ],
  },
  "Documentation Creation": {
    summary:
      "A structured approach to creating, reviewing, and issuing client documents. Designed to ensure documents are accurate, consistent, and professionally presented.",
    bullets: [
      "Guides document preparation and checks",
      "Supports consistent formatting and standards",
      "Keeps client paperwork organised",
    ],
  },
  "Website Build & Maintenance": {
    summary:
      "A repeatable process for managing website updates, builds, and ongoing maintenance tasks. Designed to ensure changes are completed methodically and without disruption.",
    bullets: [
      "Outlines steps for updates and checks",
      "Helps track ongoing website tasks",
      "Reduces risk of missed actions or errors",
    ],
  },
  "Content Publishing": {
    summary:
      "A clear workflow for publishing approved content across relevant platforms. Designed to ensure content goes live accurately and in line with agreed schedules.",
    bullets: [
      "Supports consistent publishing routines",
      "Helps manage approvals and timing",
      "Reduces publishing errors or omissions",
    ],
  },
  "Request a Workflow": {
    summary:
      "Create a custom workflow to document a specific process unique to your client or service offering. Designed to capture your way of working and make it easy for others to follow.",
    bullets: [
      "Allows flexibility for bespoke client needs",
      "Helps document undocumented processes",
      "Supports continuity and consistency",
    ],
  },
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
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#9d4edd]">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
              <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#9d4edd] transition-colors uppercase tracking-tight">
                {template.title}
              </h3>
            </button>
          ))}
          <div className="text-left bg-white border border-dashed border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#9d4edd]">
                <FileText className="h-6 w-6" />
              </div>
            </div>
            <h3 className="font-bold text-sm text-gray-900 uppercase tracking-tight">
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
                  Workflow Overview
                </h2>
                <p className="text-gray-700 leading-relaxed mb-6">
                  {WORKFLOW_OVERVIEWS[selectedTemplate.title]?.summary ||
                    "This workflow template defines scope, response standards, and delivery responsibilities for the selected client. Customize the clauses during deployment to match each engagement."}
                </p>
                <ul className="space-y-3 text-sm text-gray-600">
                  {(WORKFLOW_OVERVIEWS[selectedTemplate.title]?.bullets || [
                    "Core responsibilities and service boundaries",
                    "Response times and escalation rules",
                    "Reporting cadence and communication channels",
                  ]).map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      • {item}
                    </li>
                  ))}
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
