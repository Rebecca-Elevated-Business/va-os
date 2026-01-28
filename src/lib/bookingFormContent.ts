export type BookingServiceItem = {
  id: string;
  title: string;
  details: string;
};

export type BookingExtraField = {
  id: string;
  title: string;
  value: string;
};

export type BookingFormContent = {
  hero_image_url: string;
  hero_title: string;
  prepared_for: string;
  prepared_by: string;
  prepared_date: string;
  warm_welcome_text: string;
  client_business_name: string;
  client_contact_name: string;
  client_job_title: string;
  client_postal_address: string;
  client_email: string;
  client_phone: string;
  va_business_name: string;
  va_contact_name: string;
  va_job_title: string;
  va_contact_details: string;
  services: BookingServiceItem[];
  section1_hidden_fields: string[];
  section1_extra_fields: BookingExtraField[];
  section2_hidden_fields: string[];
  section2_extra_fields: BookingExtraField[];
  section3_hidden_fields: string[];
  section3_extra_fields: BookingExtraField[];
  section4_hidden_fields: string[];
  section4_extra_fields: BookingExtraField[];
  section5_hidden_fields: string[];
  section5_extra_fields: BookingExtraField[];
  personal_data_processing: "yes" | "no";
  timeline_key_dates: string;
  working_hours: string;
  communication_channels: string;
  fee: string;
  payment_terms: string;
  prepayment_expiration: string;
  additional_hourly_rate: string;
  out_of_hours_rate: string;
  urgent_work_rate: string;
  additional_payment_charges: string;
  late_payment_interest: string;
  purchase_order_number: string;
  data_privacy_link: string;
  insurance_cover: string;
  notice_period: string;
  special_terms: string;
  use_standard_terms: boolean;
  custom_terms_url: string;
  courts_jurisdiction: string;
  accept_by_date: string;
  client_signature_name: string;
  client_signature_style: "script" | "flow" | "classic";
  client_print_name: string;
  client_business_name_signature: string;
  client_signed_at: string;
  va_signature_name: string;
  va_print_name: string;
  va_business_name_signature: string;
  va_role: string;
  va_signed_at: string;
};

type BookingDefaultsSeed = {
  preparedBy?: string;
  signatureName?: string;
  businessName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export const createBookingDefaults = (
  seed: BookingDefaultsSeed = {}
): BookingFormContent => ({
  hero_image_url: "",
  hero_title: "Booking Form",
  prepared_for: "Client Name",
  prepared_by: seed.preparedBy || "VA/Business Name",
  prepared_date: formatDate(new Date()),
  warm_welcome_text:
    "Thank you for confirmation you would like to proceed with my VA services. Below you will find my terms and conditions of business. This contract must be agreed to before work can begin. Feel free to contact me if you have any questions.\n\nKind regards,\n\n[VA Name]",
  client_business_name: "",
  client_contact_name: "",
  client_job_title: "",
  client_postal_address: "",
  client_email: "",
  client_phone: "",
  va_business_name: seed.businessName || "",
  va_contact_name: seed.signatureName || "",
  va_job_title: "",
  va_contact_details:
    [seed.contactEmail, seed.contactPhone].filter(Boolean).join("\n") || "",
  services: [
    {
      id: "service-1",
      title: "",
      details: "",
    },
  ],
  section1_hidden_fields: [],
  section1_extra_fields: [],
  section2_hidden_fields: [],
  section2_extra_fields: [],
  section3_hidden_fields: [],
  section3_extra_fields: [],
  section4_hidden_fields: [],
  section4_extra_fields: [],
  section5_hidden_fields: [],
  section5_extra_fields: [],
  personal_data_processing: "no",
  timeline_key_dates:
    "Work to begin on [estimated date] providing booking form is signed and invoice is paid.",
  working_hours:
    "Weekdays (excluding Bank Holidays) generally 9:00 to 17:00. Any days not available will be communicated to you in advance should it impact any work that we have agreed.",
  communication_channels: "Primary communication to be email to [insert email].",
  fee: "",
  payment_terms: "",
  prepayment_expiration: "",
  additional_hourly_rate: "",
  out_of_hours_rate: "",
  urgent_work_rate: "",
  additional_payment_charges: "",
  late_payment_interest: "",
  purchase_order_number: "",
  data_privacy_link: "",
  insurance_cover: "",
  notice_period: "",
  special_terms: "",
  use_standard_terms: false,
  custom_terms_url: "",
  courts_jurisdiction: "England and Wales",
  accept_by_date: "",
  client_signature_name: "",
  client_signature_style: "script",
  client_print_name: "",
  client_business_name_signature: "",
  client_signed_at: "",
  va_signature_name: seed.signatureName || "",
  va_print_name: seed.signatureName || "",
  va_business_name_signature: seed.businessName || "",
  va_role: "",
  va_signed_at: "",
});

export const mergeBookingContent = (
  content: Partial<BookingFormContent> | null | undefined,
  seed: BookingDefaultsSeed = {}
): BookingFormContent => {
  const defaults = createBookingDefaults(seed);
  if (!content) return defaults;

  return {
    ...defaults,
    ...content,
    services:
      content.services && content.services.length > 0
        ? content.services
        : defaults.services,
    section1_hidden_fields:
      content.section1_hidden_fields ?? defaults.section1_hidden_fields,
    section1_extra_fields:
      content.section1_extra_fields ?? defaults.section1_extra_fields,
    section2_hidden_fields:
      content.section2_hidden_fields ?? defaults.section2_hidden_fields,
    section2_extra_fields:
      content.section2_extra_fields ?? defaults.section2_extra_fields,
    section3_hidden_fields:
      content.section3_hidden_fields ?? defaults.section3_hidden_fields,
    section3_extra_fields:
      content.section3_extra_fields ?? defaults.section3_extra_fields,
    section4_hidden_fields:
      content.section4_hidden_fields ?? defaults.section4_hidden_fields,
    section4_extra_fields:
      content.section4_extra_fields ?? defaults.section4_extra_fields,
    section5_hidden_fields:
      content.section5_hidden_fields ?? defaults.section5_hidden_fields,
    section5_extra_fields:
      content.section5_extra_fields ?? defaults.section5_extra_fields,
  };
};
