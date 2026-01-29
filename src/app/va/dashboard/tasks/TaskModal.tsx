"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { STATUS_CONFIG, Task } from "./types";
import TaskNotes from "@/components/tasks/TaskNotes";
import { usePrompt } from "@/components/ui/PromptProvider";

type ClientOption = {
  id: string;
  business_name: string;
  surname: string;
};

type TaskModalPrefill = {
  status?: string;
  category?: "client" | "business" | "personal";
  clientId?: string;
  parentTaskId?: string | null;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
};

type TaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientOption[];
  task?: Task | null;
  lockClient?: boolean;
  prefill?: TaskModalPrefill | null;
  variant?: "modal" | "side";
  onSaved?: (task: Task) => void;
  onFallbackRefresh?: () => void | Promise<void>;
};

type CategoryOption = {
  id: string;
  label: string;
  color: string;
};

const CATEGORY_CONFIG: Record<string, CategoryOption> = {
  client: {
    id: "client",
    label: "Client",
    color: "bg-[#E8F1FB] text-gray-700 border-[#D5E4F7]",
  },
  business: {
    id: "business",
    label: "Business",
    color: "bg-[#EAF6EF] text-gray-700 border-[#D9EBDD]",
  },
  personal: {
    id: "personal",
    label: "Personal",
    color: "bg-[#FFF3CC] text-gray-700 border-[#F5E2A8]",
  },
};

export default function TaskModal({
  isOpen,
  onClose,
  clients,
  task,
  lockClient = false,
  prefill,
  variant = "modal",
  onSaved,
  onFallbackRefresh,
}: TaskModalProps) {
  const isSide = variant === "side";
  const initialState = useMemo(() => {
    if (task) {
      const start = task.scheduled_start
        ? new Date(task.scheduled_start)
        : null;
      const end = task.scheduled_end ? new Date(task.scheduled_end) : null;
      const due = task.due_date ? new Date(task.due_date) : null;
      return {
        formTaskName: task.task_name,
        formDetails: task.details || "",
        formClientId: task.client_id || "",
        formClientQuery: "",
        formCategory: (task.category ||
          (task.client_id ? "client" : "personal")) as
          | "client"
          | "business"
          | "personal",
        formStartDate: start
          ? format(start, "yyyy-MM-dd")
          : due
            ? format(due, "yyyy-MM-dd")
            : "",
        formStartTime: start ? format(start, "HH:mm") : "",
        formEndDate: end ? format(end, "yyyy-MM-dd") : "",
        formEndTime: end ? format(end, "HH:mm") : "",
        formStatus: task.status,
      };
    }

    const prefillCategory = prefill?.category || "client";
    const clientId = prefill?.clientId || "";
    return {
      formTaskName: "",
      formDetails: "",
      formClientId: clientId,
      formClientQuery: "",
      formCategory: (lockClient ? "client" : prefillCategory) as
        | "client"
        | "business"
        | "personal",
      formStartDate: prefill?.startDate || "",
      formStartTime: prefill?.startTime || "",
      formEndDate: prefill?.endDate || "",
      formEndTime: prefill?.endTime || "",
      formStatus: prefill?.status || "todo",
    };
  }, [task, prefill, lockClient]);

  const [formTaskName, setFormTaskName] = useState(
    initialState.formTaskName
  );
  const [formDetails, setFormDetails] = useState(initialState.formDetails);
  const [formClientId, setFormClientId] = useState(
    initialState.formClientId
  );
  const [formClientQuery, setFormClientQuery] = useState(
    initialState.formClientQuery
  );
  const [formCategory, setFormCategory] = useState<
    "client" | "business" | "personal"
  >(initialState.formCategory);
  const [formStartDate, setFormStartDate] = useState(
    initialState.formStartDate
  );
  const [formStartTime, setFormStartTime] = useState(
    initialState.formStartTime
  );
  const [formEndDate, setFormEndDate] = useState(initialState.formEndDate);
  const [formEndTime, setFormEndTime] = useState(initialState.formEndTime);
  const [formStatus, setFormStatus] = useState(initialState.formStatus);
  const [formShared, setFormShared] = useState(
    Boolean(task?.shared_with_client),
  );
  const [viewerId, setViewerId] = useState<string>("");
  const [viewerName, setViewerName] = useState<string>("");
  const { confirm, alert } = usePrompt();

  useEffect(() => {
    const loadViewer = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      setViewerId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", user.id)
        .single();
      const name = profile?.display_name || profile?.full_name || "";
      setViewerName(name);
    };
    void loadViewer();
  }, []);

  const clientSearch = formClientQuery.trim().toLowerCase();
  const filteredClients = clientSearch
    ? clients.filter((c) =>
        `${c.surname} (${c.business_name})`.toLowerCase().includes(clientSearch)
      )
    : clients;

  const selectedClientLabel = useMemo(() => {
    const selectedClient = clients.find((c) => c.id === formClientId);
    return selectedClient
      ? `${selectedClient.surname} (${selectedClient.business_name})`
      : "";
  }, [clients, formClientId]);

  const handleSaveTask = async () => {
    if (!formTaskName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    const buildIsoDateTime = (date: string, time: string) => {
      if (!date || !time) return null;
      return new Date(`${date}T${time}`).toISOString();
    };
    const scheduledStart = buildIsoDateTime(formStartDate, formStartTime);
    const scheduledEnd =
      buildIsoDateTime(formEndDate, formEndTime) ||
      (formEndDate
        ? new Date(`${formEndDate}T23:59:59`).toISOString()
        : null);
    const dueDate =
      formStartDate || formEndDate || task?.due_date || null;
    const clientId = lockClient
      ? formClientId || prefill?.clientId || null
      : formCategory === "client"
        ? formClientId || null
        : null;
    const isCompleted = formStatus === "completed";
    const detailsValue = formDetails.trim();
    const sharedValue =
      formCategory === "client" && clientId ? formShared : false;
    const payload = {
      task_name: formTaskName,
      details: detailsValue ? detailsValue : null,
      client_id: clientId,
      parent_task_id: task?.parent_task_id ?? prefill?.parentTaskId ?? null,
      status: formStatus,
      is_completed: isCompleted,
      due_date: dueDate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      category: formCategory,
      shared_with_client: sharedValue,
    };

    if (task) {
      let { data, error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", task.id)
        .select("*, clients!tasks_client_id_fkey(business_name, surname)")
        .single();
      if (
        error &&
        error.message &&
        (error.message.toLowerCase().includes("details") ||
          error.message.toLowerCase().includes("shared_with_client"))
      ) {
        const { details: ignoredDetails, shared_with_client: ignoredShared, ...fallbackPayload } = payload;
        void ignoredDetails;
        void ignoredShared;
        ({ data, error } = await supabase
          .from("tasks")
          .update(fallbackPayload)
          .eq("id", task.id)
          .select("*, clients!tasks_client_id_fkey(business_name, surname)")
          .single());
      }
      if (error) {
        console.error("Failed to update task", error);
        await alert({
          title: "Task not saved",
          message: error.message || "Unknown error updating task.",
          tone: "danger",
        });
        return;
      }
      if (data) {
        if (
          task?.shared_with_client &&
          task.client_id &&
          task.status !== formStatus
        ) {
          await supabase.from("client_notifications").insert([
            {
              client_id: task.client_id,
              task_id: task.id,
              type: "task_status",
              message: `${viewerName || "Your VA"} updated your task: ${data.task_name}`,
            },
          ]);
          await supabase.from("task_activity").insert([
            {
              task_id: task.id,
              actor_type: "va",
              actor_id: user.id,
              action: "status_changed",
              meta: { from: task.status, to: formStatus },
            },
          ]);
        }
        onSaved?.(data as Task);
      } else {
        await onFallbackRefresh?.();
      }
    } else {
      const insertPayload = {
        va_id: user.id,
        ...payload,
        total_minutes: 0,
        is_running: false,
        created_by_client: false,
      };
      let { data, error } = await supabase
        .from("tasks")
        .insert([insertPayload])
        .select("*, clients!tasks_client_id_fkey(business_name, surname)")
        .single();
      if (
        error &&
        error.message &&
        (error.message.toLowerCase().includes("details") ||
          error.message.toLowerCase().includes("shared_with_client") ||
          error.message.toLowerCase().includes("created_by_client"))
      ) {
        const {
          details: ignoredDetails,
          shared_with_client: ignoredShared,
          created_by_client: ignoredCreatedByClient,
          ...fallbackPayload
        } = insertPayload;
        void ignoredDetails;
        void ignoredShared;
        void ignoredCreatedByClient;
        ({ data, error } = await supabase
          .from("tasks")
          .insert([fallbackPayload])
          .select("*, clients!tasks_client_id_fkey(business_name, surname)")
          .single());
      }
      if (error) {
        console.error("Failed to create task", error);
        await alert({
          title: "Task not created",
          message: error.message || "Unknown error creating task.",
          tone: "danger",
        });
        return;
      }
      if (data) {
        onSaved?.(data as Task);
      } else {
        await onFallbackRefresh?.();
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-100 flex p-4 ${
        isSide
          ? "justify-end bg-black/20 md:bg-transparent"
          : "items-center justify-center bg-black/40 backdrop-blur-sm"
      }`}
      onClick={isSide ? onClose : undefined}
    >
      <div
        className={`bg-white w-full max-w-lg p-7 shadow-2xl ${
          isSide
            ? "h-full md:h-[calc(100%-1rem)] md:my-2 md:mr-2 overflow-y-auto animate-in fade-in duration-200"
            : "animate-in zoom-in duration-200"
        }`}
        onClick={isSide ? (event) => event.stopPropagation() : undefined}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-black text-[#333333]">
            {task ? "Edit Task" : "New Task"}
          </h2>
          <div className="w-full sm:w-44">
            <label className="sr-only" htmlFor="task-status-select">
              Status
            </label>
            <select
              id="task-status-select"
              className="w-full bg-white border-2 border-gray-100 rounded-lg p-2.5 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd] capitalize"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
            >
              {Object.values(STATUS_CONFIG).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {task?.client_deleted_at && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <p className="font-bold">
                This task has been deleted by your client.
              </p>
              <p className="mt-1">Delete from your files?</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Delete task?",
                      message: "Delete this task from your files?",
                      confirmLabel: "Delete",
                      tone: "danger",
                    });
                    if (!ok) return;
                    const deletedAt = new Date().toISOString();
                    await supabase
                      .from("tasks")
                      .update({ deleted_at: deletedAt })
                      .eq("id", task.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-[10px] font-bold"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border border-red-200 text-[10px] font-bold"
                >
                  Keep
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1 ml-1">
              Task Title
            </label>
            <input
              autoFocus
              className="w-full bg-gray-50 border-none rounded-lg p-3 font-bold text-[#333333] outline-none focus:ring-2 focus:ring-purple-100"
              value={formTaskName}
              onChange={(e) => setFormTaskName(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1 ml-1">
              Detail
            </label>
            <textarea
              className="w-full bg-gray-50 border-none rounded-lg p-3 text-xs font-bold text-[#333333] outline-none focus:ring-2 focus:ring-purple-100 resize-none h-20"
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder="Add extra details for this task"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1 ml-1">
              Category
            </label>
            <div className="flex gap-2">
              {Object.values(CATEGORY_CONFIG).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (lockClient) return;
                    setFormCategory(
                      cat.id as "client" | "business" | "personal"
                    );
                    if (cat.id !== "client") {
                      setFormClientId("");
                      setFormClientQuery("");
                      setFormShared(false);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    formCategory === cat.id
                      ? `${cat.color} shadow-sm`
                      : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                  } ${lockClient ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {formCategory === "client" && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1 ml-1">
                Assign Client
              </label>
              {lockClient ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs font-bold text-[#333333]">
                  {selectedClientLabel || "Client assigned"}
                </div>
              ) : (
                <>
                  <input
                    className="w-full bg-white border-2 border-gray-100 rounded-lg p-2.5 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                    value={formClientQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormClientQuery(value);
                      setFormClientId("");
                    }}
                    placeholder="Type a client name"
                  />
                  {formClientQuery.trim().length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-gray-100 bg-white shadow-sm">
                      {filteredClients.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setFormClientId(c.id);
                            setFormClientQuery("");
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-[#333333] hover:bg-gray-50 transition-colors"
                        >
                          {c.surname} ({c.business_name})
                        </button>
                      ))}
                      {filteredClients.length === 0 && (
                        <p className="px-3 py-2 text-xs font-bold text-[#333333]">
                          No clients found.
                        </p>
                      )}
                    </div>
                  )}
                  {formClientId && (
                    <p className="mt-2 text-xs font-bold text-[#333333]">
                      Assigned client: {selectedClientLabel || "Client selected"}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1 ml-1">
                Start date / time
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-white border-2 border-gray-100 rounded-lg p-2.5 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-28 shrink-0 bg-white border-2 border-gray-100 rounded-lg p-2.5 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1 ml-1">
                End date / time
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-white border-2 border-gray-100 rounded-lg p-2.5 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-28 shrink-0 bg-white border-2 border-gray-100 rounded-lg p-2.5 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg border-2 border-gray-100 text-[#333333] font-bold text-xs tracking-widest hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTask}
              className="flex-1 bg-[#9d4edd] text-white py-2.5 rounded-lg font-bold text-xs tracking-widest shadow-lg shadow-purple-100 hover:bg-[#7b2cbf] transition-all"
            >
              {task ? "Save Changes" : "Create Task"}
            </button>
          </div>
          {(formCategory === "client" || lockClient) && (
            <label className="flex items-center gap-2 text-[10px] font-bold text-[#333333] mt-2">
              <input
                type="checkbox"
                checked={formShared}
                onChange={(e) => setFormShared(e.target.checked)}
                disabled={!formClientId && !task?.client_id}
                className="h-4 w-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
              />
              Mark as shared
            </label>
          )}
          {task?.id && viewerId && (
            <TaskNotes
              taskId={task.id}
              taskName={task.task_name}
              viewerType="va"
              viewerId={viewerId}
              viewerName={viewerName}
              clientId={task.client_id || null}
              sharedWithClient={Boolean(task.shared_with_client)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
