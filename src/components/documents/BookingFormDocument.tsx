"use client";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { Allura, Dancing_Script, Sacramento } from "next/font/google";
import type {
  BookingExtraField,
  BookingFormContent,
  BookingServiceItem,
} from "@/lib/bookingFormContent";

const scriptFont = Dancing_Script({ subsets: ["latin"] });
const flowFont = Allura({ subsets: ["latin"], weight: "400" });
const classicFont = Sacramento({ subsets: ["latin"], weight: "400" });

const signatureFontMap: Record<
  BookingFormContent["client_signature_style"],
  string
> = {
  script: scriptFont.className,
  flow: flowFont.className,
  classic: classicFont.className,
};

const normalizeImageUrl = (url: string) => {
  const trimmed = url.trim();
  const match = trimmed.match(/unsplash\.com\/photos\/[^/]*-([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://images.unsplash.com/photo-${match[1]}?auto=format&fit=crop&q=80&w=1600`;
  }
  if (trimmed.includes("source.unsplash.com/")) {
    const idMatch = trimmed.match(/source\.unsplash\.com\/([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return `https://images.unsplash.com/photo-${idMatch[1]}?auto=format&fit=crop&q=80&w=1600`;
    }
  }
  return trimmed;
};

const FieldRow = ({
  label,
  value,
  readOnly,
  multiline,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  readOnly: boolean;
  multiline?: boolean;
  onChange?: (value: string) => void;
  type?: string;
}) => (
  <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
    <div className="text-xs font-bold text-gray-500">{label}</div>
    <div>
      {multiline ? (
        <textarea
          className={`w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none min-h-20 ${
            readOnly
              ? "bg-gray-50 border-gray-100 text-gray-500"
              : "bg-white border-gray-200 focus:border-purple-100"
          }`}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
        />
      ) : (
        <input
          type={type}
          className={`w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none ${
            readOnly
              ? "bg-gray-50 border-gray-100 text-gray-500"
              : "bg-white border-gray-200 focus:border-purple-100"
          }`}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
        />
      )}
    </div>
  </div>
);

type BookingFormDocumentProps = {
  content: BookingFormContent;
  mode: "va" | "client" | "preview";
  onUpdate?: (updates: Partial<BookingFormContent>) => void;
  clientAgreed?: boolean;
  onClientAgreeChange?: (checked: boolean) => void;
};

export default function BookingFormDocument({
  content,
  mode,
  onUpdate,
  clientAgreed = false,
  onClientAgreeChange,
}: BookingFormDocumentProps) {
  const heroUrl = content.hero_image_url
    ? normalizeImageUrl(content.hero_image_url)
    : "";
  const isClient = mode === "client";
  const isPreview = mode === "preview";
  const isVa = mode === "va";
  const readOnlyAll = isPreview;
  const readOnlyClientSection = isPreview;
  const readOnlyVaSection = isPreview ? true : isClient ? true : false;
  const readOnlyNonClientSections = isPreview ? true : isClient ? true : false;
  const signatureLocked = isClient && !clientAgreed;

  const updateField = (
    field: keyof BookingFormContent,
    value: BookingFormContent[keyof BookingFormContent],
  ) => {
    onUpdate?.({ [field]: value } as Partial<BookingFormContent>);
  };

  const updateServices = (services: BookingServiceItem[]) => {
    onUpdate?.({ services });
  };

  const getHiddenFields = (
    section: "section1" | "section2" | "section3" | "section4" | "section5",
  ) =>
    (content[
      `${section}_hidden_fields` as keyof BookingFormContent
    ] as string[]) || [];

  const isFieldHidden = (
    section: "section1" | "section2" | "section3" | "section4" | "section5",
    fieldId: string,
  ) => getHiddenFields(section).includes(fieldId);

  const getExtraFields = (
    section: "section1" | "section2" | "section3" | "section4" | "section5",
  ) =>
    (content[
      `${section}_extra_fields` as keyof BookingFormContent
    ] as BookingExtraField[]) || [];

  const getVisibleExtraFields = (
    section: "section1" | "section2" | "section3" | "section4" | "section5",
  ) =>
    getExtraFields(section).filter(
      (field) => field.title.trim() || field.value.trim(),
    );

  return (
    <div className="bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">
      <div className="relative h-40 md:h-56 w-full">
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt="Booking form header"
            fill
            className="object-cover"
            unoptimized={heroUrl.startsWith("data:")}
          />
        ) : (
          <div className="h-full w-full bg-linear-to-r from-slate-900 via-slate-800 to-slate-700" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 text-white">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-center text-whi">
            {content.hero_title}
          </h1>
          <div className="mt-4 text-xs md:text-sm space-y-1 text-left max-w-md text-white/90">
            <p>
              <span className="font-semibold">Prepared for:</span>{" "}
              {content.prepared_for}
            </p>
            <p>
              <span className="font-semibold">Prepared by:</span>{" "}
              {content.prepared_by}
            </p>
            <p>
              <span className="font-semibold">Date:</span>{" "}
              {content.prepared_date}
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12 space-y-10">
        <section className="bg-gray-50 p-6 md:p-8 rounded-3xl border border-gray-100 text-gray-700 whitespace-pre-wrap leading-relaxed">
          {content.warm_welcome_text}
        </section>

        <div className="border-t border-dashed border-gray-200" />

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            About you and your business
          </h2>
          <div className="space-y-3">
            {!isFieldHidden("section1", "client_business_name") && (
              <FieldRow
                label="Client business name:"
                value={content.client_business_name}
                readOnly={readOnlyAll || readOnlyClientSection}
                onChange={(value) => updateField("client_business_name", value)}
              />
            )}
            {!isFieldHidden("section1", "client_contact_name") && (
              <FieldRow
                label="Client contact name:"
                value={content.client_contact_name}
                readOnly={readOnlyAll || readOnlyClientSection}
                onChange={(value) => updateField("client_contact_name", value)}
              />
            )}
            {!isFieldHidden("section1", "client_job_title") && (
              <FieldRow
                label="Job title:"
                value={content.client_job_title}
                readOnly={readOnlyAll || readOnlyClientSection}
                onChange={(value) => updateField("client_job_title", value)}
              />
            )}
            {!isFieldHidden("section1", "client_postal_address") && (
              <FieldRow
                label="Client postal address:"
                value={content.client_postal_address}
                readOnly={readOnlyAll || readOnlyClientSection}
                multiline
                onChange={(value) =>
                  updateField("client_postal_address", value)
                }
              />
            )}
            {!isFieldHidden("section1", "client_email") && (
              <FieldRow
                label="Client email address:"
                value={content.client_email}
                readOnly={readOnlyAll || readOnlyClientSection}
                onChange={(value) => updateField("client_email", value)}
              />
            )}
            {!isFieldHidden("section1", "client_phone") && (
              <FieldRow
                label="Client phone number:"
                value={content.client_phone}
                readOnly={readOnlyAll || readOnlyClientSection}
                onChange={(value) => updateField("client_phone", value)}
              />
            )}
            {getVisibleExtraFields("section1").map((field) => (
              <div
                key={field.id}
                className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start"
              >
                <div className="text-xs font-bold text-gray-500">
                  {field.title || "Additional detail"}
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            About us
          </h2>
          <div className="space-y-3">
            {!isFieldHidden("section2", "va_business_name") && (
              <FieldRow
                label="Our business name:"
                value={content.va_business_name}
                readOnly={readOnlyAll || readOnlyVaSection}
                onChange={(value) => updateField("va_business_name", value)}
              />
            )}
            {!isFieldHidden("section2", "va_contact_name") && (
              <FieldRow
                label="Our contact name:"
                value={content.va_contact_name}
                readOnly={readOnlyAll || readOnlyVaSection}
                onChange={(value) => updateField("va_contact_name", value)}
              />
            )}
            {!isFieldHidden("section2", "va_job_title") && (
              <FieldRow
                label="Job title:"
                value={content.va_job_title}
                readOnly={readOnlyAll || readOnlyVaSection}
                onChange={(value) => updateField("va_job_title", value)}
              />
            )}
            {!isFieldHidden("section2", "va_contact_details") && (
              <FieldRow
                label="Our contact details:"
                value={content.va_contact_details}
                readOnly={readOnlyAll || readOnlyVaSection}
                multiline
                onChange={(value) => updateField("va_contact_details", value)}
              />
            )}
            {getVisibleExtraFields("section2").map((field) => (
              <div
                key={field.id}
                className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start"
              >
                <div className="text-xs font-bold text-gray-500">
                  {field.title || "Additional detail"}
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            About the work
          </h2>
          {!isFieldHidden("section3", "services") && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Description of services and outcomes
              </p>
              <div className="space-y-4">
                {content.services.map((service, index) => (
                  <div
                    key={service.id}
                    className="rounded-3xl border border-gray-100 bg-gray-50 p-4 space-y-3 relative"
                  >
                    {isVa && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...content.services];
                          updated.splice(index, 1);
                          updateServices(updated);
                        }}
                        className="absolute top-4 right-4 text-[#9d4edd] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <input
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-sm font-semibold outline-none ${
                        readOnlyNonClientSections
                          ? "bg-gray-50 border-gray-100 text-gray-500"
                          : "bg-white border-gray-200 focus:border-purple-100"
                      }`}
                      value={service.title}
                      onChange={(e) => {
                        const updated = [...content.services];
                        updated[index] = {
                          ...updated[index],
                          title: e.target.value,
                        };
                        updateServices(updated);
                      }}
                      readOnly={readOnlyNonClientSections}
                    />
                    <textarea
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none min-h-20 ${
                        readOnlyNonClientSections
                          ? "bg-gray-50 border-gray-100 text-gray-500"
                          : "bg-white border-gray-200 focus:border-purple-100"
                      }`}
                      value={service.details}
                      onChange={(e) => {
                        const updated = [...content.services];
                        updated[index] = {
                          ...updated[index],
                          details: e.target.value,
                        };
                        updateServices(updated);
                      }}
                      readOnly={readOnlyNonClientSections}
                    />
                  </div>
                ))}
                {isVa && (
                  <button
                    type="button"
                    onClick={() =>
                      updateServices([
                        ...content.services,
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
                    Add service item
                  </button>
                )}
              </div>
            </div>
          )}

          {!isFieldHidden("section3", "personal_data_processing") && (
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                Personal data processing required?
              </div>
              {readOnlyAll || readOnlyNonClientSections ? (
                <div className="text-sm text-gray-500 py-3">
                  {content.personal_data_processing === "yes" ? "Yes" : "No"}
                </div>
              ) : (
                <select
                  className="w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none bg-white border-gray-200 focus:border-purple-100"
                  value={content.personal_data_processing}
                  onChange={(e) =>
                    updateField(
                      "personal_data_processing",
                      e.target.value === "yes" ? "yes" : "no",
                    )
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              )}
            </div>
          )}
          {!isFieldHidden("section3", "timeline_key_dates") && (
            <FieldRow
              label="Timeline/key dates:"
              value={content.timeline_key_dates}
              readOnly={readOnlyAll || readOnlyNonClientSections}
              multiline
              onChange={(value) => updateField("timeline_key_dates", value)}
            />
          )}
          {!isFieldHidden("section3", "working_hours") && (
            <FieldRow
              label="Usual working hours:"
              value={content.working_hours}
              readOnly={readOnlyAll || readOnlyNonClientSections}
              multiline
              onChange={(value) => updateField("working_hours", value)}
            />
          )}
          {!isFieldHidden("section3", "communication_channels") && (
            <FieldRow
              label="Communication channels:"
              value={content.communication_channels}
              readOnly={readOnlyAll || readOnlyNonClientSections}
              multiline
              onChange={(value) => updateField("communication_channels", value)}
            />
          )}
          {getVisibleExtraFields("section3").map((field) => (
            <div
              key={field.id}
              className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start"
            >
              <div className="text-xs font-bold text-gray-500">
                {field.title || "Additional detail"}
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {field.value}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            About payments
          </h2>
          <div className="space-y-3">
            {!isFieldHidden("section4", "fee") && (
              <FieldRow
                label="Fee:"
                value={content.fee}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) => updateField("fee", value)}
              />
            )}
            {!isFieldHidden("section4", "payment_terms") && (
              <FieldRow
                label="Payment terms and preferred method:"
                value={content.payment_terms}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                multiline
                onChange={(value) => updateField("payment_terms", value)}
              />
            )}
            {!isFieldHidden("section4", "prepayment_expiration") && (
              <FieldRow
                label="Expiration date of prepayments or unused retainer time:"
                value={content.prepayment_expiration}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) =>
                  updateField("prepayment_expiration", value)
                }
              />
            )}
            {!isFieldHidden("section4", "additional_hourly_rate") && (
              <FieldRow
                label="Basic hourly rate for additional work beyond original booking:"
                value={content.additional_hourly_rate}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) =>
                  updateField("additional_hourly_rate", value)
                }
              />
            )}
            {!isFieldHidden("section4", "out_of_hours_rate") && (
              <FieldRow
                label="Out of hours rate for work outside normal hours:"
                value={content.out_of_hours_rate}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) => updateField("out_of_hours_rate", value)}
              />
            )}
            {!isFieldHidden("section4", "urgent_work_rate") && (
              <FieldRow
                label="Urgent work rate (less than 24 hours notice):"
                value={content.urgent_work_rate}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) => updateField("urgent_work_rate", value)}
              />
            )}
            {!isFieldHidden("section4", "additional_payment_charges") && (
              <FieldRow
                label="Additional charges for payments made by other methods:"
                value={content.additional_payment_charges}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) =>
                  updateField("additional_payment_charges", value)
                }
              />
            )}
            {!isFieldHidden("section4", "late_payment_interest") && (
              <FieldRow
                label="Late payment interest rate:"
                value={content.late_payment_interest}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) =>
                  updateField("late_payment_interest", value)
                }
              />
            )}
            {!isFieldHidden("section4", "purchase_order_number") && (
              <FieldRow
                label="Purchase order (PO number):"
                value={content.purchase_order_number}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) =>
                  updateField("purchase_order_number", value)
                }
              />
            )}
            {getVisibleExtraFields("section4").map((field) => (
              <div
                key={field.id}
                className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start"
              >
                <div className="text-xs font-bold text-gray-500">
                  {field.title || "Additional detail"}
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Final important subjects
          </h2>
          <div className="space-y-3">
            {!isFieldHidden("section5", "data_privacy_link") && (
              <FieldRow
                label="Our data privacy policy link:"
                value={content.data_privacy_link}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) => updateField("data_privacy_link", value)}
              />
            )}
            {!isFieldHidden("section5", "insurance_cover") && (
              <FieldRow
                label="Insurance level of cover:"
                value={content.insurance_cover}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) => updateField("insurance_cover", value)}
              />
            )}
            {!isFieldHidden("section5", "notice_period") && (
              <FieldRow
                label="Notice period:"
                value={content.notice_period}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                onChange={(value) => updateField("notice_period", value)}
              />
            )}
            {!isFieldHidden("section5", "special_terms") && (
              <FieldRow
                label="Special terms for this booking:"
                value={content.special_terms}
                readOnly={readOnlyAll || readOnlyNonClientSections}
                multiline
                onChange={(value) => updateField("special_terms", value)}
              />
            )}
          </div>

          {!isFieldHidden("section5", "custom_terms_url") && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Our main terms can be found at this link:
              </p>
              {isVa ? (
                <FieldRow
                  label="Our main terms link:"
                  value={content.custom_terms_url}
                  readOnly={readOnlyAll || readOnlyNonClientSections}
                  onChange={(value) => updateField("custom_terms_url", value)}
                />
              ) : (
                <div className="text-xs text-gray-500">
                  {content.custom_terms_url?.trim() ? (
                    <a
                      href={content.custom_terms_url}
                      className="text-[#9d4edd] font-bold underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {content.custom_terms_url}
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">
                      No terms link provided.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!isFieldHidden("section5", "courts_jurisdiction") && (
            <FieldRow
              label="Courts that will handle disputes:"
              value={content.courts_jurisdiction}
              readOnly={readOnlyAll || readOnlyNonClientSections}
              onChange={(value) => updateField("courts_jurisdiction", value)}
            />
          )}
          {!isFieldHidden("section5", "accept_by_date") && (
            <FieldRow
              label="Please accept this booking by:"
              value={content.accept_by_date}
              readOnly={readOnlyAll || readOnlyNonClientSections}
              onChange={(value) => updateField("accept_by_date", value)}
              type={readOnlyAll || readOnlyNonClientSections ? "text" : "date"}
            />
          )}
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
          {getVisibleExtraFields("section5").map((field) => (
            <div
              key={field.id}
              className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start"
            >
              <div className="text-xs font-bold text-gray-500">
                {field.title || "Additional detail"}
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {field.value}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Client
          </h2>
          <div className="space-y-3">
            {isClient && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={clientAgreed}
                    onChange={(e) => onClientAgreeChange?.(e.target.checked)}
                  />
                  I have read and agree to the terms & conditions.
                </label>
                <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
                  <div className="text-xs font-bold text-gray-500">
                    Signature style:
                  </div>
                  <select
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none ${
                      signatureLocked
                        ? "bg-gray-50 border-gray-100 text-gray-500"
                        : "bg-white border-gray-200 focus:border-purple-100"
                    }`}
                    value={content.client_signature_style}
                    onChange={(e) =>
                      updateField(
                        "client_signature_style",
                        e.target
                          .value as BookingFormContent["client_signature_style"],
                      )
                    }
                    disabled={signatureLocked}
                  >
                    <option value="script">Signature Script</option>
                    <option value="flow">Signature Flow</option>
                    <option value="classic">Signature Classic</option>
                  </select>
                </div>
              </>
            )}
            <div className="grid gap-3 md:grid-cols-[0.45fr_0.55fr] items-start">
              <div className="text-xs font-bold text-gray-500">
                Your signature:
              </div>
              <input
                className={`w-full rounded-2xl border-2 px-4 py-3 text-2xl outline-none ${
                  readOnlyAll || signatureLocked
                    ? "bg-gray-50 border-gray-100 text-gray-500"
                    : "bg-white border-gray-200 focus:border-purple-100"
                } ${signatureFontMap[content.client_signature_style]}`}
                value={content.client_signature_name}
                onChange={(e) =>
                  updateField("client_signature_name", e.target.value)
                }
                readOnly={readOnlyAll || signatureLocked}
              />
            </div>
            <FieldRow
              label="Print name:"
              value={content.client_print_name}
              readOnly={readOnlyAll || signatureLocked}
              onChange={(value) => updateField("client_print_name", value)}
            />
            <FieldRow
              label="Your business name:"
              value={content.client_business_name_signature}
              readOnly={readOnlyAll || signatureLocked}
              onChange={(value) =>
                updateField("client_business_name_signature", value)
              }
            />
            <FieldRow
              label="Date and time:"
              value={
                content.client_signed_at || new Date().toLocaleString("en-GB")
              }
              readOnly
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Us
          </h2>
          <div className="space-y-3">
            <FieldRow
              label="Our signature:"
              value={content.va_signature_name}
              readOnly={readOnlyAll || readOnlyVaSection}
              onChange={(value) => updateField("va_signature_name", value)}
            />
            <FieldRow
              label="Print name:"
              value={content.va_print_name}
              readOnly={readOnlyAll || readOnlyVaSection}
              onChange={(value) => updateField("va_print_name", value)}
            />
            <FieldRow
              label="Our business name:"
              value={content.va_business_name_signature}
              readOnly={readOnlyAll || readOnlyVaSection}
              onChange={(value) =>
                updateField("va_business_name_signature", value)
              }
            />
            <FieldRow
              label="Role:"
              value={content.va_role}
              readOnly={readOnlyAll || readOnlyVaSection}
              onChange={(value) => updateField("va_role", value)}
            />
            <FieldRow
              label="Date:"
              value={content.va_signed_at}
              readOnly={readOnlyAll || readOnlyVaSection}
              onChange={(value) => updateField("va_signed_at", value)}
              type="date"
            />
          </div>
        </section>

        {isVa && (
          <p className="text-xs text-gray-400">
            Client signatures become active once this booking form is issued.
          </p>
        )}
      </div>
    </div>
  );
}
