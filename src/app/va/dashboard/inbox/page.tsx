"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

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
    const { error } = await supabase
      .from("client_requests")
      .update({ [field]: value })
      .eq("id", id);
    if (!error) fetchMessages();
  };

  const filteredMessages = messages.filter((m) => {
    if (activeTab === "starred") return m.is_starred && !m.is_completed;
    if (activeTab === "completed") return m.is_completed;
    return !m.is_completed;
  });

  if (loading)
    return (
      <div className="p-10 text-gray-400 italic">Syncing command centre...</div>
    );

  return (
    <div className="flex h-[calc(100vh-160px)] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden text-black font-sans">
      {/* 1. INBOX TABS (The Inner Menu) */}
      <aside className="w-64 border-r border-gray-50 bg-gray-50/50 p-6 space-y-2">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeTab === "inbox"
              ? "bg-white text-[#9d4edd] shadow-sm"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <span>📥</span> Inbox
          </div>
          {messages.filter((m) => !m.is_read && !m.is_completed).length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
              {messages.filter((m) => !m.is_read && !m.is_completed).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("starred")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeTab === "starred"
              ? "bg-white text-[#9d4edd] shadow-sm"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <span>⭐</span> Starred
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeTab === "completed"
              ? "bg-white text-[#9d4edd] shadow-sm"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <span>✅</span> Completed
        </button>
      </aside>

      {/* 2. MESSAGE LIST */}
      <main className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white sticky top-0">
              <th className="px-6 py-4 w-10"></th>
              <th className="px-6 py-4 w-48">Client</th>
              <th className="px-6 py-4">Context</th>
              <th className="px-6 py-4 text-right w-32">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredMessages.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="p-20 text-center text-gray-400 italic"
                >
                  No messages here.
                </td>
              </tr>
            ) : (
              filteredMessages.map((msg) => (
                <tr
                  key={msg.id}
                  onClick={() => {
                    setSelectedMsg(msg);
                    if (!msg.is_read) toggleStatus(msg.id, "is_read", true);
                  }}
                  className={`group cursor-pointer hover:bg-purple-50/50 transition-colors ${
                    !msg.is_read ? "bg-purple-50/20 font-bold" : ""
                  }`}
                >
                  <td
                    className="px-6 py-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus(msg.id, "is_starred", !msg.is_starred);
                    }}
                  >
                    <span
                      className={
                        msg.is_starred
                          ? "text-yellow-400 text-lg"
                          : "text-gray-200 group-hover:text-gray-300 text-lg"
                      }
                    >
                      {msg.is_starred ? "★" : "☆"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold">
                      {msg.clients.first_name} {msg.clients.surname}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                      {msg.clients.business_name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] uppercase font-black ${
                          msg.type === "work"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        {msg.type}
                      </span>
                      <span className="text-sm truncate max-w-md text-gray-600 font-medium">
                        {msg.message}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-[11px] font-bold text-gray-400 uppercase">
                    {format(new Date(msg.created_at), "dd MMM")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>

      {/* 3. MODAL POPUP */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-10 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black text-[#9d4edd] uppercase tracking-widest">
                    {selectedMsg.type} Request
                  </span>
                  <h2 className="text-2xl font-black">
                    {selectedMsg.clients.first_name}{" "}
                    {selectedMsg.clients.surname}
                  </h2>
                  <p className="text-sm font-bold text-gray-400 uppercase">
                    {selectedMsg.clients.business_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMsg(null)}
                  className="text-gray-300 hover:text-black text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 italic text-gray-700 leading-relaxed shadow-inner">
                &quot;{selectedMsg.message}&quot;
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    toggleStatus(
                      selectedMsg.id,
                      "is_completed",
                      !selectedMsg.is_completed
                    );
                    setSelectedMsg(null);
                  }}
                  className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all active:scale-95 ${
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
