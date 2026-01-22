"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Template = {
  id: string;
  title: string;
  va_playbook_content: string;
  category: string;
};

export default function PlaybookViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplate() {
      const { data } = await supabase
        .from("sop_templates")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setTemplate(data);
      setLoading(false);
    }
    loadTemplate();
  }, [id]);

  if (loading)
    return <div className="p-10 text-black">Loading Playbook...</div>;
  if (!template)
    return <div className="p-10 text-black">Template not found.</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20 text-black">
      {/* Top Navigation / Action Bar */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <span className="text-xs font-bold text-[#9d4edd] uppercase tracking-widest">
            {template.category}
          </span>
          <h1 className="text-2xl font-bold">{template.title} Playbook</h1>
        </div>
        <button
          onClick={() =>
            router.push(`/va/dashboard/workflows/deploy/${template.id}`)
          }
          className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#7b2cbf] transition-all"
        >
          Generate Service Agreement
        </button>
      </div>

      {/* The Educational Content (Playbook) */}
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-100 prose prose-purple max-w-none">
        <div className="whitespace-pre-wrap leading-relaxed text-gray-700">
          {template.va_playbook_content}
        </div>
      </div>

      {/* Footer Encouragement */}
      <div className="mt-8 p-6 bg-purple-50 rounded-xl border border-purple-100 text-center">
        <p className="text-purple-900 font-medium">
          Ready to start this service for a client?
        </p>
        <p className="text-sm text-purple-700 mb-4">
          The Service Agreement will let them authorize specific actions and
          provide technical details.
        </p>
        <button
          onClick={() =>
            router.push(`/va/dashboard/workflows/deploy/${template.id}`)
          }
          className="text-[#9d4edd] font-bold hover:underline"
        >
          Setup Client Agreement →
        </button>
      </div>
    </div>
  );
}
