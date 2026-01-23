"use client";

import { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { addMinutes, format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  GripVertical,
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
};

type ColumnVisibility = {
  startDate: boolean;
  endDate: boolean;
  timer: boolean;
  timeCount: boolean;
};

const COLUMN_OPTIONS: { id: keyof ColumnVisibility; label: string }[] = [
  { id: "startDate", label: "Start date" },
  { id: "endDate", label: "End date" },
  { id: "timer", label: "Timer" },
  { id: "timeCount", label: "Time count" },
];

const DEFAULT_COLUMNS: ColumnVisibility = {
  startDate: true,
  endDate: true,
  timer: true,
  timeCount: true,
};

const DEFAULT_COLLAPSED: Record<string, boolean> = {
  completed: true,
};

const DEFAULT_STATUS_ORDER = ["completed", "in_progress", "up_next", "todo"];

const STATUS_PILL_CLASS =
  "text-[10px] font-semibold text-gray-600 border border-gray-200 bg-white";
const CATEGORY_CHIP_CLASS =
  "border border-gray-200 text-gray-500 bg-white";

// 2. CATEGORY CONFIG (Neutral chips)
const CATEGORY_CONFIG: Record<string, CategoryOption> = {
  client: {
    id: "client",
    label: "Client",
  },
  business: {
    id: "business",
    label: "Business",
  },
  personal: {
    id: "personal",
    label: "Personal",
  },
};

const normalizeStatusOrder = (order: string[]) => {
  const allStatuses = Object.keys(STATUS_CONFIG);
  const unique = order.filter((id) => allStatuses.includes(id));
  const missing = allStatuses.filter((id) => !unique.includes(id));
  return [...unique, ...missing];
};

export default function TaskCentrePage() {
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<
    { id: string; business_name: string; surname: string }[]
  >([]);
  const [view, setView] = useState<"list" | "calendar" | "kanban">("list");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Filters (Default: Completed is HIDDEN)
  const [filterStatus, setFilterStatus] = useState<string[]>([
    "todo",
    "up_next",
    "in_progress",
  ]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  const [statusOrder, setStatusOrder] = useState<string[]>(
    normalizeStatusOrder(DEFAULT_STATUS_ORDER)
  );
  const [collapsedStatus, setCollapsedStatus] = useState<Record<string, boolean>>(
    DEFAULT_COLLAPSED
  );
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibility>(DEFAULT_COLUMNS);
  const [draggingStatus, setDraggingStatus] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  // Actions & Modals
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null); // For inline 3-dots menu

  const [modalPrefill, setModalPrefill] = useState<{
    status?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

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

  useEffect(() => {
    const handleRefresh = () => {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
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
      if (
        columnsRef.current &&
        !columnsRef.current.contains(event.target as Node)
      ) {
        setIsColumnsOpen(false);
      }
      // Close action menus if clicking elsewhere
      if (!(event.target as Element).closest(".action-menu-trigger")) {
        setActionMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (view !== "list") setIsColumnsOpen(false);
  }, [view]);

  useEffect(() => {
    if (!userId) return;
    const key = `task-centre:list-preferences:${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        statusOrder?: string[];
        collapsedStatus?: Record<string, boolean>;
        columnVisibility?: Partial<ColumnVisibility>;
      };
      if (parsed.statusOrder) {
        setStatusOrder(normalizeStatusOrder(parsed.statusOrder));
      }
      if (parsed.collapsedStatus) {
        setCollapsedStatus({ ...DEFAULT_COLLAPSED, ...parsed.collapsedStatus });
      }
      if (parsed.columnVisibility) {
        setColumnVisibility({ ...DEFAULT_COLUMNS, ...parsed.columnVisibility });
      }
    } catch (error) {
      console.warn("Failed to load list view preferences", error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const key = `task-centre:list-preferences:${userId}`;
    const payload = {
      statusOrder,
      collapsedStatus,
      columnVisibility,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [userId, statusOrder, collapsedStatus, columnVisibility]);

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

  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (!taskId || deepLinkHandled.current || tasks.length === 0) return;
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    setView("list");
    setSelectedTask(target);
    setIsAdding(true);
    setModalPrefill(null);
    setActionMenuId(null);
    deepLinkHandled.current = true;
  }, [searchParams, tasks]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    patchTask(taskId, { status: newStatus });
    setActionMenuId(null);
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
      const endTime = new Date().toISOString();
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
          end_time: endTime,
          total_minutes: task.total_minutes + sessionMins,
        })
        .eq("id", task.id);
      await supabase.from("time_entries").insert([
        {
          task_id: task.id,
          va_id: task.va_id,
          started_at: task.start_time,
          ended_at: endTime,
          duration_minutes: sessionMins,
        },
      ]);
      patchTask(task.id, {
        is_running: false,
        start_time: null,
        end_time: endTime,
        total_minutes: task.total_minutes + sessionMins,
      });
    } else {
      const startTime = new Date().toISOString();
      await supabase
        .from("tasks")
        .update({
          is_running: true,
          start_time: startTime,
          end_time: null,
          status: "in_progress",
        })
        .eq("id", task.id);
      patchTask(task.id, {
        is_running: true,
        start_time: startTime,
        end_time: null,
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
  const orderedStatuses = normalizeStatusOrder(statusOrder);
  const groupedTasks = orderedStatuses
    .map((status) => ({
      status,
      items: tasks
        .filter((t) => t.status === status && filterStatus.includes(status))
        .sort(
          (a, b) =>
            new Date(b.due_date || 0).getTime() -
            new Date(a.due_date || 0).getTime()
        ),
    }))
    .filter((group) => group.items.length > 0);

  const columnTemplate = [
    "minmax(260px, 1fr)",
    ...(columnVisibility.startDate ? ["110px"] : []),
    ...(columnVisibility.endDate ? ["110px"] : []),
    ...(columnVisibility.timer ? ["56px"] : []),
    ...(columnVisibility.timeCount ? ["90px"] : []),
    "32px",
  ].join(" ");

  const handleToggleStatus = (status: string) => {
    setCollapsedStatus((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  const handleDragStart =
    (status: string) => (event: DragEvent<HTMLButtonElement>) => {
      setDraggingStatus(status);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", status);
    };

  const handleDragOver =
    (status: string) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (dragOverStatus !== status) {
        setDragOverStatus(status);
      }
    };

  const handleDrop =
    (targetStatus: string) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const sourceStatus =
        event.dataTransfer.getData("text/plain") || draggingStatus;
      if (!sourceStatus || sourceStatus === targetStatus) return;
      setStatusOrder((prev) => {
        const normalized = normalizeStatusOrder(prev);
        const without = normalized.filter((id) => id !== sourceStatus);
        const targetIndex = without.indexOf(targetStatus);
        if (targetIndex === -1) return prev;
        without.splice(targetIndex, 0, sourceStatus);
        return without;
      });
      setDraggingStatus(null);
      setDragOverStatus(null);
    };

  const handleDragEnd = () => {
    setDraggingStatus(null);
    setDragOverStatus(null);
  };

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
                        <span className={`px-3 py-1 rounded-full ${STATUS_PILL_CLASS}`}>
                          {s.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Columns */}
          {view === "list" && (
            <div className="relative" ref={columnsRef}>
              <button
                onClick={() => setIsColumnsOpen(!isColumnsOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm text-[#333333]"
              >
                Columns
              </button>
              {isColumnsOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-black text-[#333333] tracking-widest mb-3 ml-1">
                    Visible Columns
                  </p>
                  <div className="space-y-1">
                    {COLUMN_OPTIONS.map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={columnVisibility[column.id]}
                            onChange={() =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [column.id]: !prev[column.id],
                              }))
                            }
                            className="w-4 h-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
                          />
                          <span className="text-xs font-semibold text-gray-600">
                            {column.label}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. New Task Button */}
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
        <div className="space-y-6">
          {groupedTasks.length === 0 ? (
            <p className="text-center py-20 text-gray-400 italic">
              No tasks match your filter.
            </p>
          ) : (
            <>
              <div className="sticky top-16 z-20 bg-white/95 backdrop-blur border border-gray-100 rounded-xl px-4 py-2 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                <div
                  className="grid items-center gap-x-4"
                  style={{ gridTemplateColumns: columnTemplate }}
                >
                  <div>Task</div>
                  {columnVisibility.startDate && (
                    <div className="text-right">Start date</div>
                  )}
                  {columnVisibility.endDate && (
                    <div className="text-right">End date</div>
                  )}
                  {columnVisibility.timer && (
                    <div className="text-center">Timer</div>
                  )}
                  {columnVisibility.timeCount && (
                    <div className="text-right">Time count</div>
                  )}
                  <div />
                </div>
              </div>
              <div className="space-y-6">
                {groupedTasks.map((group) => {
                  const statusConfig =
                    STATUS_CONFIG[group.status] || STATUS_CONFIG["todo"];
                  const isCollapsed = collapsedStatus[group.status] || false;
                  const isDragOver =
                    dragOverStatus === group.status &&
                    draggingStatus !== group.status;

                  return (
                    <div
                      key={group.status}
                      className={`rounded-2xl border border-gray-100 bg-white ${
                        isDragOver ? "ring-1 ring-gray-200" : ""
                      }`}
                    >
                      <div
                        className="flex items-center gap-2 px-4 py-2 border-b border-gray-100"
                        onDragOver={handleDragOver(group.status)}
                        onDrop={handleDrop(group.status)}
                      >
                        <button
                          onClick={() => handleToggleStatus(group.status)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={`Toggle ${statusConfig.label}`}
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleStatus(group.status)}
                          className="flex-1 text-left text-xs font-semibold text-gray-700"
                        >
                          {statusConfig.label}{" "}
                          <span className="text-gray-400">
                            ({group.items.length})
                          </span>
                        </button>
                        <button
                          type="button"
                          draggable
                          onDragStart={handleDragStart(group.status)}
                          onDragEnd={handleDragEnd}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={`Reorder ${statusConfig.label}`}
                        >
                          <GripVertical size={14} />
                        </button>
                      </div>

                      {!isCollapsed && (
                        <div className="divide-y divide-gray-100">
                          {group.items.map((task) => {
                            const catKey =
                              task.category ||
                              (task.client_id ? "client" : "personal");
                            const catConfig =
                              CATEGORY_CONFIG[catKey] ||
                              CATEGORY_CONFIG["personal"];

                            return (
                              <div
                                key={task.id}
                                onClick={() => openEditModal(task)}
                                className="grid items-center gap-x-4 px-4 py-3 hover:bg-gray-50/70 transition-colors cursor-pointer"
                                style={{ gridTemplateColumns: columnTemplate }}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`text-sm font-semibold text-[#333333] truncate ${
                                        task.status === "completed"
                                          ? "line-through opacity-50"
                                          : ""
                                      }`}
                                    >
                                      {task.task_name}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    {task.clients && (
                                      <span className="text-xs font-medium text-gray-400">
                                        {task.clients.surname}
                                      </span>
                                    )}
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_CHIP_CLASS}`}
                                    >
                                      {catConfig.label}
                                    </span>
                                  </div>
                                </div>

                                {columnVisibility.startDate && (
                                  <div className="text-right text-xs font-medium text-gray-600">
                                    {formatDateCell(
                                      task.scheduled_start || task.due_date
                                    )}
                                  </div>
                                )}

                                {columnVisibility.endDate && (
                                  <div className="text-right text-xs font-medium text-gray-600">
                                    {formatDateCell(task.scheduled_end)}
                                  </div>
                                )}

                                {columnVisibility.timer && (
                                  <div className="flex justify-center">
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
                                )}

                                {columnVisibility.timeCount && (
                                  <div className="text-right font-mono text-xs text-[#333333]">
                                    {formatTime(task)}
                                  </div>
                                )}

                                <div className="relative action-menu-trigger flex justify-end">
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActionMenuId(
                                        actionMenuId === task.id
                                          ? null
                                          : task.id
                                      );
                                    }}
                                    className="text-[#333333] transition-colors"
                                  >
                                    <MoreHorizontal size={18} />
                                  </button>

                                  {actionMenuId === task.id && (
                                    <div
                                      className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
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
                                      <div className="px-4 pt-3 pb-2 text-[9px] font-semibold text-gray-400 uppercase tracking-widest border-t border-gray-100">
                                        Move to
                                      </div>
                                      {Object.values(STATUS_CONFIG).map(
                                        (status) => (
                                          <button
                                            key={status.id}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              updateTaskStatus(
                                                task.id,
                                                status.id
                                              );
                                            }}
                                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50 ${
                                              task.status === status.id
                                                ? "text-[#333333]"
                                                : "text-gray-600"
                                            }`}
                                          >
                                            {status.label}
                                          </button>
                                        )
                                      )}
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
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
