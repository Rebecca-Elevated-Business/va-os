"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";
import ClientTaskBoard from "./ClientTaskBoard";
import ClientTaskModal, { type ClientTask } from "./ClientTaskModal";
import { format } from "date-fns";

// Define strict types for the dashboard
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

const STATUS_OPTIONS = [
  { id: "todo", label: "To Do" },
  { id: "up_next", label: "Up Next" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

export default function ClientDashboard() {
  const router = useRouter();
  const { alert } = usePrompt();
  const [loading, setLoading] = useState(true);

  // Data State
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [clientNotifications, setClientNotifications] = useState<
    ClientNotification[]
  >([]);

  // Dashboard Logic State
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [vaId, setVaId] = useState<string | null>(null);

  // DEBUG STATE
  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

  // Request Form State
  const [requestType, setRequestType] = useState<"work" | "meeting">("work");
  const [requestMessage, setRequestMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Task Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<ClientTask | null>(null);
  const [taskModalStatus, setTaskModalStatus] = useState("todo");

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
      // 1. Get the current logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/client/login");
        return;
      }

      setDebugInfo(`Logged in as Auth User: ${user.id}`);

      // 2. Find the CRM Client record linked to this Login ID
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, first_name, surname, va_id")
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
        setDebugInfo(
          `SUCCESS: Linked to Client ID: ${client.id} (${client.first_name})`
        );

        // 3. Fetch Agreements
        const { data: ags } = await supabase
          .from("client_agreements")
          .select("id, title, status, last_updated_at")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("last_updated_at", { ascending: false });

        if (ags) setAgreements(ags as Agreement[]);

        // 4. Fetch Documents
        const { data: docs } = await supabase
          .from("client_documents")
          .select("*")
          .eq("client_id", client.id)
          .neq("status", "draft")
          .order("created_at", { ascending: false });

        if (docs) setDocuments(docs as ClientDocument[]);

        // 5. Fetch Tasks + Notifications
        await Promise.all([
          fetchTasks(client.id),
          fetchNotifications(client.id),
        ]);
      } else {
        setDebugInfo(`WARNING: No client record found for Auth ID ${user.id}`);
      }
      setLoading(false);
    }
    loadClientData();
  }, [router, fetchTasks, fetchNotifications]);

  useEffect(() => {
    if (!clientId) return;
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
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [clientId, fetchTasks, fetchNotifications]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // DEBUG: Alert if ID is missing
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

    // FIX: Removed 'data' variable since we don't use it
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

  const openNewTaskModal = (status: string) => {
    if (!clientId) return;
    setActiveTask(null);
    setTaskModalStatus(status);
    setTaskModalOpen(true);
  };

  const openTaskModal = (task: ClientTask) => {
    if (!clientId) return;
    setActiveTask(task);
    setTaskModalStatus(task.status || "todo");
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

  const updateTask = async (
    taskId: string,
    payload: { task_name: string; details: string | null },
  ) => {
    if (!ensureClientReady()) return;
    const safeClientId = clientId;
    if (!safeClientId) return;
    const { error } = await supabase
      .from("tasks")
      .update({
        task_name: payload.task_name,
        details: payload.details,
      })
      .eq("id", taskId);
    if (error) {
      await alert({
        title: "Task not updated",
        message: error.message,
        tone: "danger",
      });
      return;
    }
    await notifyVa({
      client_id: safeClientId,
      type: "task_updated",
      message: `Task updated: ${clientName || "Client"} updated "${payload.task_name}"`,
      status: "new",
      is_read: false,
      is_completed: false,
      is_starred: false,
      task_id: taskId,
    });
    await fetchTasks(safeClientId);
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    if (!ensureClientReady()) return;
    const safeClientId = clientId;
    if (!safeClientId) return;
    const task = tasks.find((t) => t.id === taskId);
    const { error } = await supabase
      .from("tasks")
      .update({ status, is_completed: status === "completed" })
      .eq("id", taskId);
    if (error) {
      await alert({
        title: "Status not updated",
        message: error.message,
        tone: "danger",
      });
      return;
    }
    await notifyVa({
      client_id: safeClientId,
      type: "work",
      message: `Task status changed: ${clientName || "Client"} set "${task?.task_name || "Task"}" to ${status}`,
      status: "new",
      is_read: false,
      is_completed: false,
      is_starred: false,
      task_id: taskId,
    });
    if (task) {
      await supabase.from("task_activity").insert([
        {
          task_id: task.id,
          actor_type: "client",
          actor_id: safeClientId,
          action: "status_changed",
          meta: { to: status },
        },
      ]);
    }
    await fetchTasks(safeClientId);
  };

  const deleteTask = async (taskId: string) => {
    if (!ensureClientReady()) return;
    const safeClientId = clientId;
    if (!safeClientId) return;
    const task = tasks.find((t) => t.id === taskId);
    const { error } = await supabase
      .from("tasks")
      .update({
        client_deleted_at: new Date().toISOString(),
        client_deleted_by: safeClientId,
      })
      .eq("id", taskId);
    if (error) {
      await alert({
        title: "Task not deleted",
        message: error.message,
        tone: "danger",
      });
      return;
    }
    await notifyVa({
      client_id: safeClientId,
      type: "work",
      message: `Task deleted: ${clientName || "Client"} removed "${task?.task_name || "Task"}"`,
      status: "new",
      is_read: false,
      is_completed: false,
      is_starred: false,
      task_id: taskId,
    });
    if (task) {
      await supabase.from("task_activity").insert([
        {
          task_id: task.id,
          actor_type: "client",
          actor_id: safeClientId,
          action: "task_deleted",
        },
      ]);
    }
    await fetchTasks(safeClientId);
  };

  const markNotificationRead = async (notificationId: string) => {
    await supabase
      .from("client_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    setClientNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n,
      ),
    );
  };

  if (loading)
    return (
      <div className="p-10 text-gray-500 italic">Loading your portal...</div>
    );

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10 text-black font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Diagnostic bar removed */}

        {/* Header Section */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Welcome, {clientName || "Client"}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg bg-white transition-all shadow-sm"
          >
            Sign Out
          </button>
        </div>

        {/* SECTION 1: TASK BOARD */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-[#9d4edd] uppercase tracking-wide">
                Task Board
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Track shared work with your VA.
              </p>
            </div>
            <button
              onClick={() => openNewTaskModal("todo")}
              className="px-4 py-2 text-xs font-bold text-white bg-[#9d4edd] rounded-lg shadow-sm hover:bg-[#7b2cbf]"
            >
              Add Task
            </button>
          </div>
          <div className="p-6">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400 italic text-sm">
                No shared tasks yet.
              </div>
            ) : (
              <ClientTaskBoard
                tasks={tasks}
                onOpenTask={openTaskModal}
                onAddTask={openNewTaskModal}
                onStatusChange={updateTaskStatus}
              />
            )}
          </div>
        </section>

        {/* SECTION 2: NOTIFICATIONS */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-[#333333] uppercase tracking-wide">
                Notifications
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Updates from your VA.
              </p>
            </div>
          </div>
          <div className="p-6">
            {clientNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 italic text-sm">
                No updates yet.
              </div>
            ) : (
              <div className="space-y-3">
                {clientNotifications.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => markNotificationRead(note.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      note.is_read
                        ? "border-gray-100 bg-white text-gray-500"
                        : "border-purple-100 bg-purple-50/40 text-[#333333]"
                    }`}
                  >
                    <div className="text-xs font-bold">{note.message}</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {format(new Date(note.created_at), "d MMM, HH:mm")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: DOCUMENT VAULT */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-purple-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-[#9d4edd] uppercase tracking-wide">
                Document Vault
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Access your issued proposals, contracts, and invoices.
              </p>
            </div>
            <div className="text-2xl">📂</div>
          </div>

          <div className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400 border-b border-gray-50 bg-gray-50/30">
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
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            doc.status === "paid" || doc.status === "signed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() =>
                            router.push(`/client/documents/view/${doc.id}`)
                          }
                          className="bg-gray-900 text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-[#9d4edd] transition-colors uppercase tracking-wider"
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

        {/* SECTION 2: SERVICE AGREEMENTS */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">
              Operational Agreements
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Authorised rules of engagement and service parameters.
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
                        Status:{" "}
                        <span
                          className={`uppercase font-black tracking-wider ${
                            ag.status === "active"
                              ? "text-green-600"
                              : "text-[#9d4edd]"
                          }`}
                        >
                          {ag.status.replace("_", " ")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#7b2cbf] transition-all uppercase tracking-wider"
                      onClick={() =>
                        router.push(
                          `/va/dashboard/workflows/portal-view/${ag.id}`
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

        {/* SECTION 3: REQUEST CENTRE (Updated with Real Logic) */}
        <section className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-blue-50/30">
            <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">
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
                <span className="font-black text-xs uppercase tracking-widest">
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
                <span className="font-black text-xs uppercase tracking-widest">
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
                    : "Propose a date and time for a quick sync..."
                }
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={!requestMessage || sending}
                className="bg-[#9d4edd] text-white px-8 py-3 rounded-2xl font-black text-xs shadow-xl shadow-purple-100 hover:bg-[#7b2cbf] h-24 disabled:opacity-50 uppercase tracking-widest transition-all"
              >
                {sending ? "Sending..." : "Send Request"}
              </button>
            </form>
          </div>
        </section>

        <ClientTaskModal
          key={`${activeTask?.id || "new"}-${taskModalStatus}-${taskModalOpen ? "open" : "closed"}`}
          isOpen={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          task={activeTask}
          defaultStatus={taskModalStatus}
          clientId={clientId || ""}
          clientName={clientName || "Client"}
          statusOptions={STATUS_OPTIONS}
          onCreate={createTask}
          onUpdate={updateTask}
          onStatusChange={updateTaskStatus}
          onDelete={deleteTask}
        />
      </div>
    </main>
  );
}
