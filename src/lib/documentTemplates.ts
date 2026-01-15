export type DocumentTemplate = {
  title: string;
  header_image: string;
  sections: {
    intro: (clientName: string) => string;
    closing: string;
    footer: string;
    legal_text?: string;
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
        `Dear ${clientName},\n\nMany thanks for your enquiry with [Your Company Name] regarding [tasks being discussed].`,
      closing: "I look forward to the possibility of working together.",
      footer: "Kind regards,",
    },
  },
  booking_form: {
    title: "Booking Form & Terms",
    header_image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1000",
    sections: {
      intro: (clientName: string) =>
        `This Booking Form constitutes a formal agreement for ${clientName}.`,
      legal_text: "Standard terms and conditions go here...",
      closing: "By signing below, you agree to these terms.",
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
      closing: "Payment is appreciated within 7 days.",
      footer: "Direct Deposit Details:",
    },
  },
};
