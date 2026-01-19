"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
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
import { Task } from "./types"; // Ensure this type has 'category' if possible, or we cast below

// Define options locally to ensure colors match your request
type StatusOption = {
  id: string;
  label: string;
  color: string;
};

type CategoryOption = {
  id: string;
  label: string;
  color: string;
};

// 1. STATUS CONFIG (Pastels)
const STATUS_CONFIG: Record<string, StatusOption> = {
  todo: { id: "todo", label: "To Do", color: "bg-purple-100 text-purple-700" },
  up_next: {
    id: "up_next",
    label: "Up Next",
    color: "bg-blue-100 text-blue-700",
  },
  in_progress: {
    id: "in_progress",
    label: "In Progress",
    color: "bg-yellow-100 text-yellow-700",
  },
  completed: {
    id: "completed",
    label: "Completed",
    color: "bg-green-100 text-green-700",
  },
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

  // Form State (New/Edit)
  const [formTaskName, setFormTaskName] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formCategory, setFormCategory] = useState<
    "client" | "business" | "personal"
  >("client");
  const [formDate, setFormDate] = useState("");
  const [formStatus, setFormStatus] = useState("todo");

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

  const handleSaveTask = async () => {
    if (!formTaskName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check if we are updating an existing task or creating new
    if (selectedTask) {
      const { data } = await supabase
        .from("tasks")
        .update({
          task_name: formTaskName,
          client_id: formClientId || null,
          status: formStatus,
          due_date: formDate || null,
          category: formCategory,
        })
        .eq("id", selectedTask.id)
        .select("*, clients(business_name, surname)")
        .single();
      if (data) {
        upsertTask(data as Task);
      } else {
        await fetchData();
      }
    } else {
      const { data } = await supabase
        .from("tasks")
        .insert([
          {
            va_id: user?.id,
            task_name: formTaskName,
            client_id: formClientId || null,
            status: formStatus,
            due_date: formDate || null,
            total_minutes: 0,
            is_running: false,
            category: formCategory,
          },
        ])
        .select("*, clients(business_name, surname)")
        .single();
      if (data) {
        upsertTask(data as Task);
      } else {
        await fetchData();
      }
    }

    setIsAdding(false);
    setSelectedTask(null);
    resetForm();
  };

  const resetForm = () => {
    setFormTaskName("");
    setFormClientId("");
    setFormCategory("client");
    setFormDate("");
    setFormStatus("todo");
  };

  const openEditModal = (task: Task) => {
    setFormCategory(
      (task.category || (task.client_id ? "client" : "personal")) as
        | "client"
        | "business"
        | "personal"
    );
    setFormTaskName(task.task_name);
    setFormClientId(task.client_id || "");
    setFormStatus(task.status);
    setFormDate(
      task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : ""
    );

    setSelectedTask(task);
    setIsAdding(true);
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
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">
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
              resetForm();
              setIsAdding(true);
            }}
            className="bg-[#9d4edd] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-purple-100 hover:bg-[#7b2cbf] transition-all flex items-center gap-2"
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
            groupedTasks.map((group) => {
              const statusConfig =
                STATUS_CONFIG[group.status] || STATUS_CONFIG["todo"];

              return (
                <div key={group.status} className="space-y-3">
                  {/* Status Header */}
                  <div className="sticky top-20 z-10 bg-[#fcfcfc] py-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${statusConfig.color}`}
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

                      return (
                        <div
                          key={task.id}
                          className={`relative flex items-center py-4 px-6 hover:bg-gray-50/50 transition-colors ${
                            !isLast ? "border-b border-gray-50" : ""
                          }`}
                        >
                          {/* 1. Status Pill (Quick Change) */}
                          <div className="w-32 shrink-0 relative status-menu-trigger">
                            <button
                              onClick={() =>
                                setStatusMenuId(
                                  statusMenuId === task.id ? null : task.id
                                )
                              }
                              className={`w-full text-center py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:brightness-95 ${statusConfig.color}`}
                            >
                              {statusConfig.label}
                            </button>

                            {statusMenuId === task.id && (
                              <div className="absolute top-full left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in zoom-in duration-200">
                                {Object.values(STATUS_CONFIG).map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() =>
                                      updateTaskStatus(task.id, opt.id)
                                    }
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
                              className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${catConfig.color}`}
                            >
                              {catConfig.label}
                            </div>
                          </div>

                          {/* 3. Meta Data (Date, Timer, Logged) */}
                          <div className="flex items-center gap-8 shrink-0">
                            {/* Due Date */}
                            <div className="w-24 text-right">
                              <span className="text-xs font-medium text-[#333333]">
                                {task.due_date
                                  ? format(new Date(task.due_date), "d MMM")
                                  : "-"}
                              </span>
                            </div>

                            {/* Timer Button */}
                            <div className="w-10 flex justify-center">
                              <button
                                onClick={() => toggleTimer(task)}
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
                                onClick={() =>
                                  setActionMenuId(
                                    actionMenuId === task.id ? null : task.id
                                  )
                                }
                                className="text-gray-300 hover:text-[#333333] transition-colors"
                              >
                                <MoreHorizontal size={18} />
                              </button>

                              {actionMenuId === task.id && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                  <button
                                    onClick={() => openEditModal(task)}
                                    className="w-full text-left px-4 py-3 text-xs font-bold text-[#333333] hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button
                                    onClick={() => deleteTask(task.id)}
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
            })
          )}
        </div>
      )}

      {/* --- ADD/EDIT MODAL --- */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black mb-6 text-[#333333]">
              {selectedTask ? "Edit Task" : "New Task"}
            </h2>

            <div className="space-y-5">
              {/* Task Name */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
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

              {/* Category Selection */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
                  Category
                </label>
                <div className="flex gap-2">
                  {Object.values(CATEGORY_CONFIG).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setFormCategory(
                          cat.id as "client" | "business" | "personal"
                        )
                      }
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                        formCategory === cat.id
                          ? `${cat.color} shadow-sm`
                          : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client Selection (Only if Client Category) */}
              {formCategory === "client" && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
                    Assign Client
                  </label>
                  <select
                    className="w-full bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.surname} ({c.business_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
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
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-white border-2 border-gray-100 rounded-xl p-3 text-xs font-bold text-[#333333] outline-none focus:border-[#9d4edd]"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-xl border-2 border-gray-100 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-[#333333] hover:border-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTask}
                  className="flex-1 bg-[#9d4edd] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-purple-100 hover:bg-[#7b2cbf] transition-all"
                >
                  {selectedTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "calendar" && (
        <CalendarView
          tasks={tasks}
          onAddTask={(date: string) => {
            setFormDate(date);
            setIsAdding(true);
          }}
        />
      )}
      {view === "kanban" && (
        <KanbanView
          tasks={tasks}
          onUpdateStatus={handleKanbanUpdate}
          onToggleTimer={toggleTimer}
          onAddTask={(status: string) => {
            setFormStatus(status);
            setIsAdding(true);
          }}
          filterStatus={filterStatus}
        />
      )}
    </div>
  );
}
