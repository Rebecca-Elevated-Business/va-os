"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ReportEntry = {
  id: string;
  entry_date: string;
  task_title: string;
  duration_seconds: number;
  notes: string | null;
};

type ReportDetail = {
  id: string;
  name: string;
  client_id: string;
  date_from: string;
  date_to: string;
  total_seconds: number;
  entry_count: number;
  created_at: string;
  clients: {
    business_name: string | null;
    surname: string | null;
  } | null;
};

type ReportDetailRow = Omit<ReportDetail, "clients"> & {
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

export default function TimeReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      const { data: reportData } = await supabase
        .from("time_reports")
        .select(
          "id, name, client_id, date_from, date_to, total_seconds, entry_count, created_at, clients(business_name, surname)"
        )
        .eq("id", id)
        .single();
      if (reportData) {
        const row = reportData as ReportDetailRow;
        const clients = Array.isArray(row.clients)
          ? row.clients[0] || null
          : row.clients;
        setReport({ ...row, clients });
      }

      const { data: entryData } = await supabase
        .from("time_report_entries")
        .select("id, entry_date, task_title, duration_seconds, notes")
        .eq("report_id", id)
        .order("entry_date", { ascending: false });
      setEntries((entryData as ReportEntry[]) || []);
      setLoading(false);
    }
    loadReport();
  }, [id]);

  if (loading) {
    return <div className="text-gray-400 italic">Loading report...</div>;
  }

  if (!report) {
    return <div className="text-red-500 font-bold">Report not found.</div>;
  }

  return (
    <div className="min-h-screen text-[#333333] pb-20 font-sans">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{report.name}</h1>
          <p className="text-sm text-gray-400">
            {report.clients?.business_name ||
              report.clients?.surname ||
              "Client"}{" "}
            · {formatDate(report.date_from)} — {formatDate(report.date_to)}
          </p>
        </div>
        <Link
          href="/va/dashboard/time-tracking/reports"
          className="text-sm font-semibold text-gray-400 hover:text-[#9d4edd]"
        >
          Back to reports
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-4 mb-6">
        <div className="rounded-xl border border-gray-100 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase text-gray-400">
            Total time
          </p>
          <p className="text-lg font-black text-[#333333]">
            {formatDuration(report.total_seconds)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase text-gray-400">
            Entries
          </p>
          <p className="text-lg font-black text-[#333333]">
            {report.entry_count}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase text-gray-400">
            Date range
          </p>
          <p className="text-sm font-semibold text-[#333333]">
            {formatDate(report.date_from)} — {formatDate(report.date_to)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase text-gray-400">
            Created
          </p>
          <p className="text-sm font-semibold text-[#333333]">
            {formatDateTime(report.created_at)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-black tracking-widest text-gray-500 uppercase">
          Entries
        </h2>
        {entries.length === 0 ? (
          <div className="text-sm text-gray-400 italic">
            No entries found in this report.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
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
              {entry.notes && (
                <p className="mt-3 text-sm text-gray-500">{entry.notes}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
