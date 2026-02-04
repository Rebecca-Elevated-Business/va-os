"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";
import ClientTaskBoard from "./ClientTaskBoard";
import ClientTaskModal, { type ClientTask } from "./ClientTaskModal";
import { format } from "date-fns";

type Agreement = {
  id: string;
  title: string;
  status: string;
  last_updated_at: string;
};
type ClientDocument = {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
};
type ClientNotification = {
  id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

type PortalTabId = "documents" | "agreements" | "tasks" | "requests";

const PORTAL_TABS: { id: PortalTabId; label: string }[] = [
  { id: "documents", label: "Document Vault" },
  { id: "agreements", label: "Service Agreements" },
  { id: "tasks", label: "Task Board" },
  { id: "requests", label: "Request Centre" },
];

const TASK_STATUS_FILTERS = [
  { id: "todo", label: "To Do" },
  { id: "up_next", label: "Up Next" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

export default function ClientDashboard() {
  const router = useRouter();
  const { alert } = usePrompt();
  const [loading, setLoading] = useState(true);

  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [clientNotifications, setClientNotifications] = useState<
    ClientNotification[]
  >([]);
  const [activeTab, setActiveTab] = useState<PortalTabId>("documents");
  const [allowedTabs, setAllowedTabs] = useState<PortalTabId[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>(
    TASK_STATUS_FILTERS.map((status) => status.id),
  );

  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [vaId, setVaId] = useState<string | null>(null);

  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

  const [requestType, setRequestType] = useState<"work" | "meeting">("work");
  const [requestMessage, setRequestMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<ClientTask | null>(null);
  const alertMenuRef = useRef<HTMLDivElement | null>(null);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);

  const fetchTasks = useCallback(async (clientIdValue: string) => {
    const { data } = await supabase
      .from("tasks")
      .select(
        "id, task_name, details, status, client_id, shared_with_client, created_by_client, client_deleted_at",
      )
      .eq("client_id", clientIdValue)
      .eq("shared_with_client", true)
      .is("deleted_at", null)
      .is("client_deleted_at", null)
      .order("created_at", { ascending: false });
    const normalized = ((data as ClientTask[]) || []).map((task) => ({
      ...task,
      status: task.status || "todo",
    }));
    setTasks(normalized);
  }, []);

  const fetchNotifications = useCallback(async (clientIdValue: string) => {
    const { data } = await supabase
      .from("client_notifications")
      .select("id, message, type, is_read, created_at")
      .eq("client_id", clientIdValue)
      .order("created_at", { ascending: false })
      .limit(20);
    setClientNotifications((data as ClientNotification[]) || []);
  }, []);

  useEffect(() => {
    async function loadClientData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/client/login");
        return;
      }

      setDebugInfo(`Logged in as Auth User: ${user.id}`);

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, first_name, surname, va_id, portal_tabs_enabled")
        .eq("auth_user_id", user.id)
        .single();

      if (clientError) {
        console.error("Client Fetch Error:", clientError);
        setDebugInfo(
          `ERROR: Could not find Client Record linked to Auth ID ${user.id}. DB says: ${clientError.message}`
        );
      } else if (client) {
        setClientName(client.first_name);
        setClientId(client.id);
        setVaId(client.va_id || null);
        const tabsEnabled = (client.portal_tabs_enabled || []) as PortalTabId[];
        setAllowedTabs(tabsEnabled);
        setDebugInfo(
          `SUCCESS: Linked to Client ID: ${client.id} (${client.first_name})`
        );

        if (tabsEnabled.includes("agreements")) {
          const { data: ags } = await supabase
            .from("client_agreements")
            .select("id, title, status, last_updated_at")
            .eq("client_id", client.id)
            .neq("status", "draft")
            .order("last_updated_at", { ascending: false });
          if (ags) setAgreements(ags as Agreement[]);
        } else {
          setAgreements([]);
        }

        if (tabsEnabled.includes("documents")) {
          const { data: docs } = await supabase
            .from("client_documents")
            .select("*")
            .eq("client_id", client.id)
            .neq("status", "draft")
            .order("created_at", { ascending: false });
          if (docs) setDocuments(docs as ClientDocument[]);
        } else {
          setDocuments([]);
        }

        if (tabsEnabled.includes("tasks")) {
          await fetchTasks(client.id);
        } else {
          setTasks([]);
        }
        await fetchNotifications(client.id);
      } else {
        setDebugInfo(`WARNING: No client record found for Auth ID ${user.id}`);
      }
      setLoading(false);
    }
    loadClientData();
  }, [router, fetchTasks, fetchNotifications]);

  useEffect(() => {
    if (!clientId) return;
    const notifChannel = supabase
      .channel(`client-notifications-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_notifications",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          void fetchNotifications(clientId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [clientId, fetchNotifications]);

  useEffect(() => {
    if (!clientId || !allowedTabs.includes("tasks")) return;
    const taskChannel = supabase
      .channel(`client-tasks-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          void fetchTasks(clientId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
    };
  }, [allowedTabs, clientId, fetchTasks]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      await alert({
        title: "Unable to send request",
        message: `STOP: Cannot send. System does not know your Client ID.\nDebug Info: ${debugInfo}`,
        tone: "danger",
      });
      return;
    }

    if (!requestMessage.trim()) return;

    setSending(true);

    const { error } = await supabase.from("client_requests").insert([
      {
        client_id: clientId,
        type: requestType,
        message: requestMessage,
        status: "new",
        is_read: false,
        is_completed: false,
        is_starred: false,
      },
    ]);

    setSending(false);

    if (error) {
      await alert({
        title: "Database error",
        message: `DATABASE ERROR: ${error.message}\nCode: ${error.code}`,
        tone: "danger",
      });
      console.error("Insert Error:", error);
    } else {
      await alert({
        title: "Request sent",
        message: "Thank you. Your VA will be notified of your message.",
      });
      setRequestMessage("");
    }
  };

  const openNewTaskModal = () => {
    if (!clientId) return;
    setActiveTask(null);
    setTaskModalOpen(true);
  };

  const openTaskModal = (task: ClientTask) => {
    if (!clientId) return;
    setActiveTask(task);
    setTaskModalOpen(true);
  };

  const ensureClientReady = () => Boolean(clientId && vaId);

  const notifyVa = async (payload: {
    client_id: string;
    type: string;
    message: string;
    status: string;
    is_read: boolean;
    is_completed: boolean;
    is_starred: boolean;
    task_id?: string | null;
  }) => {
    const { error } = await supabase.from("client_requests").insert([payload]);
    if (error) {
      await alert({
        title: "Notification failed",
        message: `Your task was saved, but we couldn't notify your VA.\nError: ${error.message}`,
        tone: "danger",
      });
      console.error("client_requests insert error:", error);
      return false;
    }
    return true;
  };

  const toggleStatusFilter = (statusId: string) => {
    setVisibleStatuses((prev) => {
      if (prev.includes(statusId)) {
        if (prev.length === 1) return prev;
        return prev.filter((status) => status !== statusId);
      }
      return [...prev, statusId];
    });
  };

  const resetStatusFilters = () => {
    setVisibleStatuses(TASK_STATUS_FILTERS.map((status) => status.id));
  };

  const createTask = async (payload: {
    task_name: string;
    details: string | null;
    status: string;
  }) => {
    if (!ensureClientReady()) return;
    const safeClientId = clientId;
    const safeVaId = vaId;
    if (!safeClientId || !safeVaId) return;
    const { data: createdTask, error } = await supabase
      .from("tasks")
      .insert([
        {
          client_id: safeClientId,
          va_id: safeVaId,
          task_name: payload.task_name,
          details: payload.details,
          status: payload.status,
          is_completed: payload.status === "completed",
          total_minutes: 0,
          is_running: false,
          shared_with_client: true,
          created_by_client: true,
        },
      ])
      .select("id")
      .single();
    if (error) {
      await alert({
        title: "Task not created",
        message: error.message,
        tone: "danger",
      });
      return;
    }
    await notifyVa({
      client_id: safeClientId,
      type: "task_created",
      message: `Task created: ${clientName || "Client"} added "${payload.task_name}"`,
      status: "new",
      is_read: false,
      is_completed: false,
      is_starred: false,
      task_id: createdTask?.id ?? null,
    });
    await fetchTasks(safeClientId);
  };

  const markNotificationRead = async (notificationId: string) => {
    await supabase.rpc("mark_notification_read", {
      notification_id: notificationId,
    });
    setClientNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n,
      ),
    );
  };

  const markAllAlertsRead = async () => {
    const unreadIds = alertNotifications
      .filter((note) => !note.is_read)
      .map((note) => note.id);
    if (unreadIds.length === 0) return;
    await Promise.all(
      unreadIds.map((notificationId) =>
        supabase.rpc("mark_notification_read", {
          notification_id: notificationId,
        }),
      ),
    );
    setClientNotifications((prev) =>
      prev.map((note) =>
        unreadIds.includes(note.id) ? { ...note, is_read: true } : note,
      ),
    );
  };

  const filteredTasks = tasks.filter((task) =>
    visibleStatuses.includes(task.status),
  );

  const alertNotifications = clientNotifications.filter(
    (note) => !note.type?.toLowerCase().includes("task"),
  );
  const unreadAlertCount = alertNotifications.filter((note) => !note.is_read)
    .length;
  const visibleTabs = PORTAL_TABS.filter((tab) =>
    allowedTabs.includes(tab.id),
  );
  const safeActiveTab = allowedTabs.includes(activeTab)
    ? activeTab
    : allowedTabs[0];

  useEffect(() => {
    if (!alertsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!alertMenuRef.current) return;
      if (!alertMenuRef.current.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAlertsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [alertsOpen]);

  useEffect(() => {
    if (!statusFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!statusFilterRef.current) return;
      if (!statusFilterRef.current.contains(event.target as Node)) {
        setStatusFilterOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStatusFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [statusFilterOpen]);

  if (loading)
    return (
      <div className="p-10 text-gray-500 italic">Loading your portal...</div>
    );

  if (allowedTabs.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-10 text-black font-sans">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Welcome, {clientName || "Client"}
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all shadow-sm"
            >
              Sign Out
            </button>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-black text-gray-800">
              Portal access not enabled
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Your VA has not enabled any portal areas yet. Please contact your
              VA if you believe this is a mistake.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10 text-black font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Welcome, {clientName || "Client"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={alertMenuRef}>
              <button
                type="button"
                onClick={() => setAlertsOpen((prev) => !prev)}
                className="relative rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:text-[#9d4edd] shadow-sm transition-all"
                aria-label="View alerts"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-[#9d4edd] px-1 text-[10px] font-bold text-white">
                    {unreadAlertCount}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-100 bg-white shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 flex items-center justify-between gap-2">
                    <span>Alerts</span>
                    <button
                      type="button"
                      onClick={markAllAlertsRead}
                      className="text-[11px] font-semibold text-[#9d4edd] hover:text-[#7b2cbf]"
                    >
                      Mark all as read
                    </button>
                  </div>
                  {alertNotifications.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-gray-400">
                      No alerts yet.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto">
                      {alertNotifications.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => markNotificationRead(note.id)}
                          className={`w-full text-left px-4 py-3 text-xs transition-colors ${
                            note.is_read
                              ? "text-gray-500 hover:bg-gray-50"
                              : "text-gray-900 bg-purple-50/50 hover:bg-purple-50"
                          }`}
                        >
                          <div className="font-semibold">{note.message}</div>
                          <div className="mt-1 text-[10px] text-gray-400">
                            {format(new Date(note.created_at), "d MMM, HH:mm")}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        {alertNotifications.length > 0 && (
          <div className="rounded-3xl border border-purple-100 bg-purple-50/40 px-6 py-4">
            <div className="text-xs font-semibold text-[#9d4edd]">
              Latest alerts
            </div>
            <div className="mt-3 space-y-2">
              {alertNotifications.slice(0, 3).map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between gap-4 text-sm text-gray-700"
                >
                  <span className="font-medium">{note.message}</span>
                  <span className="text-[11px] text-gray-400">
                    {format(new Date(note.created_at), "d MMM, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap gap-2 text-sm font-semibold text-gray-500">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 transition-colors ${
                  safeActiveTab === tab.id
                    ? "bg-[#9d4edd] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {allowedTabs.includes("documents") && (
          <section
            className={`bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden ${
              safeActiveTab === "documents" ? "block" : "hidden"
            }`}
          >
          <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-[#9d4edd]">
                Document Vault
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Access your issued proposals, contracts, and invoices.
              </p>
            </div>
            <div className="text-2xl" />
          </div>

          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-gray-400 border-b border-gray-50 bg-gray-50/30">
                  <th className="px-8 py-4 font-black">Document Name</th>
                  <th className="px-8 py-4 font-black">Type</th>
                  <th className="px-8 py-4 font-black">Status</th>
                  <th className="px-8 py-4 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-10 text-center text-gray-400 italic text-sm"
                    >
                      No documents available yet.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-8 py-5 font-bold text-sm">
                        {doc.title}
                      </td>
                      <td className="px-8 py-5 capitalize text-xs text-gray-500 font-medium">
                        {doc.type.replace("_", " ")}
                      </td>
                      <td className="px-8 py-5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                            doc.status === "paid" || doc.status === "signed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {doc.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() =>
                            router.push(`/client/documents/view/${doc.id}`)
                          }
                          className="bg-gray-900 text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-[#9d4edd] transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </section>
        )}

        {allowedTabs.includes("agreements") && (
          <section
            className={`bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden ${
              safeActiveTab === "agreements" ? "block" : "hidden"
            }`}
          >
          <div className="p-8 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-black text-gray-800">
              Service Agreements
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Access and agree workflows with your VA
            </p>
          </div>

          {agreements.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic text-sm">
              You have no active service agreements at this time.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agreements.map((ag) => (
                <div
                  key={ag.id}
                  className="p-8 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 text-[#9d4edd] w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner">
                      📄
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{ag.title}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Review your workflow details and authorise when ready.
                      </p>
                    </div>
                  </div>
                  <button
                    className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#7b2cbf] transition-all"
                    onClick={() =>
                      router.push(
                        `/client/workflows/portal-view/${ag.id}`,
                      )
                    }
                  >
                    {ag.status === "pending_client"
                      ? "Review & Sign"
                      : "View Agreement"}
                  </button>
                </div>
              ))}
            </div>
          )}
          </section>
        )}

        {allowedTabs.includes("tasks") && (
          <section
            className={`bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden ${
              safeActiveTab === "tasks" ? "block" : "hidden"
            }`}
          >
          <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-[#9d4edd]">Task Board</h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Track shared work with your VA.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative" ref={statusFilterRef}>
                <button
                  onClick={() => setStatusFilterOpen((prev) => !prev)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300"
                >
                  Filter by status
                </button>
                {statusFilterOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-lg p-4 z-10">
                    <p className="text-[10px] font-black text-gray-400 tracking-widest mb-3">
                      Visible statuses
                    </p>
                    <div className="space-y-2">
                      {TASK_STATUS_FILTERS.map((status) => {
                        const checked = visibleStatuses.includes(status.id);
                        return (
                          <label
                            key={status.id}
                            className="flex items-center gap-2 text-xs font-semibold text-gray-700"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
                              checked={checked}
                              onChange={() => toggleStatusFilter(status.id)}
                            />
                            <span
                              className={`px-2 py-1 rounded-full border text-[10px] font-bold ${
                                checked
                                  ? "border-[#9d4edd] text-[#9d4edd] bg-purple-50"
                                  : "border-gray-200 text-gray-500"
                              }`}
                            >
                              {status.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <button
                      onClick={resetStatusFilters}
                      className="mt-3 text-[10px] font-bold text-gray-400 hover:text-gray-600"
                    >
                      Show all statuses
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={openNewTaskModal}
                className="px-4 py-2 text-xs font-bold text-white bg-[#9d4edd] rounded-lg shadow-sm hover:bg-[#7b2cbf]"
              >
                Add Task
              </button>
            </div>
          </div>
          <div className="p-6">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400 italic text-sm">
                No shared tasks yet.
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400 italic text-sm">
                No tasks match your current filters.
              </div>
            ) : (
              <ClientTaskBoard
                tasks={filteredTasks}
                onOpenTask={openTaskModal}
                visibleStatuses={visibleStatuses}
              />
            )}
          </div>
          </section>
        )}

        {allowedTabs.includes("requests") && (
          <section
            className={`bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden ${
              safeActiveTab === "requests" ? "block" : "hidden"
            }`}
          >
          <div className="p-8 border-b border-gray-100 bg-blue-50/30">
            <h2 className="text-lg font-black text-gray-800">
              Request Centre
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Send a direct work or meeting request to your VA.
            </p>
          </div>

          <div className="p-8">
            <div className="flex gap-6 mb-6">
              <label
                className={`flex-1 cursor-pointer border-2 rounded-2xl p-4 text-center transition-all ${
                  requestType === "work"
                    ? "border-[#9d4edd] bg-purple-50 text-[#9d4edd]"
                    : "border-gray-100 text-gray-400 hover:border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={requestType === "work"}
                  onChange={() => setRequestType("work")}
                />
                <span className="font-black text-xs tracking-widest">
                  Request Work
                </span>
              </label>
              <label
                className={`flex-1 cursor-pointer border-2 rounded-2xl p-4 text-center transition-all ${
                  requestType === "meeting"
                    ? "border-[#9d4edd] bg-purple-50 text-[#9d4edd]"
                    : "border-gray-100 text-gray-400 hover:border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={requestType === "meeting"}
                  onChange={() => setRequestType("meeting")}
                />
                <span className="font-black text-xs tracking-widest">
                  Request Meeting
                </span>
              </label>
            </div>

            <form
              onSubmit={handleSendRequest}
              className="flex gap-4 items-start"
            >
              <textarea
                className="flex-1 border-2 border-gray-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-purple-50 focus:border-[#9d4edd] bg-gray-50 min-h-24 transition-all"
                placeholder={
                  requestType === "work"
                    ? "Describe the task you need help with..."
                    : "Propose a date and time for a meeting, and summary of what you'd like to discuss."
                }
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={!requestMessage || sending}
                className="bg-[#9d4edd] text-white px-8 py-3 rounded-2xl font-black text-xs shadow-xl shadow-purple-100 hover:bg-[#7b2cbf] h-24 disabled:opacity-50 tracking-widest transition-all"
              >
                {sending ? "Sending..." : "Send Request"}
              </button>
            </form>
          </div>
        </section>
        )}

        <ClientTaskModal
          key={`${activeTask?.id || "new"}-${taskModalOpen ? "open" : "closed"}`}
          isOpen={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          task={activeTask}
          clientId={clientId || ""}
          clientName={clientName || "Client"}
          onCreate={createTask}
        />
      </div>
    </main>
  );
}
