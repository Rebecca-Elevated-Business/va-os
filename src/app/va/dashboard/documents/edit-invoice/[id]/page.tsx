"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus, Trash2 } from "lucide-react";
import { DOCUMENT_TEMPLATES } from "@/lib/documentTemplates";
import {
  mergeInvoiceContent,
  type InvoiceContent,
  type InvoiceLineItem,
} from "@/lib/invoiceContent";
import type { InvoiceTimeReport } from "@/components/documents/InvoiceDocument";

type ClientDoc = {
  id: string;
  client_id: string;
  title: string;
  type: string;
  status: string;
  issued_at: string | null;
  content: Partial<InvoiceContent>;
};

type FetchedDoc = ClientDoc & {
  clients: {
    first_name: string;
    surname: string;
    business_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

type TimeReportOption = {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  total_seconds: number;
  entry_count: number;
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

export default function EditInvoicePage({
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
  const [userId, setUserId] = useState<string | null>(null);
  const [availableReports, setAvailableReports] = useState<TimeReportOption[]>(
    []
  );
  const [reportDetails, setReportDetails] = useState<InvoiceTimeReport | null>(
    null
  );
  const [showReportSelector, setShowReportSelector] = useState(false);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    async function loadDoc() {
      const { data } = await supabase
        .from("client_documents")
        .select("*, clients(first_name, surname, business_name, email, phone)")
        .eq("id", id)
        .single();

      if (data) {
        const fetched = data as FetchedDoc;
        let businessName = "";
        let businessLogoUrl = "";
        let businessEmail = "";
        let businessPhone = "";
        let vaName = "";
        let vaEmail = "";

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", user.id)
            .maybeSingle();
          const { data: business } = await supabase
            .from("va_business_details")
            .select("company_name, email, phone, logo_url")
            .eq("va_id", user.id)
            .maybeSingle();

          businessName = business?.company_name || "";
          businessLogoUrl = business?.logo_url || "";
          businessEmail = business?.email || user.email || "";
          businessPhone = business?.phone || "";
          vaName = profile?.display_name || profile?.full_name || "";
          vaEmail = businessEmail;
        }

        const merged = mergeInvoiceContent(fetched.content, {
          businessName,
          businessLogoUrl,
          businessEmail,
          businessPhone,
          vaName,
          vaEmail,
          clientBusinessName: fetched.clients.business_name || "",
          clientContactName: `${fetched.clients.first_name} ${fetched.clients.surname}`,
          clientEmail: fetched.clients.email || "",
          notes: DOCUMENT_TEMPLATES.invoice.sections.closing,
          paymentDetails: DOCUMENT_TEMPLATES.invoice.sections.footer,
        });

        merged.client_contact_name =
          merged.client_contact_name ||
          `${fetched.clients.first_name} ${fetched.clients.surname}`;
        merged.client_business_name =
          merged.client_business_name || fetched.clients.business_name || "";
        merged.client_email =
          merged.client_email || fetched.clients.email || "";

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

  useEffect(() => {
    const clientId = doc?.client_id;
    if (!userId || !clientId) return;
    async function loadReports() {
      const { data } = await supabase
        .from("time_reports")
        .select("id, name, date_from, date_to, total_seconds, entry_count")
        .eq("va_user_id", userId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      setAvailableReports((data as TimeReportOption[]) || []);
    }
    loadReports();
  }, [userId, doc?.client_id]);

  useEffect(() => {
    const reportId = doc?.content.time_report_id;
    if (!reportId) {
      const timer = setTimeout(() => {
        setReportDetails(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    async function loadReportDetail() {
      const { data: reportData } = await supabase
        .from("time_reports")
        .select("id, name, date_from, date_to, total_seconds, entry_count")
        .eq("id", reportId)
        .single();

      if (!reportData) {
        setReportDetails(null);
        return;
      }

      const { data: entryData } = await supabase
        .from("time_report_entries")
        .select("entry_date, task_title, duration_seconds, notes")
        .eq("report_id", reportData.id)
        .order("entry_date", { ascending: false });

      setReportDetails({
        ...(reportData as TimeReportOption),
        entries: (entryData as InvoiceTimeReport["entries"]) || [],
      });
    }
    loadReportDetail();
  }, [doc?.content.time_report_id]);

  const updateContent = (updates: Partial<InvoiceContent>) => {
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

  const lineItems = useMemo(
    () => doc?.content.line_items || [],
    [doc?.content.line_items]
  );
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const total = Number(item.quantity || 0) * parseAmount(item.unit_price);
      return sum + total;
    }, 0);
  }, [lineItems]);

  const updateLineItem = (index: number, updates: Partial<InvoiceLineItem>) => {
    if (!doc) return;
    const items = [...(doc.content.line_items || [])];
    items[index] = { ...items[index], ...updates };
    updateContent({ line_items: items });
  };

  const addLineItem = () => {
    if (!doc) return;
    updateContent({
      line_items: [
        ...(doc.content.line_items || []),
        {
          id: `line-${Date.now()}`,
          description: "",
          quantity: 1,
          unit_price: "",
        },
      ],
    });
  };

  const removeLineItem = (index: number) => {
    if (!doc) return;
    const items = [...(doc.content.line_items || [])];
    items.splice(index, 1);
    updateContent({ line_items: items });
  };

  const persistDoc = useCallback(
    async (options?: { issue?: boolean; status?: string; silent?: boolean }) => {
      if (!doc) return;
      const shouldIssue = Boolean(options?.issue);
      const silent = Boolean(options?.silent);
      const status = options?.status || (shouldIssue ? "issued" : doc.status);

      if (shouldIssue) {
        const requiredFields = [
          doc.content.invoice_number,
          doc.content.issue_date,
          doc.content.due_date,
          doc.content.client_business_name,
          doc.content.client_contact_name,
          doc.content.client_address,
          doc.content.client_email,
        ];
        if (requiredFields.some((value) => !String(value || "").trim())) {
          alert("Please complete all client and invoice details before issuing.");
          return;
        }
        if (doc.content.show_po && !(doc.content.po_number || "").trim()) {
          alert("Enter a PO number or disable the PO field.");
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
        status,
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
          status,
        });
        setDoc((prev) => (prev ? { ...prev, status } : prev));
        if (!silent) {
          if (options?.status === "paid") {
            alert("Invoice marked as paid.");
          } else {
            alert(shouldIssue ? "Invoice issued to client!" : "Draft saved.");
          }
          if (shouldIssue)
            router.push(`/va/dashboard/crm/profile/${doc.client_id}`);
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
        Loading Invoice Editor...
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
            Invoice Builder
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
            Issue Invoice
          </button>
          {doc.status !== "paid" && (
            <button
              onClick={() => persistDoc({ status: "paid" })}
              className="px-6 py-2 border-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              Mark as Paid
            </button>
          )}
        </div>
      </div>

      <div className="space-y-10">
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
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="Invoice title"
              value={doc.content.hero_title || ""}
              onChange={(e) => updateContent({ hero_title: e.target.value })}
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500">
              Business name
            </label>
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.business_name || ""}
              onChange={(e) => updateContent({ business_name: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500">
              Business logo URL (optional)
            </label>
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.business_logo_url || ""}
              onChange={(e) =>
                updateContent({ business_logo_url: e.target.value })
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500">
              Business email
            </label>
            <input
              type="email"
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.business_email || ""}
              onChange={(e) =>
                updateContent({ business_email: e.target.value })
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500">
              Business phone
            </label>
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.business_phone || ""}
              onChange={(e) =>
                updateContent({ business_phone: e.target.value })
              }
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-bold text-gray-500">
              Business address
            </label>
            <textarea
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm min-h-20"
              value={doc.content.business_address || ""}
              onChange={(e) =>
                updateContent({ business_address: e.target.value })
              }
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">
              Invoice number
            </label>
            <input
              className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100 font-bold"
              value={doc.content.invoice_number || ""}
              onChange={(e) => updateContent({ invoice_number: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">Issue date</label>
            <input
              type="date"
              className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100"
              value={doc.content.issue_date || ""}
              onChange={(e) => updateContent({ issue_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">Due date</label>
            <input
              type="date"
              className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100 font-bold text-red-500"
              value={doc.content.due_date || ""}
              onChange={(e) => updateContent({ due_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={Boolean(doc.content.show_po)}
                onChange={(e) =>
                  updateContent({
                    show_po: e.target.checked,
                    po_number: e.target.checked
                      ? doc.content.po_number || ""
                      : "",
                  })
                }
              />
              Include PO number
            </label>
            {doc.content.show_po && (
              <input
                className="w-full p-3 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-purple-100"
                placeholder="PO number"
                value={doc.content.po_number || ""}
                onChange={(e) => updateContent({ po_number: e.target.value })}
              />
            )}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500">
              Client business name
            </label>
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.client_business_name || ""}
              onChange={(e) =>
                updateContent({ client_business_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500">
              Client contact name
            </label>
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.client_contact_name || ""}
              onChange={(e) =>
                updateContent({ client_contact_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-bold text-gray-500">
              Client postal address
            </label>
            <textarea
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm min-h-20"
              value={doc.content.client_address || ""}
              onChange={(e) =>
                updateContent({ client_address: e.target.value })
              }
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-bold text-gray-500">
              Client email
            </label>
            <input
              type="email"
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              value={doc.content.client_email || ""}
              onChange={(e) =>
                updateContent({ client_email: e.target.value })
              }
            />
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Line Items
            </h3>
            <div className="flex items-center gap-3">
              {!doc.content.time_report_id && (
                <button
                  onClick={() => setShowReportSelector(true)}
                  className="px-4 py-2 border-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Import time report
                </button>
              )}
              <button
                onClick={addLineItem}
                className="px-4 py-2 border-2 border-dashed rounded-xl font-bold text-[10px] uppercase tracking-widest hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add line item
              </button>
            </div>
          </div>

          {lineItems.length === 0 ? (
            <div className="text-sm text-gray-400 italic">
              No line items yet. Add your first line item to begin.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="hidden md:grid md:grid-cols-[1fr_90px_120px_120px_auto] text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {lineItems.map((item, index) => {
                const lineTotal =
                  Number(item.quantity || 0) * parseAmount(item.unit_price);
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 md:grid-cols-[1fr_90px_120px_120px_auto] items-center"
                  >
                    <input
                      className="p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-purple-100 text-sm transition-all"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(index, { description: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      className="p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-purple-100 text-sm text-right"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(index, {
                          quantity: Number(e.target.value || 0),
                        })
                      }
                    />
                    <input
                      className="p-4 bg-gray-50 rounded-2xl outline-none border-2 border-transparent focus:border-purple-100 text-sm text-right"
                      placeholder="0.00"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateLineItem(index, { unit_price: e.target.value })
                      }
                    />
                    <div className="text-right font-bold text-sm">
                      {formatCurrency(lineTotal)}
                    </div>
                    <button
                      onClick={() => removeLineItem(index)}
                      className="text-gray-300 hover:text-red-500"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
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
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Time report (optional)
            </h3>
            {doc.content.time_report_id && (
              <button
                onClick={() =>
                  updateContent({
                    time_report_id: "",
                    show_time_report_to_client: false,
                  })
                }
                className="text-xs font-bold text-red-400 hover:text-red-500"
              >
                Remove report
              </button>
            )}
          </div>

          {!doc.content.time_report_id && showReportSelector && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500">
                Select a saved report
              </label>
              <select
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
                value={doc.content.time_report_id || ""}
                onChange={(e) => {
                  updateContent({ time_report_id: e.target.value });
                  setShowReportSelector(false);
                }}
              >
                <option value="">Choose report...</option>
                {availableReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.name}
                  </option>
                ))}
              </select>
              {availableReports.length === 0 && (
                <p className="text-xs text-gray-400">
                  No saved reports available for this client yet.
                </p>
              )}
            </div>
          )}

          {doc.content.time_report_id && reportDetails && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900">
                    {reportDetails.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(reportDetails.date_from)} —{" "}
                    {formatDate(reportDetails.date_to)}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDuration(reportDetails.total_seconds)} ·{" "}
                  {reportDetails.entry_count} entries
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={Boolean(doc.content.show_time_report_to_client)}
                  onChange={(e) =>
                    updateContent({
                      show_time_report_to_client: e.target.checked,
                    })
                  }
                />
                Show time breakdown to client
              </label>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Notes / Instructions
            </label>
            <textarea
              className="w-full p-5 bg-gray-50 rounded-4xl outline-none border-2 border-transparent focus:border-purple-100 text-sm min-h-30"
              value={doc.content.notes || ""}
              onChange={(e) => updateContent({ notes: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
              Payment Details
            </label>
            <textarea
              className="w-full p-5 bg-gray-900 text-green-400 rounded-4xl outline-none font-mono text-xs min-h-30 border-4 border-gray-800"
              value={doc.content.payment_details || ""}
              onChange={(e) =>
                updateContent({ payment_details: e.target.value })
              }
            />
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            VA Sign-off
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="VA name"
              value={doc.content.va_name || ""}
              onChange={(e) => updateContent({ va_name: e.target.value })}
            />
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="VA email"
              value={doc.content.va_email || ""}
              onChange={(e) => updateContent({ va_email: e.target.value })}
            />
            <input
              className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-purple-100 text-sm"
              placeholder="Business name"
              value={doc.content.va_business_name || ""}
              onChange={(e) =>
                updateContent({ va_business_name: e.target.value })
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
