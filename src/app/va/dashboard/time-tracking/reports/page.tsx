"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";
import { usePrompt } from "@/components/ui/PromptProvider";

type ClientSearchResult = {
  id: string;
  business_name: string | null;
  surname: string | null;
  first_name: string | null;
};

type TimeEntryRow = {
  id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  notes?: string | null;
  tasks: {
    task_name: string;
    client_id: string | null;
    clients: {
      business_name: string | null;
      surname: string | null;
    } | null;
  } | null;
};

type ReportPreview = {
  client_id: string;
  client_name: string;
  date_from: string;
  date_to: string;
  total_seconds: number;
  entry_count: number;
  entries: {
    entry_date: string;
    task_title: string;
    duration_seconds: number;
    notes: string | null;
    source_time_entry_id: string;
  }[];
};

type SavedReportRow = {
  id: string;
  name: string;
  client_id: string;
  date_from: string;
  date_to: string;
  total_seconds: number;
  entry_count: number;
  created_at: string;
  is_archived?: boolean | null;
  clients: {
    business_name: string | null;
    surname: string | null;
  } | null;
};

type SavedReportRowRaw = Omit<SavedReportRow, "clients"> & {
  clients:
    | {
        business_name: string | null;
        surname: string | null;
      }
    | {
        business_name: string | null;
        surname: string | null;
      }[]
    | null;
};

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const buildReportName = (clientName: string, from: string, to: string) =>
  `${clientName} – ${formatDate(from)}–${formatDate(to)}`;

export default function TimeReportsPage() {
  const router = useRouter();
  const { confirm } = usePrompt();
  const [userId, setUserId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] =
    useState<ClientSearchResult | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReportRow[]>([]);
  const [archivedReports, setArchivedReports] = useState<SavedReportRow[]>([]);
  const [loadingSavedReports, setLoadingSavedReports] = useState(true);
  const [viewArchived, setViewArchived] = useState(false);
  const [archiveClientSearch, setArchiveClientSearch] = useState("");
  const [archiveClientResults, setArchiveClientResults] = useState<
    ClientSearchResult[]
  >([]);
  const [archiveSelectedClient, setArchiveSelectedClient] =
    useState<ClientSearchResult | null>(null);
  const [archiveDateFrom, setArchiveDateFrom] = useState("");
  const [archiveDateTo, setArchiveDateTo] = useState("");

  const normalizeReports = (data: SavedReportRowRaw[] | null) =>
    (data || []).map((row) => ({
      ...row,
      clients: Array.isArray(row.clients) ? row.clients[0] || null : row.clients,
    }));

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    async function loadSavedReports() {
      const { data } = await supabase
        .from("time_reports")
        .select(
          "id, name, client_id, date_from, date_to, total_seconds, entry_count, created_at, is_archived, clients(business_name, surname)"
        )
        .eq("va_user_id", userId)
        .order("created_at", { ascending: false });
      const normalized = normalizeReports(data as SavedReportRowRaw[] | null);
      setSavedReports(normalized.filter((report) => !report.is_archived));
      setArchivedReports(normalized.filter((report) => report.is_archived));
      setLoadingSavedReports(false);
    }
    loadSavedReports();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const query = clientSearch.trim();
    if (query.length < 2) {
      return;
    }

    const handler = setTimeout(async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, business_name, surname, first_name")
        .eq("va_id", userId)
        .or(
          `surname.ilike.%${query}%,business_name.ilike.%${query}%,first_name.ilike.%${query}%`
        )
        .order("surname");
      setClientResults((data as ClientSearchResult[]) || []);
    }, 300);

    return () => clearTimeout(handler);
  }, [clientSearch, userId]);

  useEffect(() => {
    if (!userId) return;
    const query = archiveClientSearch.trim();
    if (query.length < 2) {
      return;
    }

    const handler = setTimeout(async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, business_name, surname, first_name")
        .eq("va_id", userId)
        .or(
          `surname.ilike.%${query}%,business_name.ilike.%${query}%,first_name.ilike.%${query}%`
        )
        .order("surname");
      setArchiveClientResults((data as ClientSearchResult[]) || []);
    }, 300);

    return () => clearTimeout(handler);
  }, [archiveClientSearch, userId]);

  const selectedClientLabel = useMemo(() => {
    if (!selectedClient) return "";
    return (
      selectedClient.business_name ||
      `${selectedClient.first_name || ""} ${selectedClient.surname || ""}`.trim()
    );
  }, [selectedClient]);

  const archiveSelectedClientLabel = useMemo(() => {
    if (!archiveSelectedClient) return "";
    return (
      archiveSelectedClient.business_name ||
      `${archiveSelectedClient.first_name || ""} ${
        archiveSelectedClient.surname || ""
      }`.trim()
    );
  }, [archiveSelectedClient]);

  const filteredArchivedReports = useMemo(() => {
    return archivedReports.filter((report) => {
      if (archiveSelectedClient && report.client_id !== archiveSelectedClient.id)
        return false;
      if (archiveDateFrom && report.date_from < archiveDateFrom) return false;
      if (archiveDateTo && report.date_to > archiveDateTo) return false;
      return true;
    });
  }, [archivedReports, archiveSelectedClient, archiveDateFrom, archiveDateTo]);

  const resetFilters = () => {
    setClientSearch("");
    setSelectedClient(null);
    setDateFrom("");
    setDateTo("");
    setPreview(null);
    setIncludeNotes(false);
  };

  const resetArchiveFilters = () => {
    setArchiveClientSearch("");
    setArchiveClientResults([]);
    setArchiveSelectedClient(null);
    setArchiveDateFrom("");
    setArchiveDateTo("");
  };

  const handleGenerateReport = async () => {
    if (!selectedClient || !dateFrom || !dateTo || !userId) return;
    setLoadingPreview(true);

    const startIso = new Date(`${dateFrom}T00:00:00`).toISOString();
    const endIso = new Date(`${dateTo}T23:59:59.999`).toISOString();

    const { data } = await supabase
      .from("time_entries")
      .select(
        "*, tasks!inner(task_name, client_id, clients(business_name, surname))"
      )
      .eq("va_id", userId)
      .eq("tasks.client_id", selectedClient.id)
      .gte("started_at", startIso)
      .lte("started_at", endIso)
      .order("started_at", { ascending: false });

    const entries = (data as TimeEntryRow[]) || [];
    const snapshot = entries.map((entry) => ({
      entry_date: entry.started_at,
      task_title: entry.tasks?.task_name || "Untitled task",
      duration_seconds: entry.duration_minutes * 60,
      notes: includeNotes ? entry.notes || null : null,
      source_time_entry_id: entry.id,
    }));

    const totalSeconds = snapshot.reduce(
      (sum, entry) => sum + entry.duration_seconds,
      0
    );

    setPreview({
      client_id: selectedClient.id,
      client_name: selectedClientLabel || "Client",
      date_from: dateFrom,
      date_to: dateTo,
      total_seconds: totalSeconds,
      entry_count: snapshot.length,
      entries: snapshot,
    });

    setLoadingPreview(false);
  };

  const handleSaveReport = async () => {
    if (!preview || !userId) return;
    const suggestedName = buildReportName(
      preview.client_name,
      preview.date_from,
      preview.date_to
    );
    const reportName =
      window.prompt("Report name", suggestedName) || suggestedName;
    if (!reportName.trim()) return;

    setSavingReport(true);

    const { data: report, error } = await supabase
      .from("time_reports")
      .insert([
        {
          va_user_id: userId,
          client_id: preview.client_id,
          name: reportName.trim(),
          date_from: preview.date_from,
          date_to: preview.date_to,
          total_seconds: preview.total_seconds,
          entry_count: preview.entry_count,
        },
      ])
      .select("id")
      .single();

    if (error || !report) {
      setSavingReport(false);
      return;
    }

    const lines = preview.entries.map((entry) => ({
      report_id: report.id,
      entry_date: entry.entry_date,
      task_title: entry.task_title,
      duration_seconds: entry.duration_seconds,
      notes: entry.notes,
      source_time_entry_id: entry.source_time_entry_id,
    }));

    if (lines.length > 0) {
      await supabase.from("time_report_entries").insert(lines);
    }

    setSavingReport(false);
    setPreview(null);
    setClientSearch("");
    setSelectedClient(null);
    setDateFrom("");
    setDateTo("");
    setIncludeNotes(false);

    const { data: savedData } = await supabase
      .from("time_reports")
      .select(
        "id, name, client_id, date_from, date_to, total_seconds, entry_count, created_at, is_archived, clients(business_name, surname)"
      )
      .eq("va_user_id", userId)
      .order("created_at", { ascending: false });
    const refreshed = normalizeReports(savedData as SavedReportRowRaw[] | null);
    setSavedReports(refreshed.filter((report) => !report.is_archived));
    setArchivedReports(refreshed.filter((report) => report.is_archived));
  };

  const handleDeleteReport = async (reportId: string) => {
    const ok = await confirm({
      title: "Delete report?",
      message: "Delete this report?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await supabase.from("time_reports").delete().eq("id", reportId);
    setSavedReports((prev) => prev.filter((report) => report.id !== reportId));
    setArchivedReports((prev) =>
      prev.filter((report) => report.id !== reportId)
    );
  };

  const handleArchiveReport = async (reportId: string) => {
    await supabase
      .from("time_reports")
      .update({ is_archived: true })
      .eq("id", reportId);
    setSavedReports((prev) => {
      const target = prev.find((report) => report.id === reportId);
      if (!target) return prev;
      setArchivedReports((archived) => [
        { ...target, is_archived: true },
        ...archived,
      ]);
      return prev.filter((report) => report.id !== reportId);
    });
  };

  const handleUnarchiveReport = async (reportId: string) => {
    await supabase
      .from("time_reports")
      .update({ is_archived: false })
      .eq("id", reportId);
    setArchivedReports((prev) => {
      const target = prev.find((report) => report.id === reportId);
      if (!target) return prev;
      setSavedReports((active) => [
        { ...target, is_archived: false },
        ...active,
      ]);
      return prev.filter((report) => report.id !== reportId);
    });
  };

  return (
    <div className="min-h-screen text-[#333333] pb-20 font-sans">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Reports</h1>
          <p className="text-sm text-gray-400">
            Generate and save time report snapshots.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link
            href="/va/dashboard/time-tracking"
            className="text-gray-400 hover:text-[#9d4edd]"
          >
            Time Tracking
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-[#9d4edd]">Reports</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-black tracking-widest text-gray-500 uppercase">
            Report Builder
          </h2>
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">
              Client
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search client..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:ring-2 focus:ring-[#9d4edd] outline-none"
                value={selectedClient ? selectedClientLabel : clientSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedClient(null);
                  setClientSearch(value);
                  if (value.trim().length < 2) {
                    setClientResults([]);
                  }
                }}
                onFocus={() => {
                  if (!selectedClient) setClientSearch((prev) => prev);
                }}
              />
              {clientSearch.trim().length >= 2 && !selectedClient && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-100 bg-white shadow-xl max-h-64 overflow-auto">
                  {clientResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">
                      No clients found.
                    </div>
                  ) : (
                    clientResults.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client);
                          setClientSearch("");
                          setClientResults([]);
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-[#333333] hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">
                            {client.business_name ||
                              `${client.first_name || ""} ${
                                client.surname || ""
                              }`.trim()}
                          </span>
                          {client.business_name && (
                            <span className="text-[11px] font-bold text-gray-400 shrink-0">
                              {client.surname || "Client"}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col text-xs font-semibold text-gray-500">
              Start date
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
              />
            </div>
            <div className="flex flex-col text-xs font-semibold text-gray-500">
              End date
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-500">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(event) => setIncludeNotes(event.target.checked)}
            />
            Include notes (if available)
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={!selectedClient || !dateFrom || !dateTo}
              className="bg-[#9d4edd] text-white px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-[#7b2cbf] transition-colors disabled:bg-gray-200"
            >
              Generate report
            </button>
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-gray-500 hover:text-[#9d4edd]"
            >
              Reset
            </button>
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black tracking-widest text-gray-500 uppercase">
              Report Preview
            </h2>
            {preview && (
              <button
                onClick={handleSaveReport}
                disabled={savingReport}
                className="bg-[#333333] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#111111] transition-colors"
              >
                {savingReport ? "Saving..." : "Save report"}
              </button>
            )}
          </div>

          {loadingPreview ? (
            <div className="text-sm text-gray-400 italic">
              Generating preview...
            </div>
          ) : !preview ? (
            <div className="text-sm text-gray-400 italic">
              Generate a report to preview results.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Total time
                  </p>
                  <p className="text-lg font-black text-[#333333]">
                    {formatDuration(preview.total_seconds)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Entries
                  </p>
                  <p className="text-lg font-black text-[#333333]">
                    {preview.entry_count}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Date range
                  </p>
                  <p className="text-sm font-semibold text-[#333333]">
                    {formatDate(preview.date_from)} —{" "}
                    {formatDate(preview.date_to)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Client
                  </p>
                  <p className="text-sm font-semibold text-[#333333]">
                    {preview.client_name}
                  </p>
                </div>
              </div>

              {preview.entries.length === 0 ? (
                <div className="text-sm text-gray-400 italic">
                  No entries found for this range.
                </div>
              ) : (
                <div className="space-y-3">
                  {preview.entries.map((entry) => (
                    <div
                      key={entry.source_time_entry_id}
                      className="border border-gray-100 rounded-xl p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#333333]">
                            {entry.task_title}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDateTime(entry.entry_date)}
                          </p>
                        </div>
                        <div className="text-sm font-mono text-[#333333]">
                          {formatDuration(entry.duration_seconds)}
                        </div>
                      </div>
                      {includeNotes && entry.notes && (
                        <p className="mt-3 text-sm text-gray-500">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-black tracking-widest text-gray-500 uppercase">
            {viewArchived ? "Archived reports" : "Saved reports"}
          </h2>
          <button
            type="button"
            onClick={() => setViewArchived((prev) => !prev)}
            className="text-xs font-semibold text-[#333333] hover:text-[#333333]/70"
          >
            {viewArchived ? "View saved reports" : "View Archive"}
          </button>
        </div>

        {viewArchived && (
          <div className="grid gap-4 rounded-xl border border-gray-100 p-4">
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                  Filter by client
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Type a client name..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-[#9d4edd] outline-none"
                    value={
                      archiveSelectedClient
                        ? archiveSelectedClientLabel
                        : archiveClientSearch
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      setArchiveSelectedClient(null);
                      setArchiveClientSearch(value);
                      if (value.trim().length < 2) {
                        setArchiveClientResults([]);
                      }
                    }}
                    onFocus={() => {
                      if (!archiveSelectedClient)
                        setArchiveClientSearch((prev) => prev);
                    }}
                  />
                  {archiveClientSearch.trim().length >= 2 &&
                    !archiveSelectedClient && (
                      <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-100 bg-white shadow-xl max-h-56 overflow-auto">
                        {archiveClientResults.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-gray-400">
                            No clients found.
                          </div>
                        ) : (
                          archiveClientResults.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setArchiveSelectedClient(client);
                                setArchiveClientSearch("");
                                setArchiveClientResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#333333] hover:bg-gray-50 transition-colors"
                            >
                              {client.business_name ||
                                `${client.first_name || ""} ${
                                  client.surname || ""
                                }`.trim()}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                </div>
                {archiveSelectedClient && (
                  <button
                    type="button"
                    onClick={() => setArchiveSelectedClient(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-[10px] font-semibold text-gray-600"
                  >
                    {archiveSelectedClientLabel || "Client"}
                    <span className="text-red-500">✕</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                From
                <input
                  type="date"
                  value={archiveDateFrom}
                  onChange={(event) => setArchiveDateFrom(event.target.value)}
                  className="mt-2 rounded-xl border border-gray-200 px-3 py-2 text-xs text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
                />
              </div>
              <div className="flex flex-col text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                To
                <input
                  type="date"
                  value={archiveDateTo}
                  onChange={(event) => setArchiveDateTo(event.target.value)}
                  className="mt-2 rounded-xl border border-gray-200 px-3 py-2 text-xs text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
                />
              </div>
              <button
                type="button"
                onClick={resetArchiveFilters}
                className="text-xs font-semibold text-[#333333] hover:text-[#333333]/70"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}

        {loadingSavedReports ? (
          <div className="text-sm text-gray-400 italic">Loading reports...</div>
        ) : viewArchived && filteredArchivedReports.length === 0 ? (
          <div className="text-sm text-gray-400 italic">
            No archived reports yet.
          </div>
        ) : !viewArchived && savedReports.length === 0 ? (
          <div className="text-sm text-gray-400 italic">
            No saved reports yet.
          </div>
        ) : (
          <div className="space-y-3">
            {(viewArchived ? filteredArchivedReports : savedReports).map(
              (report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-4 border border-gray-100 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-[#333333]">
                    {report.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {report.clients?.business_name ||
                      report.clients?.surname ||
                      "Client"}{" "}
                    · {formatDate(report.date_from)} —{" "}
                    {formatDate(report.date_to)}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDuration(report.total_seconds)} · {report.entry_count}{" "}
                  entries
                </div>
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                  <button
                    onClick={() =>
                      router.push(
                        `/va/dashboard/time-tracking/reports/${report.id}`
                      )
                    }
                    className="text-[#9d4edd] hover:underline"
                  >
                    View
                  </button>
                  {viewArchived ? (
                    <button
                      onClick={() => handleUnarchiveReport(report.id)}
                      className="text-gray-500 hover:text-[#333333]"
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArchiveReport(report.id)}
                      className="text-gray-500 hover:text-[#333333]"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
