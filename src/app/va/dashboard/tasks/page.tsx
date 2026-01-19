"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { addMinutes, format } from "date-fns";
import {
  Filter,
  MoreHorizontal,
  List,
  Calendar,
  Trello,
  Play,
  Square,
  Edit2,
  Trash2,
} from "lucide-react";
import CalendarView from "./CalendarView";
import KanbanView from "./KanbanView";
import { STATUS_CONFIG, Task } from "./types"; // Ensure this type has 'category' if possible, or we cast below
import TaskModal from "./TaskModal";

type CategoryOption = {
  id: string;
  label: string;
  color: string;
};

// 2. CATEGORY CONFIG (New 3 Colors)
// Sage (Client), Sand (Business), Lavender (Personal)
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

// 3. SORT ORDER (Completed at Top -> Todo at Bottom)
const STATUS_ORDER = ["completed", "in_progress", "up_next", "todo"];

export default function TaskCentrePage() {
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<
    { id: string; business_name: string; surname: string }[]
  >([]);
  const [view, setView] = useState<"list" | "calendar" | "kanban">("list");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  // Filters (Default: Completed is HIDDEN)
  const [filterStatus, setFilterStatus] = useState<string[]>([
    "todo",
    "up_next",
    "in_progress",
  ]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Actions & Modals
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null); // For inline 3-dots menu
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null); // For inline status pill

  const [modalPrefill, setModalPrefill] = useState<{
    status?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  } | null>(null);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Tasks
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*, clients(business_name, surname)")
      .eq("va_id", user.id);

    if (taskData) setTasks(taskData as Task[]);

    // Fetch Clients
    const { data: clientData } = await supabase
      .from("clients")
      .select("id, business_name, surname")
      .eq("va_id", user.id);

    if (clientData) setClients(clientData);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 1. Wrap fetchData to prevent cascading render error
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    const ticker = setInterval(() => setNow(Date.now()), 1000);

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        fetchData
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      clearInterval(ticker);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Click Outside Listener to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
      // Close action menus if clicking elsewhere
      if (!(event.target as Element).closest(".action-menu-trigger")) {
        setActionMenuId(null);
      }
      if (!(event.target as Element).closest(".status-menu-trigger")) {
        setStatusMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- ACTIONS ---
  const upsertTask = (task: Task) => {
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === task.id);
      if (index === -1) return [task, ...prev];
      const next = [...prev];
      next[index] = { ...prev[index], ...task };
      return next;
    });
  };

  const patchTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setIsAdding(true);
    setModalPrefill(null);
    setActionMenuId(null); // Close the inline menu
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    patchTask(taskId, { status: newStatus });
    setStatusMenuId(null);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await supabase.from("tasks").update(updates).eq("id", taskId);
    patchTask(taskId, updates);
  };

  const handleKanbanUpdate = (taskId: string, newStatus: string) => {
    updateTask(taskId, { status: newStatus });
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task permanently?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActionMenuId(null);
  };

  const toggleTimer = async (task: Task) => {
    if (task.is_running) {
      if (!task.start_time) return;
      const sessionMins = Math.max(
        1,
        Math.round(
          (new Date().getTime() - new Date(task.start_time).getTime()) / 60000
        )
      );
      await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          total_minutes: task.total_minutes + sessionMins,
        })
        .eq("id", task.id);
      patchTask(task.id, {
        is_running: false,
        start_time: null,
        total_minutes: task.total_minutes + sessionMins,
      });
    } else {
      await supabase
        .from("tasks")
        .update({
          is_running: true,
          start_time: new Date().toISOString(),
          status: "in_progress",
        })
        .eq("id", task.id);
      patchTask(task.id, {
        is_running: true,
        start_time: new Date().toISOString(),
        status: "in_progress",
      });
    }
  };

  const formatTime = (task: Task) => {
    let totalSecs = task.total_minutes * 60;
    if (task.is_running && task.start_time && now > 0) {
      totalSecs += (now - new Date(task.start_time).getTime()) / 1000;
    }
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatDateCell = (dateValue: string | null | undefined) => {
    if (!dateValue) return "-";
    return format(new Date(dateValue), "d MMM");
  };

  // --- GROUPING LOGIC ---
  const groupedTasks = STATUS_ORDER.map((status) => ({
    status,
    items: tasks
      .filter((t) => t.status === status && filterStatus.includes(status))
      .sort(
        (a, b) =>
          new Date(b.due_date || 0).getTime() -
          new Date(a.due_date || 0).getTime()
      ),
  })).filter((group) => group.items.length > 0);

  if (loading)
    return (
      <div className="p-10 italic text-gray-400">Loading Task Centre...</div>
    );

  return (
    <div className="min-h-screen text-[#333333] pb-20 font-sans">
      <header className="mb-8">
        <h1>Task Centre</h1>
      </header>

      {/* CONTROL BAR */}
      <div className="flex items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-4">
          {/* 1. View Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {[
              { id: "list", label: "List", icon: List },
              { id: "calendar", label: "Calendar", icon: Calendar },
              { id: "kanban", label: "Kanban", icon: Trello },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() =>
                    setView(v.id as "list" | "calendar" | "kanban")
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    view === v.id
                      ? "bg-white text-[#9d4edd] shadow-sm"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  <Icon size={14} />
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* 2. Status Filter */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm text-[#333333]"
            >
              <Filter size={14} className="text-gray-400" />
              Filter by Status
            </button>

            {isFilterOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black text-[#333333] tracking-widest mb-3 ml-1">
                  Visible Statuses
                </p>
                <div className="space-y-1">
                  {Object.values(STATUS_CONFIG).map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={filterStatus.includes(s.id)}
                          onChange={() =>
                            setFilterStatus((prev) =>
                              prev.includes(s.id)
                                ? prev.filter((x) => x !== s.id)
                                : [...prev, s.id]
                            )
                          }
                          className="w-4 h-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
                        />
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.color}`}
                        >
                          {s.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. New Task Button */}
          <button
            onClick={() => {
              setSelectedTask(null);
              setModalPrefill(null);
              setIsAdding(true);
            }}
            className="bg-[#9d4edd] text-white px-5 py-2.5 rounded-xl font-bold text-xs tracking-widest shadow-lg shadow-purple-100 hover:bg-[#7b2cbf] transition-all flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> New Task
          </button>
        </div>
      </div>

      {/* --- LIST VIEW --- */}
      {view === "list" && (
        <div className="space-y-8">
          {groupedTasks.length === 0 ? (
            <p className="text-center py-20 text-gray-400 italic">
              No tasks match your filter.
            </p>
          ) : (
            <>
              <div className="sticky top-16 z-20 bg-[#fcfcfc] border border-gray-100 rounded-xl px-6 py-3 text-[10px] font-black tracking-widest text-[#333333]">
                <div className="flex items-center">
                  <div className="w-32 shrink-0">Status</div>
                  <div className="flex-1 px-6">Task</div>
                  <div className="w-24 text-right">Start Date</div>
                  <div className="w-24 text-right">End Date</div>
                  <div className="w-10 text-center">Timer</div>
                  <div className="w-20 text-right">Time Count</div>
                  <div className="w-6" />
                </div>
              </div>
              {groupedTasks.map((group) => {
                const statusConfig =
                  STATUS_CONFIG[group.status] || STATUS_CONFIG["todo"];

                return (
                  <div key={group.status} className="space-y-3">
                    {/* Status Header */}
                    <div className="sticky top-28 z-10 bg-[#fcfcfc] py-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-md text-[10px] font-black tracking-widest ${statusConfig.color}`}
                      >
                        {statusConfig.label} ({group.items.length})
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                      {group.items.map((task, index) => {
                        // Determine Category Style
                        const catKey =
                          task.category ||
                          (task.client_id ? "client" : "personal");
                        const catConfig =
                          CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG["personal"];
                        const isLast = index === group.items.length - 1;
                        const taskStatusConfig =
                          STATUS_CONFIG[task.status] || STATUS_CONFIG["todo"];

                        return (
                          <div
                            key={task.id}
                            onClick={() => openEditModal(task)}
                            className={`relative flex items-center py-4 px-6 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                              !isLast ? "border-b border-gray-50" : ""
                            }`}
                          >
                          {/* 1. Status Pill (Quick Change) */}
                          <div className="w-32 shrink-0 relative status-menu-trigger">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setStatusMenuId(
                                  statusMenuId === task.id ? null : task.id
                                );
                              }}
                              className={`w-full text-center py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all hover:brightness-95 ${taskStatusConfig.color}`}
                            >
                              {taskStatusConfig.label}
                            </button>

                            {statusMenuId === task.id && (
                              <div
                                className="absolute top-full left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in zoom-in duration-200"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {Object.values(STATUS_CONFIG).map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateTaskStatus(task.id, opt.id);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-[10px] font-bold rounded-lg hover:bg-gray-50 mb-1 ${opt.color}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. Task Content (Client -> Title -> Category) */}
                          <div className="flex-1 px-6 min-w-0">
                            <div className="flex items-baseline gap-3 mb-1">
                              {/* Client Name (Left of title) */}
                              {task.clients && (
                                <span className="text-xs font-bold text-gray-400 shrink-0">
                                  {task.clients.surname}
                                </span>
                              )}

                              {/* Task Title */}
                              <span
                                className={`text-sm font-bold text-[#333333] truncate ${
                                  task.status === "completed"
                                    ? "line-through opacity-50"
                                    : ""
                                }`}
                              >
                                {task.task_name}
                              </span>
                            </div>

                            {/* Category Tag (Underneath) */}
                            <div
                              className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold tracking-wider border ${catConfig.color}`}
                            >
                              {catConfig.label}
                            </div>
                          </div>

                          {/* 3. Meta Data (Date, Timer, Logged) */}
                          <div className="flex items-center gap-6 shrink-0">
                            {/* Start Date */}
                            <div className="w-24 text-right">
                              <span className="text-xs font-medium text-[#333333]">
                                {formatDateCell(
                                  task.scheduled_start || task.due_date
                                )}
                              </span>
                            </div>

                            {/* End Date */}
                            <div className="w-24 text-right">
                              <span className="text-xs font-medium text-[#333333]">
                                {formatDateCell(task.scheduled_end)}
                              </span>
                            </div>

                            {/* Timer Button */}
                            <div className="w-10 flex justify-center">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleTimer(task);
                                }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                  task.is_running
                                    ? "bg-red-50 text-red-500 border border-red-100 animate-pulse"
                                    : "bg-green-50 text-green-600 border border-green-100 hover:bg-green-100"
                                }`}
                              >
                                {task.is_running ? (
                                  <Square size={10} fill="currentColor" />
                                ) : (
                                  <Play size={12} fill="currentColor" />
                                )}
                              </button>
                            </div>

                            {/* Time Logged */}
                            <div className="w-20 text-right font-mono text-xs text-[#333333]">
                              {formatTime(task)}
                            </div>

                            {/* 4. Action Menu (Inline Edit/Delete) */}
                            <div className="relative action-menu-trigger w-6 flex justify-end">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActionMenuId(
                                    actionMenuId === task.id ? null : task.id
                                  );
                                }}
                                className="text-[#333333] transition-colors"
                              >
                                <MoreHorizontal size={18} />
                              </button>

                              {actionMenuId === task.id && (
                                <div
                                  className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEditModal(task);
                                    }}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-[#333333] hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteTask(task.id);
                                    }}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </>
          )}
        </div>
      )}

      <TaskModal
        key={`${selectedTask?.id || "new"}-${modalPrefill?.status || ""}-${
          modalPrefill?.startDate || ""
        }-${modalPrefill?.startTime || ""}-${modalPrefill?.endDate || ""}-${
          modalPrefill?.endTime || ""
        }-${isAdding ? "open" : "closed"}`}
        isOpen={isAdding}
        onClose={() => {
          setIsAdding(false);
          setSelectedTask(null);
          setModalPrefill(null);
        }}
        clients={clients}
        task={selectedTask}
        prefill={modalPrefill}
        onSaved={(task) => upsertTask(task)}
        onFallbackRefresh={fetchData}
      />

      {view === "calendar" && (
        <CalendarView
          tasks={tasks}
          onAddTask={(date: string, time?: string) => {
            setSelectedTask(null);
            if (time) {
              const startValue = `${date}T${time}`;
              const startDate = new Date(startValue);
              const endDate = addMinutes(startDate, 60);
              setModalPrefill({
                startDate: format(startDate, "yyyy-MM-dd"),
                startTime: format(startDate, "HH:mm"),
                endDate: format(endDate, "yyyy-MM-dd"),
                endTime: format(endDate, "HH:mm"),
              });
            } else {
              setModalPrefill({
                startDate: date,
                startTime: "",
                endDate: "",
                endTime: "",
              });
            }
            setIsAdding(true);
          }}
          onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
        />
      )}
      {view === "kanban" && (
        <KanbanView
          tasks={tasks}
          onUpdateStatus={handleKanbanUpdate}
          onToggleTimer={toggleTimer}
          onOpenTask={openEditModal}
          onDeleteTask={deleteTask}
          onAddTask={(status: string) => {
            setSelectedTask(null);
            setModalPrefill({ status });
            setIsAdding(true);
          }}
          filterStatus={filterStatus}
        />
      )}
    </div>
  );
}
