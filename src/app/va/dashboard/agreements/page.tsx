"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type SOPTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
};

export default function SOPLibraryPage() {
  const [templates, setTemplates] = useState<SOPTemplate[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="text-black">
      {/* Horizontal Header Info Bar */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h1 className="text-3xl font-bold mb-2">Service Agreement Library</h1>
        <p className="text-gray-500 max-w-3xl">
          Deploy professional, pre-structured{" "}
          <strong>Service Agreements</strong> to your clients. These blueprints
          define your authority and scope of work, ensuring clear communication
          and professional boundaries from day one.
        </p>
      </div>

      {loading ? (
        <p>Loading blueprints...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/va/dashboard/agreements/view/${template.id}`}
              className="group flex flex-col items-center text-center space-y-3"
            >
              {/* PDF Style Icon Card */}
              <div className="w-full aspect-3/4 bg-white rounded-lg border-2 border-gray-100 shadow-sm group-hover:border-[#9d4edd] group-hover:shadow-md transition-all flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Visual "Paper" Accents */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-gray-50 border-l border-b border-gray-100 rounded-bl-lg" />

                {/* Central Icon (Inbox Envelope Placeholder) */}
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  📩
                </div>
                <div className="h-1 w-12 bg-[#9d4edd] rounded-full mb-4" />

                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {template.category}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm group-hover:text-[#9d4edd] transition-colors">
                  {template.title}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">
                  {template.description}
                </p>
              </div>
            </Link>
          ))}

          {/* Placeholder for "Coming Soon" or Custom */}
          <div className="flex flex-col items-center text-center space-y-3 opacity-50">
            <div className="w-full aspect-3/4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
              <span className="text-4xl">➕</span>
            </div>
            <h3 className="font-bold text-sm text-gray-400">
              Custom Blueprint
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}
