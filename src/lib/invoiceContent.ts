export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: string;
};

export type InvoiceContent = {
  hero_image_url: string;
  hero_title: string;
  business_name: string;
  business_logo_url: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  po_number: string;
  show_po: boolean;
  client_business_name: string;
  client_contact_name: string;
  client_address: string;
  client_email: string;
  line_items: InvoiceLineItem[];
  notes: string;
  payment_details: string;
  va_name: string;
  va_email: string;
  va_business_name: string;
  time_report_id: string;
  show_time_report_to_client: boolean;
};

type InvoiceDefaultsSeed = {
  businessName?: string;
  businessLogoUrl?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  vaName?: string;
  vaEmail?: string;
  clientBusinessName?: string;
  clientContactName?: string;
  clientEmail?: string;
  notes?: string;
  paymentDetails?: string;
};

const formatDate = (date: Date) =>
  date.toISOString().split("T")[0];

const buildInvoiceNumber = () =>
  `INV-${Date.now().toString().slice(-6)}`;

const normalizeLineItems = (items: unknown): InvoiceLineItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const anyItem = item as {
      id?: string;
      description?: string;
      quantity?: number;
      unit_price?: string;
      amount?: string;
    };
    if (anyItem.unit_price !== undefined || anyItem.quantity !== undefined) {
      return {
        id: anyItem.id || Date.now().toString(),
        description: anyItem.description || "",
        quantity: Number(anyItem.quantity || 1),
        unit_price: anyItem.unit_price || "",
      };
    }
    return {
      id: anyItem.id || Date.now().toString(),
      description: anyItem.description || "",
      quantity: 1,
      unit_price: anyItem.amount || "",
    };
  });
};

export const createInvoiceDefaults = (
  seed: InvoiceDefaultsSeed = {}
): InvoiceContent => ({
  hero_image_url: "",
  hero_title: "INVOICE",
  business_name: seed.businessName || "",
  business_logo_url: seed.businessLogoUrl || "",
  business_email: seed.businessEmail || "",
  business_phone: seed.businessPhone || "",
  business_address: seed.businessAddress || "",
  invoice_number: buildInvoiceNumber(),
  issue_date: formatDate(new Date()),
  due_date: "",
  po_number: "",
  show_po: false,
  client_business_name: seed.clientBusinessName || "",
  client_contact_name: seed.clientContactName || "",
  client_address: "",
  client_email: seed.clientEmail || "",
  line_items: [],
  notes: seed.notes || "",
  payment_details: seed.paymentDetails || "",
  va_name: seed.vaName || "",
  va_email: seed.vaEmail || "",
  va_business_name: seed.businessName || "",
  time_report_id: "",
  show_time_report_to_client: false,
});

export const mergeInvoiceContent = (
  content: Partial<InvoiceContent> | null | undefined,
  seed: InvoiceDefaultsSeed = {}
): InvoiceContent => {
  const defaults = createInvoiceDefaults(seed);
  if (!content) return defaults;

  const legacy = content as {
    client_name?: string;
    payment_notes?: string;
    bank_details?: string;
    va_name?: string;
  };

  const lineItems = normalizeLineItems(
    content.line_items || (content as { line_items?: unknown }).line_items
  );

  const merged = {
    ...defaults,
    ...content,
    line_items: lineItems,
    notes: content.notes || legacy.payment_notes || defaults.notes,
    payment_details:
      content.payment_details || legacy.bank_details || defaults.payment_details,
    client_contact_name:
      content.client_contact_name ||
      legacy.client_name ||
      defaults.client_contact_name,
    va_name: content.va_name || legacy.va_name || defaults.va_name,
  } as InvoiceContent;

  if (!merged.invoice_number) {
    merged.invoice_number = buildInvoiceNumber();
  }

  if (merged.po_number && merged.show_po === false) {
    merged.show_po = true;
  }

  if (!merged.issue_date) {
    merged.issue_date = defaults.issue_date;
  }

  return merged;
};
