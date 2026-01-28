"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { CheckCircle2, Inbox, Star } from "lucide-react";
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
    "inbox"
  );
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const { confirm, alert } = usePrompt();

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("client_requests")
      .select("*, clients(first_name, surname, business_name)")
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
        }
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
    // Optimistic update for UI speed
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );

    const { error } = await supabase
      .from("client_requests")
      .update({ [field]: value })
      .eq("id", id);

    if (error) fetchMessages(); // Revert on error
  };

  const convertToTask = async (msg: InboxMessage) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from("tasks").insert([
      {
        client_id: msg.client_id,
        va_id: userData.user.id,
        task_name: `Inbox Req: ${msg.message.substring(0, 40)}...`,
        is_completed: false,
        total_minutes: 0,
      },
    ]);

    if (!error) {
      await alert({
        title: "Task created",
        message: "Converted to client task! Message remains in Inbox.",
      });
      // UPDATED: Removed the auto-complete line here so it stays in Inbox
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

  const filteredMessages = messages.filter((m) => {
    if (activeTab === "starred") return m.is_starred && !m.is_completed;
    if (activeTab === "completed") return m.is_completed;
    return !m.is_completed;
  });
  const inboxCount = messages.filter((m) => !m.is_read && !m.is_completed)
    .length;
  const starredCount = messages.filter((m) => m.is_starred && !m.is_completed)
    .length;
  const typeLabels: Record<string, string> = {
    meeting: "Meeting Request",
    document: "Document Uploaded",
    work: "Work Request",
    onboarding: "Onboarding Complete",
  };
  const typeStyles: Record<string, string> = {
    meeting: "bg-blue-50 text-blue-700 border-blue-100",
    document: "bg-emerald-50 text-emerald-700 border-emerald-100",
    work: "bg-amber-50 text-amber-700 border-amber-100",
    onboarding: "bg-violet-50 text-violet-700 border-violet-100",
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
        {/* SIDEBAR TABS */}
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

      {/* FEED LIST */}
        <main className="flex-1 overflow-y-auto">
        <div className="border-b border-gray-100 px-8 py-6">
          <h2 className="text-lg font-bold text-[#333333]">Notification Feed</h2>
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
                  !msg.is_read ? "bg-purple-50/20" : ""
                } ${msg.is_completed ? "text-gray-400" : "text-[#333333]"}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStatus(msg.id, "is_starred", !msg.is_starred);
                  }}
                  className={`mt-1 text-xl transition-all hover:scale-110 ${
                    msg.is_starred
                      ? "text-[#9d4edd]"
                      : "text-gray-200 group-hover:text-gray-300"
                  }`}
                >
                  {msg.is_starred ? "★" : "☆"}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3
                      className={`text-sm font-bold ${
                        !msg.is_read ? "text-[#333333]" : "text-[#333333]"
                      }`}
                    >
                      {msg.clients.first_name} {msg.clients.surname}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border ${getTypeClasses(
                        msg.type
                      )}`}
                    >
                      {getTypeLabel(msg.type)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        convertToTask(msg);
                      }}
                      className="px-3 py-1.5 rounded-full text-[10px] font-bold border border-gray-200 text-[#333333] hover:bg-gray-50"
                    >
                      Create Task
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </main>

      {/* POPUP OVERLAY */}
        {selectedMsg && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-6 text-black">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="p-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black border ${getTypeClasses(
                        selectedMsg.type
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
                        "dd MMM yyyy, HH:mm"
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        toggleStatus(
                          selectedMsg.id,
                          "is_starred",
                          !selectedMsg.is_starred
                        )
                      }
                      className={`text-xl transition-all hover:scale-110 ${
                        selectedMsg.is_starred
                          ? "text-[#9d4edd]"
                          : "text-gray-200"
                      }`}
                    >
                      {selectedMsg.is_starred ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => setSelectedMsg(null)}
                      className="text-black hover:bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 italic text-gray-700 leading-relaxed shadow-inner">
                  &quot;{selectedMsg.message}&quot;
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={() => convertToTask(selectedMsg)}
                    className="bg-gray-900 text-white py-4 rounded-2xl font-black text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                  >
                    ⚙️ Create Task
                  </button>
                  <button
                    onClick={() => {
                      toggleStatus(
                        selectedMsg.id,
                        "is_completed",
                        !selectedMsg.is_completed
                      );
                      setSelectedMsg(null);
                    }}
                    className={`py-4 rounded-2xl font-black text-xs tracking-widest border-2 transition-all active:scale-95 ${
                      selectedMsg.is_completed
                        ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                        : "border-green-200 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {selectedMsg.is_completed
                      ? "⏪ Undo Complete"
                      : "✅ Mark Completed"}
                  </button>
                </div>
                {selectedMsg.is_completed && (
                  <div className="pt-2">
                    <button
                      onClick={() => deleteMessage(selectedMsg)}
                      className="text-red-600 border border-red-200 rounded-xl px-3 py-2 text-[10px] font-black tracking-widest hover:bg-red-50 transition-colors"
                    >
                      DELETE
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
