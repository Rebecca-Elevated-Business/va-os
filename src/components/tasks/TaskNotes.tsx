"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { usePrompt } from "@/components/ui/PromptProvider";

type TaskNote = {
  id: string;
  task_id: string;
  author_type: "va" | "client";
  author_id: string;
  note: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

type TaskNotesProps = {
  taskId: string;
  taskName?: string | null;
  viewerType: "va" | "client";
  viewerId: string;
  viewerName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  vaName?: string | null;
  sharedWithClient?: boolean;
};

export default function TaskNotes({
  taskId,
  taskName,
  viewerType,
  viewerId,
  viewerName,
  clientId,
  vaName,
  sharedWithClient = false,
}: TaskNotesProps) {
  const { confirm } = usePrompt();
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("task_notes")
      .select("*")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    setNotes((data as TaskNote[]) || []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadNotes();
    }, 0);
    const channel = supabase
      .channel(`task-notes-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_notes" },
        (payload) => {
          const row = payload.new as TaskNote | null;
          if (row?.task_id === taskId) void loadNotes();
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [taskId, loadNotes]);

  const displayName = (note: TaskNote) => {
    if (note.author_type === "va") {
      return note.author_id === viewerId && viewerType === "va"
        ? "You"
        : "VA";
    }
    return note.author_id === viewerId && viewerType === "client"
      ? "You"
      : "Client";
  };

  const canEdit = (note: TaskNote) =>
    viewerType === "va" &&
    note.author_type === "va" &&
    note.author_id === viewerId &&
    !note.is_locked;

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    const insertPayload = {
      task_id: taskId,
      author_type: viewerType,
      author_id: viewerId,
      note: text,
      is_locked: viewerType === "client",
    };
    const { data, error } = await supabase
      .from("task_notes")
      .insert([insertPayload])
      .select("*")
      .single();
    if (error) return;
    setNotes((prev) => [...prev, data as TaskNote]);
    setNewNote("");

    await supabase.from("task_activity").insert([
      {
        task_id: taskId,
        actor_type: viewerType,
        actor_id: viewerId,
        action: "note_added",
        meta: { note_id: data?.id || null },
      },
    ]);

    if (viewerType === "client" && clientId) {
      await supabase.from("client_requests").insert([
        {
          client_id: clientId,
          task_id: taskId,
          type: "task_note",
          message: text,
          status: "new",
          is_read: false,
          is_completed: false,
          is_starred: false,
        },
      ]);
    }

    if (viewerType === "va" && sharedWithClient && clientId) {
      await supabase.from("client_notifications").insert([
        {
          client_id: clientId,
          task_id: taskId,
          type: "task_note",
          message: `${vaName || viewerName || "Your VA"} added a note on your task: ${taskName || "Task"}`,
        },
      ]);
    }
  };

  const startEdit = (note: TaskNote) => {
    setEditingId(note.id);
    setEditingText(note.note);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async (note: TaskNote) => {
    const text = editingText.trim();
    if (!text) return;
    const { error } = await supabase
      .from("task_notes")
      .update({ note: text, updated_at: new Date().toISOString() })
      .eq("id", note.id);
    if (error) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, note: text } : n)),
    );
    setEditingId(null);
    setEditingText("");
    await supabase.from("task_activity").insert([
      {
        task_id: taskId,
        actor_type: viewerType,
        actor_id: viewerId,
        action: "note_edited",
        meta: { note_id: note.id },
      },
    ]);
  };

  const deleteNote = async (note: TaskNote) => {
    const ok = await confirm({
      title: "Delete note?",
      message: "Delete this note permanently?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("task_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", note.id);
    if (error) return;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    await supabase.from("task_activity").insert([
      {
        task_id: taskId,
        actor_type: viewerType,
        actor_id: viewerId,
        action: "note_deleted",
        meta: { note_id: note.id },
      },
    ]);
  };

  const notesCount = notes.length;
  const hasNotes = notesCount > 0;
  const headerLabel = useMemo(
    () => `Notes ${hasNotes ? `(${notesCount})` : ""}`,
    [hasNotes, notesCount],
  );

  return (
    <div className="mt-6 rounded-lg border border-gray-100 bg-white">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black tracking-widest text-[#333333]"
      >
        <span>{headerLabel}</span>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {loading ? (
            <div className="text-xs text-gray-400 italic">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-xs text-gray-400 italic">
              No notes yet. Add the first one below.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const isEditing = editingId === note.id;
                return (
                  <div
                    key={note.id}
                    className="rounded-md border border-gray-100 p-3"
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
                      <span className="font-bold">{displayName(note)}</span>
                      <span>
                        {format(new Date(note.created_at), "d MMM, HH:mm")}
                      </span>
                    </div>
                    {isEditing ? (
                      <textarea
                        className="w-full rounded-md border border-gray-100 p-2 text-xs"
                        rows={3}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                      />
                    ) : (
                      <p className="text-xs text-[#333333] whitespace-pre-wrap">
                        {note.note}
                      </p>
                    )}
                    {canEdit(note) && (
                      <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-gray-400">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(note)}
                              className="text-[#9d4edd]"
                            >
                              Save
                            </button>
                            <button type="button" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(note)}
                              className="flex items-center gap-1"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(note)}
                              className="flex items-center gap-1 text-red-500"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 space-y-2">
            <label className="text-[10px] font-black text-[#333333] tracking-widest block">
              Add note
            </label>
            <textarea
              className="w-full rounded-md border border-gray-100 p-2 text-xs"
              rows={3}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a quick note..."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddNote}
                className="px-3 py-2 rounded-md bg-[#9d4edd] text-white text-[10px] font-bold tracking-widest"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
