"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Pencil, X } from "lucide-react";
import { Task } from "./tasks/types";
import { usePrompt } from "@/components/ui/PromptProvider";
import { useClientSession } from "./ClientSessionContext";

type InboxMessage = {
  id: string;
  created_at: string;
  client_id: string;
  type: string;
  message: string;
  is_read: boolean;
  is_completed: boolean;
  clients: {
    first_name: string;
    surname: string;
    business_name: string;
    va_id?: string;
  }[];
};

type CRMClient = {
  id: string;
  first_name: string;
  surname: string;
  business_name: string;
  status: string;
};

type TimeEntry = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
};

const STATUS_OPTIONS = ["Enquiry", "Provisional", "Won", "Lost", "Paused"];

const getTodayDateString = () => new Date().toISOString().split("T")[0];

const getDateKey = (value: string | null) => {
  if (!value) return null;
  return value.includes("T") ? value.split("T")[0] : value;
};

const formatDurationParts = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return {
    hours,
    minutes,
    seconds,
  };
};

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const formatUkDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB");

export default function VADashboard() {
  const { confirm } = usePrompt();
  const { activeSession, isRunning, sessionElapsedSeconds } = useClientSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [agendaDate, setAgendaDate] = useState(getTodayDateString());
  const [todayDate, setTodayDate] = useState(getTodayDateString());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("Enquiry");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [note, setNote] = useState("");
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const welcomeVideoUrl = "/welcome-video.mp4";

  const fetchDashboardData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("welcome_seen")
      .eq("id", user.id)
      .single();

    if (!profileError && profile && profile.welcome_seen === false) {
      setShowWelcome(true);
    }

    const [taskRes, clientRes, messageRes, noteRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, clients!tasks_client_id_fkey(business_name, surname)")
        .eq("va_id", user.id)
        .is("deleted_at", null)
        .order("due_date", { ascending: true }),
      supabase
        .from("clients")
        .select("id, first_name, surname, business_name, status")
        .eq("va_id", user.id)
        .order("surname", { ascending: true }),
      supabase
        .from("client_requests")
        .select(
          "id, created_at, client_id, type, message, is_read, is_completed, clients(first_name, surname, business_name, va_id)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("va_dashboard_notes")
        .select("content, updated_at")
        .eq("va_id", user.id),
    ]);

    if (taskRes.data) setTasks(taskRes.data as Task[]);
    if (clientRes.data) setClients(clientRes.data as CRMClient[]);
    if (messageRes.data) {
      const filtered = (messageRes.data as InboxMessage[]).filter((item) => {
        const client = item.clients?.[0];
        return client?.va_id ? client.va_id === user.id : true;
      });
      setMessages(filtered);
    }
    if (noteRes.data && noteRes.data.length > 0) {
      setNote(noteRes.data[0].content || "");
      setNoteUpdatedAt(noteRes.data[0].updated_at || null);
    }
  }, []);

  const loadTimeEntries = useCallback(
    async (dateValue: string) => {
      if (!userId) return;
      const startIso = new Date(`${dateValue}T00:00:00`).toISOString();
      const endIso = new Date(`${dateValue}T23:59:59.999`).toISOString();
      const { data } = await supabase
        .from("time_entries")
        .select("id, task_id, started_at, ended_at, duration_minutes")
        .eq("va_id", userId)
        .gte("started_at", startIso)
        .lte("started_at", endIso);
      setTimeEntries((data as TimeEntry[]) || []);
    },
    [userId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDashboardData]);

  useEffect(() => {
    const channel = supabase
      .channel("va-dashboard-client-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_requests" },
        () => {
          fetchDashboardData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => {
      loadTimeEntries(todayDate);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadTimeEntries, todayDate, userId]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timeout = nextMidnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      const nextDay = getTodayDateString();
      setTodayDate(nextDay);
      setAgendaDate((prev) => (prev ? prev : nextDay));
    }, timeout);
    return () => clearTimeout(timer);
  }, [todayDate]);

  useEffect(() => {
    document.body.style.overflow = showWelcome ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showWelcome]);

  const overdueTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (!task.due_date) return false;
        const due = getDateKey(task.due_date);
        if (!due) return false;
        return due < agendaDate && task.status !== "completed";
      })
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [agendaDate, tasks]);

  const dayTasks = useMemo(() => {
    const matchesDate = (value: string | null) =>
      getDateKey(value) === agendaDate;

    return tasks
      .filter((task) => {
        if (task.status === "completed") return false;
        if (task.due_date && matchesDate(task.due_date)) return true;
        if (task.scheduled_start && matchesDate(task.scheduled_start))
          return true;
        if (task.scheduled_end && matchesDate(task.scheduled_end)) return true;
        return false;
      })
      .filter((task) => {
        if (!task.due_date) return true;
        const due = getDateKey(task.due_date);
        return !due || due >= agendaDate;
      })
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [agendaDate, tasks]);

  const unreadCount = messages.filter(
    (msg) => !msg.is_read && !msg.is_completed,
  ).length;
  const pendingApprovalCount = messages.filter(
    (msg) => msg.type === "document" && !msg.is_completed,
  ).length;
  const replyNeededCount = messages.filter(
    (msg) => msg.type === "work" && !msg.is_completed,
  ).length;

  const opportunityClients = useMemo(
    () => clients.filter((client) => client.status === selectedStatus),
    [clients, selectedStatus],
  );

  const totalMinutesToday = useMemo(
    () => timeEntries.reduce((sum, entry) => sum + entry.duration_minutes, 0),
    [timeEntries],
  );

  const sessionTodaySeconds = useMemo(() => {
    if (!isRunning || !activeSession) return 0;
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sessionStart = new Date(activeSession.started_at);
    const effectiveStart =
      sessionStart > startOfToday ? sessionStart : startOfToday;
    const seconds = Math.floor((now.getTime() - effectiveStart.getTime()) / 1000);
    return Math.max(0, seconds);
  }, [activeSession, isRunning, sessionElapsedSeconds]);

  const totalSecondsToday = useMemo(() => {
    return Math.max(0, Math.round(totalMinutesToday * 60) + sessionTodaySeconds);
  }, [sessionTodaySeconds, totalMinutesToday]);

  const todayDuration = useMemo(
    () => formatDurationParts(totalSecondsToday),
    [totalSecondsToday],
  );

  const saveNote = async () => {
    if (!userId) return;
    setSavingNote(true);
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("va_dashboard_notes").upsert(
      {
        va_id: userId,
        content: note,
        updated_at: updatedAt,
      },
      { onConflict: "va_id" },
    );
    setSavingNote(false);
    if (!error) {
      setNoteUpdatedAt(updatedAt);
      setIsEditingNote(false);
    }
  };

  const dismissWelcome = async () => {
    if (!userId) return;
    await supabase
      .from("profiles")
      .update({ welcome_seen: true })
      .eq("id", userId);
    setShowWelcome(false);
  };

  const confirmDismissWelcome = async () => {
    const ok = await confirm({
      title: "End video?",
      message: "Are you sure you want to end the video now?",
      confirmLabel: "End video",
      tone: "danger",
    });
    if (ok) await dismissWelcome();
  };

  return (
    <main className="animate-in fade-in duration-500 text-[#333333]">
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200/80 p-4">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <button
              type="button"
              onClick={confirmDismissWelcome}
              className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-500 shadow-sm transition hover:text-gray-800"
              aria-label="Close welcome video"
            >
              <X size={18} />
            </button>
            <div className="px-6 pt-6">
              <h2 className="text-xl font-bold text-[#333333]">
                Welcome to your dashboard
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Quick intro to help you get started.
              </p>
            </div>
            <div className="p-6">
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
                <video
                  src={welcomeVideoUrl}
                  controls
                  className="h-full w-full"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={dismissWelcome}
                  className="rounded-lg bg-[#9d4edd] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-[#7b2cbf]"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="mb-0 text-2xl font-semibold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="text-sm font-medium text-gray-600">
          {formatDateLabel(todayDate)}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="bg-white rounded-2xl shadow-[0_1px_10px_rgba(15,23,42,0.06)] border border-gray-50 overflow-hidden xl:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100/70 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Agenda</h3>
              <p className="text-xs text-gray-500">
                Overdue tasks appear first
              </p>
            </div>
            <input
              type="date"
              value={agendaDate}
              onChange={(event) => setAgendaDate(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#9d4edd] outline-none"
            />
          </div>
          <div className="p-6 space-y-5 min-h-80">
            {overdueTasks.length === 0 && dayTasks.length === 0 ? (
              <div className="text-sm text-gray-400 italic text-center py-10">
                Nothing scheduled for this day yet.
              </div>
            ) : (
              <>
                {overdueTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2.5">
                      Overdue
                    </p>
                    <div className="space-y-2">
                      {overdueTasks.map((task) => (
                        <Link
                          key={task.id}
                          href={`/va/dashboard/tasks?taskId=${task.id}`}
                          className="block rounded-xl border border-rose-100/70 bg-rose-50/30 px-4 py-2.5 hover:border-rose-200/80 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {task.task_name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {task.clients?.surname ||
                                  task.clients?.business_name ||
                                  "Internal"}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-rose-500">
                              Due {formatUkDate(task.due_date || "")}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {dayTasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2.5">
                      {formatDateLabel(agendaDate)}
                    </p>
                    <div className="space-y-2">
                      {dayTasks.map((task) => (
                        <Link
                          key={task.id}
                          href={`/va/dashboard/tasks?taskId=${task.id}`}
                          className="block rounded-xl border border-gray-100 bg-white px-4 py-2.5 hover:border-gray-200 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {task.task_name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {task.clients?.surname ||
                                  task.clients?.business_name ||
                                  "Internal"}
                              </p>
                            </div>
                            {task.due_date && (
                              <span className="text-[10px] font-semibold text-gray-500">
                                Due {formatUkDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-[0_1px_10px_rgba(15,23,42,0.06)] border border-gray-50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100/70">
            <h3 className="text-sm font-semibold text-gray-900">
              Priority Inbox
            </h3>
            <p className="text-xs text-gray-500">
              Unread, approvals, and action-needed
            </p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
              <span>Unread messages</span>
              <span
                className={
                  unreadCount > 0 ? "text-red-600" : "text-gray-700"
                }
              >
                {unreadCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
              <span>Pending approvals</span>
              <span
                className={
                  pendingApprovalCount > 0 ? "text-red-600" : "text-gray-700"
                }
              >
                {pendingApprovalCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
              <span>Client replies needing action</span>
              <span
                className={
                  replyNeededCount > 0 ? "text-red-600" : "text-gray-700"
                }
              >
                {replyNeededCount}
              </span>
            </div>
            <Link
              href="/va/dashboard/inbox"
              className="inline-flex items-center justify-center w-full mt-4 text-xs font-bold tracking-widest text-gray-600 border border-gray-200 rounded-lg py-2 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Open Inbox
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <section className="bg-white rounded-2xl shadow-[0_1px_10px_rgba(15,23,42,0.06)] border border-gray-50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100/70 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Opportunity Status
              </h3>
              <p className="text-xs text-gray-500">
                Clients at this pipeline stage
              </p>
            </div>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 focus:ring-2 focus:ring-[#9d4edd] outline-none"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="p-6 space-y-2 min-h-55">
            {opportunityClients.length === 0 ? (
              <div className="text-sm text-gray-400 italic text-center py-10">
                No clients in this status.
              </div>
            ) : (
              opportunityClients.slice(0, 5).map((client) => (
                <Link
                  key={client.id}
                  href={`/va/dashboard/crm/profile/${client.id}`}
                  className="block rounded-xl border border-gray-100 px-4 py-2.5 hover:border-gray-200 transition-colors"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {client.first_name} {client.surname}
                  </p>
                  <p className="text-xs text-gray-500">
                    {client.business_name || "No business name"}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-[0_1px_10px_rgba(15,23,42,0.06)] border border-gray-50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100/70">
            <h3 className="text-sm font-semibold text-gray-900">Time Today</h3>
            <p className="text-xs text-gray-500">
              {formatDateLabel(todayDate)}
            </p>
          </div>
          <div className="p-6 space-y-4 min-h-55 flex flex-col">
            <div className="text-4xl font-semibold text-gray-900 flex items-baseline gap-2">
              <span>
                {todayDuration.hours}h{" "}
                {String(todayDuration.minutes).padStart(2, "0")}m
              </span>
              <span className="text-lg font-semibold text-gray-500">
                {String(todayDuration.seconds).padStart(2, "0")}s
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Based on entries logged in Time Tracking.
            </p>
            <Link
              href="/va/dashboard/time-tracking"
              className="mt-auto inline-flex items-center justify-center w-full text-xs font-bold tracking-widest text-gray-600 border border-gray-200 rounded-lg py-2 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Open Time Tracking
            </Link>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-[0_1px_10px_rgba(15,23,42,0.06)] border border-gray-50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100/70">
            <h3 className="text-sm font-semibold text-gray-900">
              Quick Add Notes
            </h3>
            <p className="text-xs text-gray-500">
              Brain dump sticky note for later
            </p>
          </div>
          <div className="p-6 space-y-4 min-h-55 flex flex-col relative">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Jot anything down..."
              readOnly={!isEditingNote}
              className={`flex-1 w-full rounded-xl border p-4 text-sm text-gray-800 outline-none resize-none transition-colors ${
                isEditingNote
                  ? "border-gray-200 focus:ring-2 focus:ring-[#9d4edd]"
                  : "border-gray-100 bg-gray-50 text-gray-500"
              }`}
            />
            <button
              type="button"
              onClick={() => setIsEditingNote(true)}
              className="absolute bottom-20 right-8 w-9 h-9 rounded-full bg-[#9d4edd] text-white flex items-center justify-center shadow-sm hover:bg-[#7b2cbf] transition-colors"
              title="Edit note"
            >
              <Pencil size={16} />
            </button>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {noteUpdatedAt
                  ? `Last saved ${new Date(noteUpdatedAt).toLocaleTimeString()}`
                  : "Not saved yet"}
              </span>
              <button
                onClick={saveNote}
                disabled={savingNote || !isEditingNote}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest transition-colors ${
                  savingNote || !isEditingNote
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                }`}
              >
                {savingNote ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
