export type ProposalScopeItem = {
  id: string;
  title: string;
  summary: string;
};

export type ProposalInvestment = {
  model: "one_off" | "monthly_retainer" | "hourly" | "custom";
  custom_label?: string;
  price: string;
  billing_frequency: string;
  include_vat: boolean;
  note: string;
};

export type ProposalTrustSignal = {
  id: string;
  label: string;
  icon: "gdpr" | "experience" | "communication" | "awards" | "insured" | "member" | "custom";
};

export type ProposalContent = {
  hero_image_url: string;
  hero_title: string;
  prepared_for: string;
  prepared_by: string;
  prepared_date: string;
  show_warm_welcome: boolean;
  warm_welcome_text: string;
  show_scope: boolean;
  scope_items: ProposalScopeItem[];
  show_investment: boolean;
  investment: ProposalInvestment;
  show_trust_signals: boolean;
  trust_signals: ProposalTrustSignal[];
  show_next_steps: boolean;
  next_steps: { id: string; text: string }[];
  show_additional_notes: boolean;
  additional_notes: string;
  show_thank_you: boolean;
  thank_you_text: string;
  signature_text: string;
};

type ProposalDefaultsSeed = {
  preparedBy?: string;
  signatureText?: string;
};

const DEFAULT_IMAGE =
  "https://unsplash.com/photos/chairs-beside-table-zCQsBI7ZltQ";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export const createProposalDefaults = (
  seed: ProposalDefaultsSeed = {}
): ProposalContent => ({
  hero_image_url: "",
  hero_title: "Proposal",
  prepared_for: "Client Name",
  prepared_by: seed.preparedBy || "VA/Business Name",
  prepared_date: formatDate(new Date()),
  show_warm_welcome: true,
  warm_welcome_text:
    "Dear [Customer Name]\n\nThanks for enquiring with me in regards to my VA services, it's been a pleasure to find out how I can best support your business and appreciate the opportunity to work with you.\n\nBased on our conversation so far, I've outlined the below proposal.\n\nIf you would like to go ahead, or have any further questions before making a decision, please do contact me.\n\nKind regards,\n\n[VA Name]",
  show_scope: true,
  scope_items: [
    {
      id: "scope-1",
      title: "",
      summary: "",
    },
  ],
  show_investment: true,
  investment: {
    model: "monthly_retainer",
    custom_label: "",
    price: "£0.00",
    billing_frequency: "per month",
    include_vat: false,
    note: "",
  },
  show_trust_signals: true,
  trust_signals: [
    { id: "trust-1", label: "GDPR compliant", icon: "gdpr" },
    { id: "trust-2", label: "[VA INSERT] years of experience", icon: "experience" },
    { id: "trust-3", label: "Clear communication", icon: "communication" },
    { id: "trust-4", label: "Awards in [VA INSERT]", icon: "awards" },
    { id: "trust-5", label: "Insured by [VA INSERT]", icon: "insured" },
    { id: "trust-6", label: "Member of [VA INSERT]", icon: "member" },
  ],
  show_next_steps: true,
  next_steps: [
    {
      id: "step-1",
      text: "Accept the proposal at the bottom of this form or request edits/further information.",
    },
    {
      id: "step-2",
      text: "Once agreed, you'll receive formal contract with booking terms.",
    },
    {
      id: "step-3",
      text: "Onboarding process begins where you'll receive our service level agreements.",
    },
    {
      id: "step-4",
      text: "Service officially begins on the agreed date.",
    },
  ],
  show_additional_notes: true,
  additional_notes: "",
  show_thank_you: true,
  thank_you_text:
    'Thank you once again for considering me for your business support needs. I\'d like to take the opportunity to express how much I would like to work with you. To give me the go-ahead please simply select "Approve & Confirm" below, or if you have any edits/questions you can request those also.',
  signature_text: seed.signatureText || "[VA Name]",
});

export const mergeProposalContent = (
  content: Partial<ProposalContent> | null | undefined,
  seed: ProposalDefaultsSeed = {}
): ProposalContent => {
  const defaults = createProposalDefaults(seed);
  if (!content) return defaults;

  return {
    ...defaults,
    ...content,
    investment: {
      ...defaults.investment,
      ...(content.investment || {}),
    },
    scope_items:
      content.scope_items && content.scope_items.length > 0
        ? content.scope_items
        : defaults.scope_items,
    trust_signals:
      content.trust_signals && content.trust_signals.length > 0
        ? content.trust_signals
        : defaults.trust_signals,
    next_steps:
      content.next_steps && content.next_steps.length > 0
        ? content.next_steps
        : defaults.next_steps,
  };
};
