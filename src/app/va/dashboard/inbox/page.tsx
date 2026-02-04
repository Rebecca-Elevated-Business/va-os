"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Inbox,
  RotateCcw,
  Settings,
  Star,
} from "lucide-react";
import { usePrompt } from "@/components/ui/PromptProvider";

type InboxMessage = {
  id: string;
  created_at: string;
  client_id: string;
  type: string;
  message: string;
  is_starred: boolean;
  is_completed: boolean;
  is_read: boolean;
  task_id?: string | null;
  tasks?: {
    task_name: string;
    details: string | null;
  } | null;
  clients: {
    first_name: string;
    surname: string;
    business_name: string;
  };
};

export default function VAInboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "starred" | "completed">(
    "inbox",
  );
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const [deleteAllStep, setDeleteAllStep] = useState<
    null | "confirm" | "final"
  >(null);
  const { confirm, alert } = usePrompt();

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("client_requests")
      .select(
        "*, clients(first_name, surname, business_name), tasks(task_name, details)",
      )
      .order("created_at", { ascending: false });

    if (data) setMessages(data as InboxMessage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_requests",
        },
        () => {
          fetchMessages();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchMessages();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  const toggleStatus = async (id: string, field: string, value: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );

    const { error } = await supabase
      .from("client_requests")
      .update({ [field]: value })
      .eq("id", id);

    if (error) fetchMessages();
  };

  const convertToTask = async (msg: InboxMessage) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: taskData, error } = await supabase
      .from("tasks")
      .insert([
        {
          client_id: msg.client_id,
          va_id: userData.user.id,
          task_name: `Inbox Req: ${msg.message.substring(0, 40)}...`,
          is_completed: false,
          total_minutes: 0,
        },
      ])
      .select("id")
      .single();

    if (!error && taskData?.id) {
      const { error: linkError } = await supabase
        .from("client_requests")
        .update({ task_id: taskData.id })
        .eq("id", msg.id);
      if (!linkError) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === msg.id ? { ...item, task_id: taskData.id } : item,
          ),
        );
        setSelectedMsg((prev) =>
          prev && prev.id === msg.id ? { ...prev, task_id: taskData.id } : prev,
        );
      } else {
        fetchMessages();
      }
      await alert({
        title: "Task created",
        message: "Converted to client task! Message remains in Inbox.",
      });
      setSelectedMsg(null);
    }
  };

  const deleteMessage = async (msg: InboxMessage) => {
    const ok = await confirm({
      title: "Delete message?",
      message: "Delete this message permanently?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_requests")
      .delete()
      .eq("id", msg.id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setSelectedMsg(null);
    }
  };

  const deleteAllCompleted = async () => {
    const completedIds = messages
      .filter((m) => m.is_completed)
      .map((m) => m.id);
    if (completedIds.length === 0) {
      setDeleteAllStep(null);
      return;
    }
    const { error } = await supabase
      .from("client_requests")
      .delete()
      .in("id", completedIds);
    if (!error) {
      setMessages((prev) => prev.filter((m) => !m.is_completed));
      setSelectedMsg(null);
      setDeleteAllStep(null);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (activeTab === "starred") return m.is_starred && !m.is_completed;
    if (activeTab === "completed") return m.is_completed;
    return !m.is_completed;
  });
  const inboxCount = messages.filter(
    (m) => !m.is_read && !m.is_completed,
  ).length;
  const starredCount = messages.filter(
    (m) => m.is_starred && !m.is_completed,
  ).length;
  const typeLabels: Record<string, string> = {
    meeting: "Meeting Request",
    document: "Document Uploaded",
    work: "Work Request",
    onboarding: "Onboarding Complete",
    task_created: "Task Added",
    task_note: "Task Note",
    task_status: "Task Status",
    task_updated: "Task Updated",
    task_deleted: "Task Deleted",
  };
  const typeStyles: Record<string, string> = {
    meeting: "bg-blue-50 text-blue-700 border-blue-100",
    document: "bg-emerald-50 text-emerald-700 border-emerald-100",
    work: "bg-amber-50 text-amber-700 border-amber-100",
    onboarding: "bg-violet-50 text-violet-700 border-violet-100",
    task_created: "bg-green-50 text-green-700 border-green-100",
    task_note: "bg-lime-50 text-lime-700 border-lime-100",
    task_status: "bg-lime-50 text-lime-700 border-lime-100",
    task_updated: "bg-lime-50 text-lime-700 border-lime-100",
    task_deleted: "bg-red-50 text-red-700 border-red-100",
  };
  const getTypeLabel = (type: string) =>
    typeLabels[type] || type.replace(/_/g, " ");
  const getTypeClasses = (type: string) =>
    typeStyles[type] || "bg-slate-50 text-slate-700 border-slate-100";

  if (loading)
    return (
      <div className="p-10 text-gray-400 italic">Syncing command centre...</div>
    );

  return (
    <div className="text-black font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Inbox</h1>
      </header>

      <div className="flex h-[calc(100vh-160px)] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <aside className="w-64 border-r border-gray-50 bg-gray-50/50 p-6 space-y-2">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === "inbox"
                ? "bg-[#D9BAF2] text-[#333333] shadow-sm"
                : "text-[#333333] hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <Inbox size={16} className="text-[#333333]" /> Inbox
            </div>
            {inboxCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {inboxCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("starred")}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === "starred"
                ? "bg-[#D9BAF2] text-[#333333] shadow-sm"
                : "text-[#333333] hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <Star size={16} className="text-[#333333]" /> Starred
            </div>
            {starredCount > 0 && (
              <span className="bg-gray-200 text-[#333333] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {starredCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === "completed"
                ? "bg-[#D9BAF2] text-[#333333] shadow-sm"
                : "text-[#333333] hover:bg-gray-100"
            }`}
          >
            <CheckCircle2 size={16} className="text-[#333333]" /> Completed
          </button>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="border-b border-gray-100 px-8 py-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#333333]">
                Notification Feed
              </h2>
              {activeTab === "completed" && filteredMessages.length > 0 && (
                <button
                  onClick={() => setDeleteAllStep("confirm")}
                  className="text-xs font-semibold text-[#525252] hover:text-red-500 transition-colors"
                >
                  Delete All
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {activeTab === "inbox"
                ? "Unread and active requests"
                : activeTab === "starred"
                  ? "Flagged items needing attention"
                  : "Completed items"}
            </p>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="p-20 text-center text-gray-400 italic">
              No messages here.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => {
                    setSelectedMsg(msg);
                    if (!msg.is_read) toggleStatus(msg.id, "is_read", true);
                  }}
                  className={`group flex items-start gap-4 px-8 py-5 transition-colors cursor-pointer hover:bg-purple-50/40 ${
                    !msg.is_read ? "bg-purple-50/30" : ""
                  } ${msg.is_completed ? "text-gray-400" : "text-[#333333]"}`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus(msg.id, "is_starred", !msg.is_starred);
                    }}
                    className={`mt-1 text-xl transition-all hover:scale-110 active:scale-95 ${
                      msg.is_starred
                        ? "text-[#EEC644]"
                        : "text-[#EEC644]/70 group-hover:text-[#EEC644]"
                    }`}
                  >
                    {msg.is_starred ? "★" : "☆"}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {!msg.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#9d4edd] shadow-[0_0_0_2px_rgba(157,78,221,0.15)]" />
                      )}
                      <h3
                        className={`text-sm font-bold leading-tight ${
                          msg.is_read
                            ? "text-[#333333]"
                            : "text-[#1f1f1f] font-extrabold"
                        }`}
                      >
                        {msg.clients.first_name} {msg.clients.surname}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border ${getTypeClasses(
                          msg.type,
                        )}`}
                      >
                        {getTypeLabel(msg.type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0 leading-tight">
                      {msg.clients.business_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-2 truncate">
                      {msg.message}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span className="text-[11px] font-bold text-gray-400">
                      {format(new Date(msg.created_at), "dd MMM, HH:mm")}
                    </span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      {msg.is_completed ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(msg.id, "is_completed", false);
                          }}
                          className="px-3 py-1.5 rounded-full text-[10px] font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          Undo Complete
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(msg.id, "is_completed", true);
                          }}
                          className="px-3 py-1.5 rounded-full text-[10px] font-bold border border-green-200 text-green-700 hover:bg-green-50"
                        >
                          Mark Completed
                        </button>
                      )}
                      {msg.task_id ? (
                        <Link
                          href={`/va/dashboard/tasks?taskId=${msg.task_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border border-gray-200 text-[#333333] hover:bg-gray-50"
                        >
                          <ArrowUpRight size={12} />
                          View Task
                        </Link>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            convertToTask(msg);
                          }}
                          className="px-3 py-1.5 rounded-full text-[10px] font-bold border border-gray-200 text-[#333333] hover:bg-gray-50"
                        >
                          Create Task
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {selectedMsg && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-6 text-black"
            onClick={() => setSelectedMsg(null)}
          >
            <div
              className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black border ${getTypeClasses(
                        selectedMsg.type,
                      )}`}
                    >
                      {getTypeLabel(selectedMsg.type)}
                    </span>
                    <h2 className="text-2xl font-black mt-2">
                      {selectedMsg.clients.first_name}{" "}
                      {selectedMsg.clients.surname}
                    </h2>
                    <p className="text-sm font-bold text-gray-400">
                      {selectedMsg.clients.business_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(
                        new Date(selectedMsg.created_at),
                        "dd MMM yyyy, HH:mm",
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSelectedMsg((prev) => {
                          if (!prev) return prev;
                          const nextValue = !prev.is_starred;
                          toggleStatus(prev.id, "is_starred", nextValue);
                          return { ...prev, is_starred: nextValue };
                        })
                      }
                      className={`text-xl transition-all hover:scale-110 ${
                        selectedMsg.is_starred
                          ? "text-[#EEC644]"
                          : "text-[#EEC644]/70"
                      }`}
                    >
                      {selectedMsg.is_starred ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => setSelectedMsg(null)}
                      className="w-10 h-10 rounded-full border border-[#525252] text-[#525252] hover:text-[#333333] hover:border-[#333333] flex items-center justify-center text-base font-bold transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 italic text-gray-700 leading-relaxed shadow-inner">
                  {selectedMsg.type === "task_note"
                    ? "Client added a note on this task."
                    : selectedMsg.message && `“${selectedMsg.message}”`}
                </div>

                {(selectedMsg.type === "task_note" ||
                  selectedMsg.type === "task_created" ||
                  selectedMsg.type === "task_updated" ||
                  selectedMsg.type === "task_status") && (
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 text-gray-700 leading-relaxed shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                      {selectedMsg.type === "task_note"
                        ? "Task Note"
                        : "Task Details"}
                    </p>
                    {selectedMsg.tasks?.task_name && (
                      <p className="mt-2 text-sm font-bold text-gray-900">
                        {selectedMsg.tasks.task_name}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedMsg.type === "task_note"
                        ? selectedMsg.message
                        : selectedMsg.tasks?.details || "No details provided."}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 items-start">
                  {selectedMsg.task_id ? (
                    <Link
                      href={`/va/dashboard/tasks?taskId=${selectedMsg.task_id}`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                    >
                      <ArrowUpRight size={14} />
                      View Task
                    </Link>
                  ) : (
                    <button
                      onClick={() => convertToTask(selectedMsg)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                    >
                      <Settings size={14} />
                      Create Task
                    </button>
                  )}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        toggleStatus(
                          selectedMsg.id,
                          "is_completed",
                          !selectedMsg.is_completed,
                        );
                        setSelectedMsg(null);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-xs tracking-widest border-2 border-[#9d4edd] text-[#9d4edd] hover:bg-purple-50 active:bg-purple-100 transition-all active:scale-95"
                    >
                      {selectedMsg.is_completed ? (
                        <RotateCcw size={14} />
                      ) : (
                        <Check size={14} />
                      )}
                      {selectedMsg.is_completed
                        ? "Undo Complete"
                        : "Mark Completed"}
                    </button>
                    <div className="mt-2 flex items-center justify-center gap-4">
                      {selectedMsg.is_read && (
                        <button
                          onClick={() => {
                            toggleStatus(selectedMsg.id, "is_read", false);
                            setSelectedMsg((prev) =>
                              prev ? { ...prev, is_read: false } : prev,
                            );
                            setSelectedMsg(null);
                          }}
                          className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Mark as unread
                        </button>
                      )}
                      {selectedMsg.is_completed && (
                        <button
                          onClick={() => deleteMessage(selectedMsg)}
                          className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteAllStep && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-6 text-black"
            onClick={() => setDeleteAllStep(null)}
          >
            <div
              className="bg-white w-full max-w-lg rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-8 space-y-4">
                {deleteAllStep === "confirm" ? (
                  <>
                    <h3 className="text-lg font-black text-[#333333]">
                      Are you sure? This action CANNOT be reversed!
                    </h3>
                    <p className="text-sm text-gray-500">
                      This will permanently delete all completed messages.
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setActiveTab("completed");
                          setDeleteAllStep(null);
                        }}
                        className="px-4 py-2 rounded-full text-xs font-bold border border-gray-200 text-[#333333] hover:bg-gray-50"
                      >
                        No
                      </button>
                      <button
                        onClick={() => setDeleteAllStep("final")}
                        className="px-4 py-2 rounded-full text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Yes
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-black text-[#333333]">
                      Last Chance
                    </h3>
                    <p className="text-sm text-gray-500">
                      To delete all messages click “I understand this cannot be
                      reversed”.
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setActiveTab("completed");
                          setDeleteAllStep(null);
                        }}
                        className="px-4 py-2 rounded-full text-xs font-bold border border-gray-200 text-[#333333] hover:bg-gray-50"
                      >
                        Return to completed
                      </button>
                      <button
                        onClick={deleteAllCompleted}
                        className="px-4 py-2 rounded-full text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        I understand this cannot be reversed
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
