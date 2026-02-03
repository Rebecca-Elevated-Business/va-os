"use client";

import type { ReactElement } from "react";
import Image from "next/image";
import {
  Award,
  BadgeCheck,
  CheckCircle,
  MessageSquare,
  ShieldCheck,
  Shield,
} from "lucide-react";
import type {
  ProposalContent,
  ProposalTrustSignal,
} from "@/lib/proposalContent";

const trustIconMap: Record<ProposalTrustSignal["icon"], ReactElement> = {
  gdpr: <ShieldCheck className="h-4 w-4" />,
  experience: <CheckCircle className="h-4 w-4" />,
  communication: <MessageSquare className="h-4 w-4" />,
  awards: <Award className="h-4 w-4" />,
  insured: <Shield className="h-4 w-4" />,
  member: <BadgeCheck className="h-4 w-4" />,
  custom: <CheckCircle className="h-4 w-4" />,
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

const formatPrice = (price: string) => {
  const trimmed = price.trim();
  if (!trimmed) return "£0.00";
  return trimmed.startsWith("£") ? trimmed : `£${trimmed}`;
};

const investmentLabel = (content: ProposalContent) => {
  const { investment } = content;
  if (investment.model === "custom") return investment.custom_label || "Custom";
  if (investment.model === "one_off") return "One-off package";
  if (investment.model === "monthly_retainer") return "Monthly retainer";
  if (investment.model === "hourly") return "Hourly allocation";
  return "Investment";
};

export default function ProposalDocument({
  content,
}: {
  content: ProposalContent;
}) {
  const heroUrl = content.hero_image_url
    ? normalizeImageUrl(content.hero_image_url)
    : "";

  return (
    <div className="bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">

      <div className="relative h-40 md:h-56 w-full">
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt="Proposal header"
            fill
            className="object-cover"
            unoptimized={heroUrl.startsWith("data:")}
          />
        ) : (
          <div className="h-full w-full bg-linear-to-r from-slate-900 via-slate-800 to-slate-700" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 text-white">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-center text-white!">
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
        {content.show_warm_welcome && (
          <section className="bg-gray-50 p-6 md:p-8 rounded-3xl border border-gray-100 text-gray-700 whitespace-pre-wrap leading-relaxed">
            {content.warm_welcome_text}
          </section>
        )}

        {content.show_scope && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-4">
              Proposed scope of work
            </h2>
            <div className="space-y-4">
              {content.scope_items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-100 p-6 bg-white shadow-sm"
                >
                  <p className="font-bold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {content.show_investment && (
          <section className="rounded-3xl border border-gray-100 p-6 md:p-8 bg-white shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-3xl font-semibold text-[#333333]">
                {formatPrice(content.investment.price)}
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-semibold text-gray-500">
                  Investment
                </p>
                <p className="text-lg font-semibold text-[#333333]">
                  {investmentLabel(content)}
                </p>
                <p className="text-sm text-gray-500">
                  {content.investment.billing_frequency}
                  {content.investment.include_vat ? " (incl. VAT)" : ""}
                </p>
              </div>
            </div>
            {content.investment.note && (
              <p className="mt-4 text-sm text-gray-600">
                {content.investment.note}
              </p>
            )}
          </section>
        )}

        {content.show_trust_signals && content.trust_signals.length > 0 && (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {content.trust_signals.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700"
                >
                  <span className="text-gray-500">
                    {trustIconMap[item.icon] || trustIconMap.custom}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {content.show_next_steps && (
          <section className="bg-gray-50 border border-gray-100 rounded-3xl p-6 md:p-8">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">
              Next Steps
            </h2>
            <ol className="space-y-3 text-sm text-gray-700">
              {content.next_steps.map((step, index) => (
                <li key={step.id} className="flex gap-3">
                  <span className="font-black text-gray-400">{index + 1}.</span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {content.show_additional_notes && content.additional_notes && (
          <section className="text-sm text-gray-500 whitespace-pre-wrap">
            {content.additional_notes}
          </section>
        )}

        {content.show_thank_you && (
          <section className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {content.thank_you_text}
          </section>
        )}

        <footer className="pt-6 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-500 mb-2">
            Kind regards,
          </p>
          <p className="text-lg font-semibold text-[#333333] whitespace-pre-wrap">
            {content.signature_text}
          </p>
        </footer>
      </div>
    </div>
  );
}
