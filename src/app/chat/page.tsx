"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePrompt } from "@/components/ui/PromptProvider";
import { Ban, Trash2 } from "lucide-react";

type ChatRoom = {
  id: string;
  name: string;
  slug: string;
};

type ChatMessage = {
  id: string;
  author_id: string;
  display_name: string | null;
  body: string;
  created_at: string;
};

type ChatBan = {
  id: string;
  user_id: string;
  created_by: string;
  reason: string | null;
  created_at: string;
};

const ALLOWED_ROLES = new Set(["va", "admin", "super_admin"]);
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
const ROOM_SLUG = "coffee-lounge";

export default function ChatPage() {
  const { confirm } = usePrompt();
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bans, setBans] = useState<ChatBan[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = role ? ADMIN_ROLES.has(role) : false;

  const activeNames = useMemo(() => {
    const names = new Set<string>();
    messages.forEach((message) => {
      if (message.display_name) names.add(message.display_name);
    });
    if (displayName) names.add(displayName);
    return Array.from(names);
  }, [messages, displayName]);

  const loadRoom = useCallback(async () => {
    const { data, error: roomError } = await supabase
      .from("chat_rooms")
      .select("id, name, slug")
      .eq("slug", ROOM_SLUG)
      .single();

    if (roomError || !data) {
      setError("You do not have access to this room.");
      setRoom(null);
      return null;
    }

    setRoom(data as ChatRoom);
    return data as ChatRoom;
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, author_id, display_name, body, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data as ChatMessage[]) || []);
  }, []);

  const loadBans = useCallback(
    async (roomId: string) => {
      if (!isAdmin) return;
      const { data } = await supabase
        .from("chat_bans")
        .select("id, user_id, created_by, reason, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      setBans((data as ChatBan[]) || []);
    },
    [isAdmin],
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      setAuthRequired(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAuthRequired(true);
        setLoading(false);
        return;
      }

      setUserId(session.user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, display_name, full_name")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile?.role || !ALLOWED_ROLES.has(profile.role)) {
        setError("You do not have access to this room.");
        setLoading(false);
        return;
      }

      setRole(profile.role);
      setDisplayName(profile.display_name || profile.full_name || "User");

      const roomData = await loadRoom();
      if (!roomData) {
        setLoading(false);
        return;
      }

      await loadMessages(roomData.id);
      await loadBans(roomData.id);
      setLoading(false);
      inputRef.current?.focus();
    };

    init();
  }, [loadBans, loadMessages, loadRoom]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`chat-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => {
              const next = [...prev, payload.new as ChatMessage];
              next.sort((a, b) => a.created_at.localeCompare(b.created_at));
              return next;
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as ChatMessage & {
              deleted_at?: string | null;
            };
            if (updated.deleted_at) {
              setMessages((prev) => prev.filter((m) => m.id !== updated.id));
            }
            return;
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  const handleSend = useCallback(async () => {
    if (!room || !userId) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    setSending(true);
    setMessageDraft("");

    const { error: sendError } = await supabase.from("chat_messages").insert({
      room_id: room.id,
      author_id: userId,
      body: trimmed,
    });

    if (sendError) {
      setError(sendError.message || "Failed to send message.");
      setMessageDraft(trimmed);
    }

    setSending(false);
  }, [messageDraft, room, userId]);

  const handleDelete = useCallback(
    async (message: ChatMessage) => {
      if (!room || !userId) return;
      const ok = await confirm({
        title: "Delete message?",
        message: "This will remove the message from the room.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!ok) return;

      const { error: deleteError } = await supabase
        .from("chat_messages")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq("id", message.id)
        .eq("room_id", room.id);

      if (deleteError) {
        setError(deleteError.message || "Failed to delete message.");
      }
    },
    [confirm, room, userId],
  );

  const handleBan = useCallback(
    async (message: ChatMessage) => {
      if (!room || !userId) return;
      const ok = await confirm({
        title: "Block user from room?",
        message: "They will lose access to the room immediately.",
        confirmLabel: "Block user",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!ok) return;

      const { error: banError } = await supabase.from("chat_bans").insert({
        room_id: room.id,
        user_id: message.author_id,
        created_by: userId,
        reason: "Blocked by admin",
      });

      if (banError) {
        setError(banError.message || "Failed to block user.");
        return;
      }

      await loadBans(room.id);
    },
    [confirm, loadBans, room, userId],
  );

  const handleUnban = useCallback(
    async (banId: string) => {
      if (!room) return;
      const ok = await confirm({
        title: "Unblock user?",
        message: "This will restore access to the room.",
        confirmLabel: "Unblock",
        cancelLabel: "Cancel",
      });
      if (!ok) return;

      const { error: unbanError } = await supabase
        .from("chat_bans")
        .delete()
        .eq("id", banId);

      if (unbanError) {
        setError(unbanError.message || "Failed to unblock user.");
        return;
      }

      await loadBans(room.id);
    },
    [confirm, loadBans, room],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc]">
        <p className="text-sm font-semibold text-gray-500">Loading chat...</p>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc] px-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">
            Sign in to access chat
          </h1>
          <p className="text-sm text-gray-500">
            Choose the login that matches your account.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/va/login"
              className="px-4 py-2 rounded-xl bg-[#9d4edd] text-white font-semibold text-sm"
            >
              VA Login
            </Link>
            <Link
              href="/admin/login"
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!room || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc] px-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">
            Coffee Lounge
          </h1>
          <p className="text-sm text-gray-500">
            {error || "You do not have access to this room."}
          </p>
          <Link
            href="/va/dashboard"
            className="text-sm font-semibold text-[#9d4edd]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
            VAHQ Chat
          </p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>
            <Link
              href="/va/dashboard"
              className="text-sm font-semibold text-[#9d4edd]"
            >
              Back to dashboard
            </Link>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col min-h-135">
            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-sm text-gray-400">
                  No messages yet. Start the conversation.
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.author_id === userId;
                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col gap-1 ${
                        isMine ? "items-end text-right" : "items-start"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-500">
                          {message.display_name || "User"}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div
                        className={`px-4 py-2 rounded-2xl text-sm ${
                          isMine
                            ? "bg-[#9d4edd] text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {message.body}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        {(isMine || isAdmin) && (
                          <button
                            onClick={() => handleDelete(message)}
                            className="flex items-center gap-1 hover:text-gray-600"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        )}
                        {isAdmin && !isMine && (
                          <button
                            onClick={() => handleBan(message)}
                            className="flex items-center gap-1 hover:text-gray-600"
                          >
                            <Ban size={12} />
                            Block user
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your message..."
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9d4edd]/40"
                />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-4 py-2 rounded-xl bg-[#9d4edd] text-white text-sm font-semibold disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3">
                Active in lounge
              </p>
              {activeNames.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No active names yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-700">
                  {activeNames.map((name) => (
                    <li key={name} className="font-medium">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isAdmin && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3">
                  Blocked users
                </p>
                {bans.length === 0 ? (
                  <p className="text-sm text-gray-400">No blocked users.</p>
                ) : (
                  <ul className="space-y-3 text-sm text-gray-700">
                    {bans.map((ban) => (
                      <li key={ban.id} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] text-gray-500">
                            {ban.user_id}
                          </span>
                          <button
                            onClick={() => handleUnban(ban.id)}
                            className="text-xs font-semibold text-[#9d4edd]"
                          >
                            Unblock
                          </button>
                        </div>
                        {ban.reason && (
                          <span className="text-[12px] text-gray-400">
                            {ban.reason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
