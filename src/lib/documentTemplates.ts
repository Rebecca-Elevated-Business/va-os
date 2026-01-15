export type DocumentTemplate = {
  title: string;
  header_image: string;
  sections: {
    intro: (clientName: string) => string;
    closing: string;
    footer: string;
    legal_text?: string; // Specifically for Booking Forms
  };
};

export const DOCUMENT_TEMPLATES: Record<
  "proposal" | "booking_form" | "invoice",
  DocumentTemplate
> = {
  proposal: {
    title: "Project Proposal",
    header_image:
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1000",
    sections: {
      intro: (clientName: string) =>
        `Dear ${clientName},\n\nMany thanks for your enquiry. It was a pleasure to learn more about your requirements.`,
      closing:
        "I look forward to the possibility of working together to elevate your business operations.",
      footer: "Kind regards,",
    },
  },
  booking_form: {
    title: "Booking Form & Master Terms of Service",
    header_image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1000",
    sections: {
      intro: (clientName: string) =>
        `This Booking Form constitutes a formal agreement for ${clientName}.`,
      // PASTE YOUR 50+ LINES OF LEGAL TEXT HERE
      legal_text:
        `1. APPOINTMENT & TERM\nThis agreement begins on the Start Date...\n\n2. SERVICES & DELIVERY\nThe VA shall provide services as outlined in the Scope of Work...\n\n3. PAYMENT TERMS\nFees are payable as per the Pricing Summary section...\n\n` +
        Array(40)
          .fill("Standard legal clause placeholder line to test scrolling...")
          .join("\n"),
      closing: "By signing below, you agree to the terms outlined above.",
      footer: "Authorised Signature",
    },
  },
  invoice: {
    title: "Tax Invoice",
    header_image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000",
    sections: {
      intro: (clientName: string) =>
        `Invoice for services rendered to ${clientName}.`,
      closing:
        "Thank you for your business. Payment is appreciated within 7 days.",
      footer: "Direct Deposit Details:",
    },
  },
};
