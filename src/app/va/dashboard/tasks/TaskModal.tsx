"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { STATUS_CONFIG, Task } from "./types";

type ClientOption = {
  id: string;
  business_name: string;
  surname: string;
};

type TaskModalPrefill = {
  status?: string;
  category?: "client" | "business" | "personal";
  clientId?: string;
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
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  business: {
    id: "business",
    label: "Business",
    color: "bg-orange-50 text-orange-800 border-orange-100",
  },
  personal: {
    id: "personal",
    label: "Personal",
    color: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100",
  },
};

export default function TaskModal({
  isOpen,
  onClose,
  clients,
  task,
  lockClient = false,
  prefill,
  onSaved,
  onFallbackRefresh,
}: TaskModalProps) {
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
    const scheduledEnd = buildIsoDateTime(formEndDate, formEndTime);
    const dueDate = formStartDate || task?.due_date || null;
    const clientId = lockClient
      ? formClientId || prefill?.clientId || null
      : formCategory === "client"
        ? formClientId || null
        : null;
    const isCompleted = formStatus === "completed";
    const detailsValue = formDetails.trim();
    const payload = {
      task_name: formTaskName,
      details: detailsValue ? detailsValue : null,
      client_id: clientId,
      status: formStatus,
      is_completed: isCompleted,
      due_date: dueDate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      category: formCategory,
    };

    if (task) {
      let { data, error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", task.id)
        .select("*, clients(business_name, surname)")
        .single();
      if (error && error.message?.toLowerCase().includes("details")) {
        const { details: ignoredDetails, ...fallbackPayload } = payload;
        void ignoredDetails;
        ({ data, error } = await supabase
          .from("tasks")
          .update(fallbackPayload)
          .eq("id", task.id)
          .select("*, clients(business_name, surname)")
          .single());
      }
      if (error) {
        console.error("Failed to update task", error);
        return;
      }
      if (data) {
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
      };
      let { data, error } = await supabase
        .from("tasks")
        .insert([insertPayload])
        .select("*, clients(business_name, surname)")
        .single();
      if (error && error.message?.toLowerCase().includes("details")) {
        const { details: ignoredDetails, ...fallbackPayload } = insertPayload;
        void ignoredDetails;
        ({ data, error } = await supabase
          .from("tasks")
          .insert([fallbackPayload])
          .select("*, clients(business_name, surname)")
          .single());
      }
      if (error) {
        console.error("Failed to create task", error);
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200">
        <h2 className="text-xl font-black mb-6 text-[#333333]">
          {task ? "Edit Task" : "New Task"}
        </h2>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
              Task Title
            </label>
            <input
              autoFocus
              className="w-full bg-gray-50 border-none rounded-xl p-4 font-bold text-[#333333] outline-none focus:ring-2 focus:ring-purple-100"
              value={formTaskName}
              onChange={(e) => setFormTaskName(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
              Detail
            </label>
            <textarea
              className="w-full bg-gray-50 border-none rounded-xl p-4 text-xs font-bold text-[#333333] outline-none focus:ring-2 focus:ring-purple-100 resize-none h-24"
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder="Add extra details for this task"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
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
                    }
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold transition-all border ${
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
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
                Assign Client
              </label>
              {lockClient ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-xs font-bold text-[#333333]">
                  {selectedClientLabel || "Client assigned"}
                </div>
              ) : (
                <>
                  <input
                    className="w-full bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                    value={formClientQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormClientQuery(value);
                      setFormClientId("");
                    }}
                    placeholder="Type a client name"
                  />
                  {formClientQuery.trim().length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-gray-100 bg-white shadow-sm">
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
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
                Start date / time
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-28 shrink-0 bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
                End date / time
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-28 shrink-0 bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-2 ml-1">
                Status
              </label>
              <select
                className="w-full bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd] capitalize"
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
            <div />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl border-2 border-gray-100 text-[#333333] font-bold text-xs tracking-widest hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTask}
              className="flex-1 bg-[#9d4edd] text-white py-3 rounded-xl font-bold text-xs tracking-widest shadow-lg shadow-purple-100 hover:bg-[#7b2cbf] transition-all"
            >
              {task ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
