"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { InvoiceContent } from "@/lib/invoiceContent";

export type InvoiceTimeReport = {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  total_seconds: number;
  entry_count: number;
  entries: {
    entry_date: string;
    task_title: string;
    duration_seconds: number;
    notes: string | null;
  }[];
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

const parseAmount = (value: string) => {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (value: number) => `£${value.toFixed(2)}`;

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function InvoiceDocument({
  content,
  report,
}: {
  content: InvoiceContent;
  report?: InvoiceTimeReport | null;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const heroUrl = content.hero_image_url
    ? normalizeImageUrl(content.hero_image_url)
    : "";

  const lineItems = useMemo(
    () => content.line_items || [],
    [content.line_items],
  );
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const lineTotal =
        Number(item.quantity || 0) * parseAmount(item.unit_price);
      return sum + lineTotal;
    }, 0);
  }, [lineItems]);

  const businessContactLines = [
    content.business_email,
    content.business_phone,
    content.business_address,
  ]
    .filter(Boolean)
    .join("\n");

  const entriesPreview = report?.entries.slice(0, 8) || [];
  const hasMoreEntries =
    report && report.entries.length > entriesPreview.length;

  return (
    <div className="bg-white shadow-2xl rounded-4xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">
      <div className="relative h-32 md:h-40 w-full">
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt="Invoice header"
            fill
            className="object-cover"
            unoptimized={heroUrl.startsWith("data:")}
          />
        ) : (
          <div className="h-full w-full bg-linear-to-r from-slate-900 via-slate-800 to-slate-700" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-between p-6 md:p-10 text-white">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white !text-white">
            {content.hero_title}
          </h1>
          <div className="text-right text-xs md:text-sm space-y-1 text-white/90">
            <p>
              <span className="font-semibold">Invoice #</span>{" "}
              {content.invoice_number}
            </p>
            <p>
              <span className="font-semibold">Issue Date</span>{" "}
              {content.issue_date ? formatDate(content.issue_date) : ""}
            </p>
            <p>
              <span className="font-semibold">Due Date</span>{" "}
              {content.due_date ? formatDate(content.due_date) : ""}
            </p>
            {content.show_po && content.po_number && (
              <p>
                <span className="font-semibold">PO #</span> {content.po_number}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12 space-y-10">
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            {content.business_logo_url && (
              <Image
                src={content.business_logo_url}
                alt={content.business_name || "Business logo"}
                width={180}
                height={48}
                className="h-12 w-auto mb-4 object-contain"
                unoptimized={content.business_logo_url.startsWith("data:")}
              />
            )}
            <h2 className="text-lg font-black text-gray-900">
              {content.business_name || "VA Business"}
            </h2>
            <div className="text-sm text-gray-500 whitespace-pre-wrap">
              {businessContactLines || "Contact details"}
            </div>
          </div>
          <div className="text-sm text-gray-500">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Bill To
            </p>
            <div className="space-y-1 whitespace-pre-wrap">
              <p className="font-bold text-gray-900">
                {content.client_business_name || "Client business name"}
              </p>
              <p>{content.client_contact_name || "Client contact name"}</p>
              <p>{content.client_address || "Client address"}</p>
              <p>{content.client_email || "Client email"}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Total</span>
          </div>
          {lineItems.length === 0 ? (
            <div className="text-sm text-gray-400 italic">
              No line items added.
            </div>
          ) : (
            <div className="space-y-3">
              {lineItems.map((item) => {
                const lineTotal =
                  Number(item.quantity || 0) * parseAmount(item.unit_price);
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 md:grid-cols-[1fr_90px_120px_120px] items-center border border-gray-100 rounded-xl p-4"
                  >
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {item.description || "Description"}
                    </p>
                    <p className="text-sm text-gray-600 text-right">
                      {item.quantity}
                    </p>
                    <p className="text-sm text-gray-600 text-right">
                      {formatCurrency(parseAmount(item.unit_price))}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(lineTotal)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-base font-black">
              <span>Total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Notes / Instructions
            </p>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-600 whitespace-pre-wrap min-h-24">
              {content.notes || "No notes provided."}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Payment Details
            </p>
            <div className="rounded-3xl border border-gray-100 bg-gray-900 p-5 text-xs text-green-400 whitespace-pre-wrap min-h-24 font-mono">
              {content.payment_details || "Payment details to follow."}
            </div>
          </div>
        </section>

        {report && content.show_time_report_to_client && (
          <section className="rounded-3xl border border-gray-100 bg-gray-50 p-6 space-y-4">
            <button
              type="button"
              onClick={() => setReportOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest"
            >
              Time report (optional)
              {reportOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {reportOpen && (
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{report.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(report.date_from)} —{" "}
                      {formatDate(report.date_to)}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(report.total_seconds)} ·{" "}
                    {report.entry_count} entries
                  </div>
                </div>
                {entriesPreview.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    No entries found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {entriesPreview.map((entry) => (
                      <div
                        key={`${entry.entry_date}-${entry.task_title}`}
                        className="rounded-2xl border border-gray-100 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {entry.task_title}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDateTime(entry.entry_date)}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-gray-600">
                            {formatDuration(entry.duration_seconds)}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {hasMoreEntries && (
                  <p className="text-xs text-gray-400">
                    Showing {entriesPreview.length} of {report.entry_count}{" "}
                    entries.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <footer className="pt-6 border-t border-gray-100 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">{content.va_name}</p>
          <p>{content.va_email}</p>
          <p>{content.va_business_name}</p>
        </footer>
      </div>
    </div>
  );
}
