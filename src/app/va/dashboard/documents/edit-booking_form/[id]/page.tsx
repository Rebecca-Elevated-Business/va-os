"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus, Trash2 } from "lucide-react";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";
import {
  mergeBookingContent,
  type BookingServiceItem,
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

const FieldRow = ({
  label,
  value,
  onChange,
  multiline,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) => (
  <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
    <div className="text-xs font-bold text-gray-500">{label}</div>
    <div>
      {multiline ? (
        <textarea
          className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none min-h-20 bg-white border-gray-200 focus:border-purple-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  </div>
);

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

  const updateServices = (services: BookingServiceItem[]) => {
    updateContent({ services });
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

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            1. About you and your business
          </h2>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                1. Client business name:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_business_name || ""}
                onChange={(e) =>
                  updateContent({ client_business_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                2. Client contact name:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_contact_name || ""}
                onChange={(e) =>
                  updateContent({ client_contact_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                3. Job title:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_job_title || ""}
                onChange={(e) =>
                  updateContent({ client_job_title: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                4. Client postal address:
              </div>
              <textarea
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none min-h-20 bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_postal_address || ""}
                onChange={(e) =>
                  updateContent({ client_postal_address: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                5. Client email address:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_email || ""}
                onChange={(e) =>
                  updateContent({ client_email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                6. Client phone number:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_phone || ""}
                onChange={(e) =>
                  updateContent({ client_phone: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            2. About us
          </h2>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                7. Our business name:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.va_business_name || ""}
                onChange={(e) =>
                  updateContent({ va_business_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                8. VA contact name:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.va_contact_name || ""}
                onChange={(e) =>
                  updateContent({ va_contact_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                9. Job title:
              </div>
              <input
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.va_job_title || ""}
                onChange={(e) =>
                  updateContent({ va_job_title: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                10. Our contact details:
              </div>
              <textarea
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none min-h-20 bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.va_contact_details || ""}
                onChange={(e) =>
                  updateContent({ va_contact_details: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            3. About the work
          </h2>
          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              11. Description of services and outcomes
            </p>
            <div className="space-y-4">
              {(doc.content.services || []).map((service, index) => (
                <div
                  key={service.id}
                  className="rounded-3xl border border-gray-100 bg-gray-50 p-4 space-y-3 relative"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(doc.content.services || [])];
                      updated.splice(index, 1);
                      updateServices(updated);
                    }}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <input
                    className="w-full rounded-2xl border-2 px-4 py-3 text-sm font-semibold outline-none bg-white border-gray-200 focus:border-purple-100"
                    value={service.title}
                    onChange={(e) => {
                      const updated = [...(doc.content.services || [])];
                      updated[index] = {
                        ...updated[index],
                        title: e.target.value,
                      };
                      updateServices(updated);
                    }}
                  />
                  <textarea
                    className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none min-h-20 bg-white border-gray-200 focus:border-purple-100"
                    value={service.details}
                    onChange={(e) => {
                      const updated = [...(doc.content.services || [])];
                      updated[index] = {
                        ...updated[index],
                        details: e.target.value,
                      };
                      updateServices(updated);
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateServices([
                    ...(doc.content.services || []),
                    {
                      id: `service-${Date.now()}`,
                      title: "",
                      details: "",
                    },
                  ])
                }
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-black text-gray-400 hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Service Item
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
            <div className="text-xs font-bold text-gray-500">
              12. Personal data processing required?
            </div>
            <select
              className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
              value={doc.content.personal_data_processing || "no"}
              onChange={(e) =>
                updateContent({
                  personal_data_processing: e.target.value === "yes" ? "yes" : "no",
                })
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <FieldRow
            label="13. Timeline/key dates:"
            value={doc.content.timeline_key_dates || ""}
            multiline
            onChange={(value) => updateContent({ timeline_key_dates: value })}
          />
          <FieldRow
            label="14. Usual working hours:"
            value={doc.content.working_hours || ""}
            multiline
            onChange={(value) => updateContent({ working_hours: value })}
          />
          <FieldRow
            label="15. Communication channels:"
            value={doc.content.communication_channels || ""}
            multiline
            onChange={(value) =>
              updateContent({ communication_channels: value })
            }
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            4. About payments
          </h2>
          <div className="space-y-3">
            <FieldRow
              label="16. Fee:"
              value={doc.content.fee || ""}
              onChange={(value) => updateContent({ fee: value })}
            />
            <FieldRow
              label="17. Payment terms and preferred method:"
              value={doc.content.payment_terms || ""}
              multiline
              onChange={(value) => updateContent({ payment_terms: value })}
            />
            <FieldRow
              label="18. Expiration date of prepayments or unused retainer time:"
              value={doc.content.prepayment_expiration || ""}
              onChange={(value) => updateContent({ prepayment_expiration: value })}
            />
            <FieldRow
              label="19. Basic hourly rate for additional work beyond original booking:"
              value={doc.content.additional_hourly_rate || ""}
              onChange={(value) => updateContent({ additional_hourly_rate: value })}
            />
            <FieldRow
              label="20. Out of hours rate for work outside normal hours:"
              value={doc.content.out_of_hours_rate || ""}
              onChange={(value) => updateContent({ out_of_hours_rate: value })}
            />
            <FieldRow
              label="21. Urgent work rate (less than 24 hours notice):"
              value={doc.content.urgent_work_rate || ""}
              onChange={(value) => updateContent({ urgent_work_rate: value })}
            />
            <FieldRow
              label="22. Additional charges for payments made by other methods:"
              value={doc.content.additional_payment_charges || ""}
              onChange={(value) =>
                updateContent({ additional_payment_charges: value })
              }
            />
            <FieldRow
              label="23. Late payment interest rate:"
              value={doc.content.late_payment_interest || ""}
              onChange={(value) => updateContent({ late_payment_interest: value })}
            />
            <FieldRow
              label="24. Purchase order (PO number):"
              value={doc.content.purchase_order_number || ""}
              onChange={(value) =>
                updateContent({ purchase_order_number: value })
              }
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            5. Final important subjects
          </h2>
          <div className="space-y-3">
            <FieldRow
              label="25. Our data privacy policy link:"
              value={doc.content.data_privacy_link || ""}
              onChange={(value) => updateContent({ data_privacy_link: value })}
            />
            <FieldRow
              label="26. Insurance level of cover:"
              value={doc.content.insurance_cover || ""}
              onChange={(value) => updateContent({ insurance_cover: value })}
            />
            <FieldRow
              label="27. Notice period:"
              value={doc.content.notice_period || ""}
              onChange={(value) => updateContent({ notice_period: value })}
            />
            <FieldRow
              label="28. Special terms for this booking:"
              value={doc.content.special_terms || ""}
              multiline
              onChange={(value) => updateContent({ special_terms: value })}
            />
          </div>

          <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              29. Our main terms can be found at this link:
            </p>
            <FieldRow
              label="Our main terms link:"
              value={doc.content.custom_terms_url || ""}
              onChange={(value) => updateContent({ custom_terms_url: value })}
            />
          </div>

          <FieldRow
            label="30. Courts that will handle disputes:"
            value={doc.content.courts_jurisdiction || ""}
            onChange={(value) => updateContent({ courts_jurisdiction: value })}
          />
          <FieldRow
            label="31. Please accept this booking by:"
            value={doc.content.accept_by_date || ""}
            onChange={(value) => updateContent({ accept_by_date: value })}
            type="date"
          />
          <div className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
            If this BOOKING means we will be working on personal data about any
            clients, prospects, suppliers, or other people, please provide us
            with a Data Processing Agreement (DPA) or help us complete a Data
            Processing Form.

            {"\n\n"}Accepting this BOOKING creates a legal agreement made up of
            the terms set out above and our TERMS and (if applicable) the
            completed DPA or Data Processing Form.

            {"\n\n"}Our AGREEMENT begins when you sign and return this BOOKING
            or you tell us to start work, preferably in writing.
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            6. Client
          </h2>
          <div className="space-y-3">
            <FieldRow
              label="Your signature:"
              value={doc.content.client_signature_name || ""}
              onChange={(value) =>
                updateContent({ client_signature_name: value })
              }
            />
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                Signature style:
              </div>
              <select
                className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                value={doc.content.client_signature_style || "script"}
                onChange={(e) =>
                  updateContent({
                    client_signature_style:
                      e.target.value as BookingFormContent["client_signature_style"],
                  })
                }
              >
                <option value="script">Signature Script</option>
                <option value="flow">Signature Flow</option>
                <option value="classic">Signature Classic</option>
              </select>
            </div>
            <FieldRow
              label="Print name:"
              value={doc.content.client_print_name || ""}
              onChange={(value) => updateContent({ client_print_name: value })}
            />
            <FieldRow
              label="Your business name:"
              value={doc.content.client_business_name_signature || ""}
              onChange={(value) =>
                updateContent({ client_business_name_signature: value })
              }
            />
            <FieldRow
              label="Date and time:"
              value={
                doc.content.client_signed_at ||
                new Date().toLocaleString("en-GB")
              }
              onChange={(value) =>
                updateContent({ client_signed_at: value })
              }
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            7. Us
          </h2>
          <div className="space-y-3">
            <FieldRow
              label="Our signature:"
              value={doc.content.va_signature_name || ""}
              onChange={(value) => updateContent({ va_signature_name: value })}
            />
            <FieldRow
              label="Print name:"
              value={doc.content.va_print_name || ""}
              onChange={(value) => updateContent({ va_print_name: value })}
            />
            <FieldRow
              label="Our business name:"
              value={doc.content.va_business_name_signature || ""}
              onChange={(value) =>
                updateContent({ va_business_name_signature: value })
              }
            />
            <FieldRow
              label="Role:"
              value={doc.content.va_role || ""}
              onChange={(value) => updateContent({ va_role: value })}
            />
            <FieldRow
              label="Date:"
              value={doc.content.va_signed_at || ""}
              onChange={(value) => updateContent({ va_signed_at: value })}
              type="date"
            />
          </div>
        </section>

        <p className="text-xs text-gray-400">
          Client signatures become active once this booking form is issued.
        </p>
      </div>
    </div>
  );
}
