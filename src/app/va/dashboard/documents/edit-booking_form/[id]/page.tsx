"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";
import BookingFormDocument from "@/components/documents/BookingFormDocument";
import {
  mergeBookingContent,
  type BookingFormContent,
} from "@/lib/bookingFormContent";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
  issued_at: string | null;
  content: Partial<BookingFormContent>;
};

type FetchedDoc = ClientDoc & {
  clients: {
    first_name: string;
    surname: string;
    business_name: string | null;
  };
};

export default function EditBookingFormPage({
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
        .select("*, clients(first_name, surname, business_name)")
        .eq("id", id)
        .single();

      if (data) {
        const fetched = data as FetchedDoc;
        let preparedBy = "VA/Business Name";
        let signatureName = "";
        let businessName = "";
        let contactEmail = "";
        let contactPhone = "";

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
            .select("company_name, email, phone")
            .eq("va_id", user.id)
            .maybeSingle();

          preparedBy =
            business?.company_name ||
            profile?.display_name ||
            profile?.full_name ||
            preparedBy;
          signatureName = profile?.display_name || profile?.full_name || "";
          businessName = business?.company_name || "";
          contactEmail = business?.email || user.email || "";
          contactPhone = business?.phone || "";
        }

        const merged = mergeBookingContent(fetched.content, {
          preparedBy,
          signatureName,
          businessName,
          contactEmail,
          contactPhone,
        });

        merged.prepared_for =
          fetched.clients.business_name ||
          `${fetched.clients.first_name} ${fetched.clients.surname}`;
        merged.client_print_name =
          merged.client_print_name ||
          `${fetched.clients.first_name} ${fetched.clients.surname}`;
        merged.client_business_name =
          merged.client_business_name ||
          fetched.clients.business_name ||
          "";
        merged.client_business_name_signature =
          merged.client_business_name_signature || merged.client_business_name;

        fetched.content = merged;
        setDoc(fetched);
        lastSavedRef.current = JSON.stringify({
          content: merged,
          status: fetched.status,
        });
      }

      setLoading(false);
    }
    loadDoc();
  }, [id]);

  const updateContent = (updates: Partial<BookingFormContent>) => {
    if (!doc) return;
    setDoc({ ...doc, content: { ...doc.content, ...updates } });
  };

  const handleHeroUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateContent({ hero_image_url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const persistDoc = useCallback(
    async (options?: { issue?: boolean; silent?: boolean }) => {
      if (!doc) return;
      const shouldIssue = Boolean(options?.issue);
      const silent = Boolean(options?.silent);

      if (shouldIssue && !doc.content.use_standard_terms) {
        if (!(doc.content.custom_terms_url || "").trim()) {
          alert("Please provide a custom terms link or enable standard terms.");
          return;
        }
      }

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
          content: doc.content,
          status: shouldIssue ? "issued" : doc.status,
        });
        if (!silent) {
          alert(shouldIssue ? "Booking form issued!" : "Draft saved.");
          if (shouldIssue) router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
        }
      }
    },
    [doc, id, router]
  );

  useEffect(() => {
    if (!doc || loading || saving) return;
    const snapshot = JSON.stringify({
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
      <div className="p-10 text-center text-gray-400 italic">
        Loading Booking Form...
      </div>
    );
  if (!doc)
    return (
      <div className="p-10 text-center text-red-500 font-bold">
        Document not found.
      </div>
    );

  return (
    <div className="p-6 max-w-5xl mx-auto text-black pb-40 font-sans">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10 pb-6 border-b border-gray-100">
        <div>
          <Link
            href={`/va/dashboard/crm/profile/${doc.client_id}`}
            className="text-xs font-bold text-gray-400 hover:text-[#333333]"
          >
            Back to Client Profile
          </Link>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Booking Form Builder
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
            Issue for Signature
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Hero Section
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <input
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                placeholder="Hero image URL (optional)"
                value={doc.content.hero_image_url || ""}
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
            <input
              className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="Title"
              value={doc.content.hero_title || ""}
              onChange={(e) => updateContent({ hero_title: e.target.value })}
            />
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="Prepared for"
              value={doc.content.prepared_for || ""}
              onChange={(e) => updateContent({ prepared_for: e.target.value })}
            />
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="Prepared by"
              value={doc.content.prepared_by || ""}
              onChange={(e) => updateContent({ prepared_by: e.target.value })}
            />
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="Date"
              value={doc.content.prepared_date || ""}
              onChange={(e) => updateContent({ prepared_date: e.target.value })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
            Warm Welcome
          </label>
          <textarea
            className="w-full p-6 bg-white border-2 border-gray-50 rounded-4xl outline-none focus:border-purple-100 min-h-25 leading-relaxed shadow-sm text-sm"
            value={doc.content.warm_welcome_text || ""}
            onChange={(e) =>
              updateContent({ warm_welcome_text: e.target.value })
            }
          />
        </section>

        <BookingFormDocument
          content={doc.content as BookingFormContent}
          mode="va"
          standardTerms={
            DOCUMENT_TEMPLATES.booking_form.sections.legal_text ||
            "Terms not available."
          }
          onUpdate={updateContent}
        />
      </div>
    </div>
  );
}
