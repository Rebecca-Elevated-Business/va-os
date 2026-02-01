"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type DragEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { addMinutes, format } from "date-fns";
import { usePrompt } from "@/components/ui/PromptProvider";
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
  chipClassName: string;
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
// 2. CATEGORY CONFIG
const CATEGORY_CONFIG: Record<string, CategoryOption> = {
  client: {
    id: "client",
    label: "Client",
    chipClassName: "border border-[#D5E4F7] text-gray-700 bg-[#E8F1FB]",
  },
  business: {
    id: "business",
    label: "Business",
    chipClassName: "border border-[#D9EBDD] text-gray-700 bg-[#EAF6EF]",
  },
  personal: {
    id: "personal",
    label: "Personal",
    chipClassName: "border border-[#F5E2A8] text-gray-700 bg-[#FFF3CC]",
  },
};

const normalizeStatusOrder = (order: string[]) => {
  const allStatuses = Object.keys(STATUS_CONFIG);
  const unique = order.filter((id) => allStatuses.includes(id));
  const missing = allStatuses.filter((id) => !unique.includes(id));
  return [...unique, ...missing];
};

import { useClientSession } from "../ClientSessionContext";

export default function TaskCentrePage() {
  const { confirm, alert } = usePrompt();
  const {
    activeEntry,
    isRunning: isSessionRunning,
    startTaskEntry,
    stopActiveTaskEntry,
    dismissActiveTaskEntry,
    getActiveEntryDurationSeconds,
  } = useClientSession();
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<
    {
      id: string;
      business_name: string;
      first_name: string;
      surname: string;
    }[]
  >([]);
  const [view, setView] = useState<"list" | "calendar" | "kanban">("list");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [vaDisplayName, setVaDisplayName] = useState<string>("");

  // Filters (Default: Completed is HIDDEN)
  const [filterStatus, setFilterStatus] = useState<string[]>([
    "todo",
    "up_next",
    "in_progress",
  ]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterType, setFilterType] = useState<
    "all" | "client" | "business" | "personal"
  >("all");
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const typeFilterRef = useRef<HTMLDivElement>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [showSharedOnly, setShowSharedOnly] = useState(false);

  const [statusOrder, setStatusOrder] = useState<string[]>(
    normalizeStatusOrder(DEFAULT_STATUS_ORDER),
  );
  const [collapsedStatus, setCollapsedStatus] =
    useState<Record<string, boolean>>(DEFAULT_COLLAPSED);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibility>(DEFAULT_COLUMNS);
  const [draggingStatus, setDraggingStatus] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const draggingTaskIdRef = useRef<string | null>(null);
  const prefsLoadedRef = useRef<string | null>(null);

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

    if (prefsLoadedRef.current !== user.id) {
      const key = `task-centre:list-preferences:${user.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
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
            setCollapsedStatus({
              ...DEFAULT_COLLAPSED,
              ...parsed.collapsedStatus,
            });
          }
          if (parsed.columnVisibility) {
            setColumnVisibility({
              ...DEFAULT_COLUMNS,
              ...parsed.columnVisibility,
            });
          }
        } catch (error) {
          console.warn("Failed to load list view preferences", error);
        }
      }
      prefsLoadedRef.current = user.id;
    }

    // Fetch Tasks
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*, clients!tasks_client_id_fkey(business_name, surname)")
      .eq("va_id", user.id)
      .is("deleted_at", null);

    if (taskData) {
      setTasks(taskData as Task[]);
      const taskId = searchParams.get("taskId");
      if (
        taskId &&
        !deepLinkHandled.current &&
        Array.isArray(taskData) &&
        taskData.length > 0
      ) {
        const target = taskData.find((task) => task.id === taskId);
        if (target) {
          setView("list");
          setIsColumnsOpen(false);
          setSelectedTask(target as Task);
          setIsAdding(true);
          setModalPrefill(null);
          setActionMenuId(null);
          deepLinkHandled.current = true;
        }
      }
    }

    // Fetch Clients
    const { data: clientData } = await supabase
      .from("clients")
      .select("id, first_name, surname, business_name")
      .eq("va_id", user.id);

    if (clientData) {
      const normalizedClients = clientData.map((client) => ({
        ...client,
        business_name: client.business_name || "",
        first_name: client.first_name || "",
        surname: client.surname || "",
      }));
      setClients(normalizedClients);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", user.id)
      .single();
    if (profile) {
      setVaDisplayName(profile.display_name || profile.full_name || "");
    }
    setLoading(false);
  }, [searchParams]);

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
        fetchData,
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
        typeFilterRef.current &&
        !typeFilterRef.current.contains(event.target as Node)
      ) {
        setIsTypeFilterOpen(false);
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
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    );
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setIsAdding(true);
    setModalPrefill(null);
    setActionMenuId(null); // Close the inline menu
    void startTaskEntry(task.id, task.client_id);
  };

  const handleCloseTaskModal = async () => {
    if (selectedTask && activeEntry?.task_id === selectedTask.id) {
      const duration = getActiveEntryDurationSeconds();
      if (duration < 5) {
        const dismiss = await confirm({
          title: "Dismiss task from timer report?",
          message: "Close task and dismiss from timer report?",
          confirmLabel: "Dismiss",
          cancelLabel: "Keep open",
        });
        if (!dismiss) return;
        await dismissActiveTaskEntry();
      } else {
        await stopActiveTaskEntry();
      }
    }
    setIsAdding(false);
    setSelectedTask(null);
    setModalPrefill(null);
  };


  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    await handleTaskReorder(taskId, newStatus, null);
    setActionMenuId(null);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await supabase.from("tasks").update(updates).eq("id", taskId);
    patchTask(taskId, updates);
  };

  const handleKanbanUpdate = (taskId: string, newStatus: string) => {
    updateTaskStatus(taskId, newStatus);
  };

  const deleteTask = async (taskId: string) => {
    const ok = await confirm({
      title: "Delete task?",
      message: "Delete this task permanently?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const deletedAt = new Date().toISOString();
    await supabase
      .from("tasks")
      .update({ deleted_at: deletedAt })
      .eq("id", taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, deleted_at: deletedAt } : t)),
    );
    setActionMenuId(null);
  };

  const toggleTimer = async (task: Task) => {
    if (task.is_running) {
      if (!task.start_time) return;
      const endTime = new Date().toISOString();
      const elapsedSeconds = Math.max(
        0,
        Math.round(
          (new Date().getTime() - new Date(task.start_time).getTime()) / 1000,
        ),
      );
      const sessionMins = elapsedSeconds / 60;
      const baseMinutes = Number.isFinite(task.total_minutes)
        ? task.total_minutes
        : 0;
      const nextTotalMinutes = Math.max(0, Math.round(baseMinutes + sessionMins));
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          end_time: endTime,
          total_minutes: nextTotalMinutes,
        })
        .eq("id", task.id);
      if (updateError) {
        await alert({
          title: "Timer not stopped",
          message:
            updateError.message ||
            "We couldn't stop this timer. Please try again.",
          tone: "danger",
        });
        return;
      }
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
        total_minutes: nextTotalMinutes,
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
    const baseMinutes = Number.isFinite(task.total_minutes)
      ? task.total_minutes
      : 0;
    let totalSecs = baseMinutes * 60;
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

  const resolveTaskType = (task: Task) => {
    const raw = (task.category || "").toLowerCase();
    if (raw === "client" || raw === "business" || raw === "personal") {
      return raw;
    }
    return task.client_id ? "client" : "personal";
  };

  const matchesTypeFilter = (task: Task) => {
    if (filterType === "all") return true;
    const resolved = resolveTaskType(task);
    if (filterType !== "client") return resolved === filterType;
    if (resolved !== "client") return false;
    if (!selectedClientId) return true;
    return task.client_id === selectedClientId;
  };

  // --- GROUPING LOGIC ---
  const draftTaskId = "draft-task";
  const isCreatingNew = isAdding && !selectedTask;
  const draftStatus = modalPrefill?.status || "todo";
  const draftTask: Task | null = isCreatingNew
    ? {
        id: draftTaskId,
        va_id: userId || "",
        client_id: null,
        task_name: "",
        status: draftStatus,
        due_date: null,
        scheduled_start: null,
        scheduled_end: null,
        total_minutes: 0,
        is_running: false,
        start_time: null,
        end_time: null,
        category: "personal",
      }
    : null;
  const filteredTasks = tasks.filter(
    (task) =>
      matchesTypeFilter(task) &&
      (!showSharedOnly || Boolean(task.shared_with_client)),
  );
  const listTasks =
    draftTask && matchesTypeFilter(draftTask)
      ? [draftTask, ...filteredTasks]
      : filteredTasks;
  const activeTaskId =
    selectedTask?.id || (isCreatingNew ? draftTaskId : null);
  const orderedStatuses = normalizeStatusOrder(statusOrder);
  const sortTasksByOrder = (items: Task[]) =>
    [...items].sort((a, b) => {
      if (a.id === draftTaskId) return -1;
      if (b.id === draftTaskId) return 1;
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const timeB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return timeB - timeA;
    });
  const groupedTasks = orderedStatuses
    .map((status) => ({
      status,
      items: sortTasksByOrder(
        listTasks.filter(
          (t) => t.status === status && filterStatus.includes(status),
        ),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const columnTemplate = [
    "minmax(260px, 1fr)",
    ...(columnVisibility.startDate ? ["110px"] : []),
    ...(columnVisibility.endDate ? ["110px"] : []),
    ...(columnVisibility.timer ? ["56px"] : []),
    ...(columnVisibility.timeCount ? ["90px"] : []),
    "64px",
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
      event.dataTransfer.setData("application/x-task-status", status);
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
      const taskId =
        draggingTaskIdRef.current ||
        event.dataTransfer.getData("application/x-task-id") ||
        event.dataTransfer.getData("text/plain");
      if (taskId) {
        void handleTaskReorder(taskId, targetStatus, null);
        return;
      }
      const sourceStatus =
        event.dataTransfer.getData("application/x-task-status") ||
        draggingStatus;
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

  const notifyTaskStatusChange = async (task: Task, newStatus: string) => {
    if (!task.shared_with_client || !task.client_id) return;
    if (task.status === newStatus) return;
    await supabase.from("client_notifications").insert([
      {
        client_id: task.client_id,
        task_id: task.id,
        type: "task_status",
        message: `${vaDisplayName || "Your VA"} updated your task: ${task.task_name}`,
      },
    ]);
    if (userId) {
      await supabase.from("task_activity").insert([
        {
          task_id: task.id,
          actor_type: "va",
          actor_id: userId,
          action: "status_changed",
          meta: { from: task.status, to: newStatus },
        },
      ]);
    }
  };

  const handleTaskReorder = async (
    taskId: string,
    targetStatus: string,
    targetId?: string | null,
  ) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const sourceStatus = task.status;
    const targetTasks = sortTasksByOrder(
      tasks.filter(
        (item) =>
          item.status === targetStatus &&
          !item.deleted_at &&
          item.id !== draftTaskId &&
          item.id !== taskId,
      ),
    );
    const insertIndex = targetId
      ? targetTasks.findIndex((item) => item.id === targetId)
      : targetTasks.length;
    if (targetId && insertIndex === -1) return;
    const movedTask: Task = {
      ...task,
      status: targetStatus,
      is_completed: targetStatus === "completed",
    };
    const reorderedTarget = [...targetTasks];
    reorderedTarget.splice(insertIndex, 0, movedTask);
    const targetOrderMap = new Map(
      reorderedTarget.map((item, index) => [item.id, index + 1]),
    );
    const sourceTasks =
      sourceStatus === targetStatus
        ? reorderedTarget
        : sortTasksByOrder(
            tasks.filter(
              (item) =>
                item.status === sourceStatus &&
                !item.deleted_at &&
                item.id !== draftTaskId &&
                item.id !== taskId,
            ),
          );
    const sourceOrderMap =
      sourceStatus === targetStatus
        ? targetOrderMap
        : new Map(
            sourceTasks.map((item, index) => [item.id, index + 1]),
          );
    setTasks((prev) =>
      prev.map((item) => {
        if (item.id === taskId) {
          return {
            ...item,
            status: targetStatus,
            is_completed: targetStatus === "completed",
            sort_order: targetOrderMap.get(item.id) ?? item.sort_order ?? null,
          };
        }
        if (item.status === targetStatus && targetOrderMap.has(item.id)) {
          return {
            ...item,
            sort_order: targetOrderMap.get(item.id) ?? item.sort_order ?? null,
          };
        }
        if (item.status === sourceStatus && sourceOrderMap.has(item.id)) {
          return {
            ...item,
            sort_order: sourceOrderMap.get(item.id) ?? item.sort_order ?? null,
          };
        }
        return item;
      }),
    );
    await supabase
      .from("tasks")
      .update({
        status: targetStatus,
        is_completed: targetStatus === "completed",
      })
      .eq("id", taskId);
    await Promise.all([
      ...reorderedTarget.map((item, index) =>
        supabase
          .from("tasks")
          .update({ sort_order: index + 1 })
          .eq("id", item.id),
      ),
      ...(sourceStatus === targetStatus
        ? []
        : sourceTasks.map((item, index) =>
            supabase
              .from("tasks")
              .update({ sort_order: index + 1 })
              .eq("id", item.id),
          )),
    ]);
    await notifyTaskStatusChange(task, targetStatus);
    setDraggingTaskId(null);
    setDragOverTaskId(null);
    draggingTaskIdRef.current = null;
  };

  const handleTaskDragStart =
    (task: Task) => (event: DragEvent<HTMLButtonElement>) => {
      setDraggingTaskId(task.id);
      draggingTaskIdRef.current = task.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-task-id", task.id);
      event.dataTransfer.setData("text/plain", task.id);
    };

  const handleTaskDragOver =
    (task: Task) => (event: DragEvent<HTMLDivElement>) => {
      const dragId = draggingTaskIdRef.current;
      if (!dragId || dragId === task.id) return;
      event.preventDefault();
      setDragOverTaskId(task.id);
    };

  const handleTaskDrop =
    (task: Task) => async (event: DragEvent<HTMLDivElement>) => {
      const dragId = draggingTaskIdRef.current;
      if (!dragId || dragId === task.id) return;
      event.preventDefault();
      event.stopPropagation();
      await handleTaskReorder(dragId, task.status, task.id);
    };

  const handleTaskDropToEnd =
    (status: string) => async (event: DragEvent<HTMLDivElement>) => {
      const dragId = draggingTaskIdRef.current;
      if (!dragId) return;
      event.preventDefault();
      await handleTaskReorder(dragId, status, null);
    };

  const handleTaskDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverTaskId(null);
    draggingTaskIdRef.current = null;
  };

  const handleViewChange = (nextView: "list" | "calendar" | "kanban") => {
    setView(nextView);
    if (nextView !== "list") {
      setIsColumnsOpen(false);
    }
  };

  const handleTypeFilterChange = (
    nextType: "all" | "client" | "business" | "personal",
  ) => {
    setFilterType(nextType);
    setIsTypeFilterOpen(false);
    if (nextType === "client") {
      setIsClientModalOpen(true);
    } else {
      setIsClientModalOpen(false);
    }
  };

  const handleClearAllFilters = () => {
    setFilterStatus(["todo", "up_next", "in_progress"]);
    setIsFilterOpen(false);
    setFilterType("all");
    setIsTypeFilterOpen(false);
    setSelectedClientId(null);
    setClientSearch("");
    setIsClientModalOpen(false);
    setShowSharedOnly(false);
  };

  const selectedClient = selectedClientId
    ? clients.find((client) => client.id === selectedClientId)
    : null;
  const selectedClientName = selectedClient
    ? `${selectedClient.first_name || ""} ${selectedClient.surname || ""}`.trim()
    : "";
  const selectedClientLabel = selectedClient
    ? selectedClientName
      ? `${selectedClientName}${selectedClient.business_name ? ` (${selectedClient.business_name})` : ""}`
      : selectedClient.business_name || ""
    : "";
  const typeFilterLabel =
    filterType === "all"
      ? "Filter by Type"
      : filterType === "client"
        ? selectedClientLabel
          ? `Client: ${selectedClientLabel}`
          : "Type: Client"
        : `Type: ${filterType.charAt(0).toUpperCase()}${filterType.slice(1)}`;
  const filteredClients = clientSearch.trim()
    ? clients.filter((client) => {
        const name = `${client.first_name || ""} ${client.surname || ""} ${
          client.business_name || ""
        }`
          .trim()
          .toLowerCase();
        return name.includes(clientSearch.toLowerCase().trim());
      })
    : [];


  if (loading)
    return (
      <div className="p-10 italic text-gray-400">Loading Task Centre...</div>
    );

  const pageBottomPadding =
    view === "calendar" || view === "kanban" ? "pb-6" : "pb-20";

  return (
    <div
      className={`min-h-screen text-[#333333] font-sans ${pageBottomPadding} ${
        isAdding ? "md:pr-115" : ""
      }`}
    >
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
                    handleViewChange(v.id as "list" | "calendar" | "kanban")
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
                                : [...prev, s.id],
                            )
                          }
                          className="w-4 h-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
                        />
                        <span
                          className={`px-3 py-1 rounded-full ${STATUS_PILL_CLASS}`}
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

          {/* 3. Type Filter */}
          <div className="relative" ref={typeFilterRef}>
            <button
              onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm text-[#333333]"
            >
              <Filter size={14} className="text-gray-400" />
              {typeFilterLabel}
            </button>

            {isTypeFilterOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black text-[#333333] tracking-widest mb-3 ml-1">
                  Task Type
                </p>
                <div className="space-y-1">
                  {[
                    { id: "all", label: "All Types" },
                    { id: "client", label: "Client" },
                    { id: "business", label: "Business" },
                    { id: "personal", label: "Personal" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() =>
                        handleTypeFilterChange(
                          option.id as
                            | "all"
                            | "client"
                            | "business"
                            | "personal",
                        )
                      }
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold transition-colors ${
                        filterType === option.id
                          ? "bg-gray-50 text-[#333333]"
                          : "text-gray-500 hover:bg-gray-50 hover:text-[#333333]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Shared Filter */}
          <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#333333] shadow-sm">
            <input
              type="checkbox"
              checked={showSharedOnly}
              onChange={(e) => setShowSharedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
            />
            Shared only
          </label>

          {/* 4. Columns */}
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

          {/* 5. New Task Button */}
          <button
            onClick={() => {
              setSelectedTask(null);
              setModalPrefill(null);
              setIsAdding(true);
              setActionMenuId(null);
            }}
            className="bg-[#9d4edd] text-white px-5 py-2.5 rounded-xl font-bold text-xs tracking-widest shadow-lg shadow-purple-100 hover:bg-[#7b2cbf] transition-all flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> New Task
          </button>
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="text-[10px] font-semibold text-[#333333] hover:text-[#333333]/70 transition-colors"
          >
            Clear all filters
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
                          className="flex-1 text-left text-sm font-semibold text-gray-700"
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
                        <div
                          className="divide-y divide-gray-100"
                          onDragOver={(event) => {
                            if (!draggingTaskIdRef.current) return;
                            event.preventDefault();
                          }}
                          onDrop={handleTaskDropToEnd(group.status)}
                        >
                          {group.items.map((task) => {
                            const catKey =
                              task.category ||
                              (task.client_id ? "client" : "personal");
                            const catConfig =
                              CATEGORY_CONFIG[catKey] ||
                              CATEGORY_CONFIG["personal"];
                            const isDraft = task.id === draftTaskId;
                            const clientDeleted = Boolean(task.client_deleted_at);

                            return (
                              <div
                                key={task.id}
                                onDragOver={handleTaskDragOver(task)}
                                onDragLeave={() => {
                                  if (dragOverTaskId === task.id) {
                                    setDragOverTaskId(null);
                                  }
                                }}
                                onDrop={handleTaskDrop(task)}
                                onClick={() => {
                                  if (isDraft) return;
                                  openEditModal(task);
                                }}
                                className={`grid items-center gap-x-4 px-4 py-3 transition-colors cursor-pointer ${
                                  activeTaskId === task.id
                                    ? "bg-purple-50/70 ring-1 ring-purple-100"
                                    : clientDeleted
                                      ? "bg-red-50/60 hover:bg-red-50/80"
                                      : "hover:bg-gray-50/70"
                                } ${
                                  dragOverTaskId === task.id
                                    ? "bg-purple-50/80 ring-1 ring-purple-100"
                                    : ""
                                }`}
                                style={{ gridTemplateColumns: columnTemplate }}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-start gap-2 min-w-0">
                                    {!isDraft ? (
                                      <button
                                        type="button"
                                        draggable
                                        onDragStart={handleTaskDragStart(task)}
                                        onDragEnd={handleTaskDragEnd}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors"
                                        aria-label="Drag to reorder"
                                      >
                                        <GripVertical size={14} />
                                      </button>
                                    ) : (
                                      <div className="w-4" />
                                    )}
                                    <div className="min-w-0">
                                      <span
                                        className={`text-sm font-semibold text-[#333333] truncate ${
                                          task.status === "completed"
                                            ? "line-through opacity-50"
                                            : ""
                                        }`}
                                      >
                                        {task.id === draftTaskId ? (
                                          <span className="italic text-gray-400">
                                            New task
                                          </span>
                                        ) : (
                                          task.task_name
                                        )}
                                      </span>
                                      <div className="mt-1 flex items-center gap-2">
                                        {task.clients && (
                                          <span className="text-xs font-medium text-gray-400">
                                            {task.clients.surname}
                                          </span>
                                        )}
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${catConfig.chipClassName}`}
                                        >
                                          {catConfig.label}
                                        </span>
                                        {task.shared_with_client && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                                            Shared
                                          </span>
                                        )}
                                        {clientDeleted && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
                                            Client deleted
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {columnVisibility.startDate && (
                                  <div className="text-right text-xs font-medium text-gray-600">
                                    {formatDateCell(
                                      task.scheduled_start || task.due_date,
                                    )}
                                  </div>
                                )}

                                {columnVisibility.endDate && (
                                  <div className="text-right text-xs font-medium text-gray-600">
                                    {formatDateCell(
                                      task.scheduled_end ||
                                        (task.scheduled_start
                                          ? null
                                          : task.due_date),
                                    )}
                                  </div>
                                )}

                                {columnVisibility.timer && (
                                  <div className="flex justify-center">
                                    {isDraft ? (
                                      <span className="text-xs text-gray-300">
                                        -
                                      </span>
                                    ) : (
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (isSessionRunning) return;
                                          toggleTimer(task);
                                        }}
                                        disabled={isSessionRunning}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                          isSessionRunning
                                            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                            : task.is_running
                                            ? "bg-red-50 text-red-500 border border-red-100 animate-pulse"
                                            : "bg-green-50 text-green-600 border border-green-100 hover:bg-green-100"
                                        }`}
                                      >
                                        {task.is_running && !isSessionRunning ? (
                                          <Square
                                            size={10}
                                            fill="currentColor"
                                          />
                                        ) : (
                                          <Play size={12} fill="currentColor" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {columnVisibility.timeCount && (
                                  <div className="text-right font-mono text-xs text-[#333333]">
                                    {isDraft ? "-" : formatTime(task)}
                                  </div>
                                )}

                                <div className="relative action-menu-trigger flex items-center justify-end gap-2">
                                  {isDraft ? (
                                    <span className="text-xs text-gray-300">
                                      -
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setActionMenuId(
                                            actionMenuId === task.id
                                              ? null
                                              : task.id,
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
                                                    status.id,
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
                                            ),
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
                                    </>
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

      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 animate-in fade-in slide-in-from-top-3">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#333333]">
                  Select Client
                </h3>
                <p className="text-xs text-gray-500">
                  Search and lock in the client for this filter.
                </p>
              </div>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="text-[#333333] hover:text-[#333333]/80 text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Start typing a client name..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-[#333333] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9d4edd]/40"
              />

              {selectedClientLabel && (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-xs font-semibold text-[#333333]">
                    {selectedClientLabel}
                  </span>
                  <button
                    onClick={() => setSelectedClientId(null)}
                    className="text-red-500 text-xs font-bold"
                    aria-label="Clear selected client"
                  >
                    ✕
                  </button>
                </div>
              )}

              {!selectedClientId && (
                <>
                  {filteredClients.length > 0 && (
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-white">
                      {filteredClients.map((client) => {
                        const name = `${client.first_name || ""} ${
                          client.surname || ""
                        }`.trim();
                        return (
                          <button
                            key={client.id}
                            onClick={() => setSelectedClientId(client.id)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-[#333333] hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-[#333333]">
                              {name || "Unnamed Client"}
                            </span>
                            {client.business_name && (
                              <span className="text-[#525252]">
                                {" "}
                                ({client.business_name})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {clientSearch.trim() && filteredClients.length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-400">
                      No clients found.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#9d4edd] text-white hover:bg-[#7b2cbf] transition-colors"
              >
                Select Client
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskModal
        key={`${selectedTask?.id || "new"}-${modalPrefill?.status || ""}-${
          modalPrefill?.startDate || ""
        }-${modalPrefill?.startTime || ""}-${modalPrefill?.endDate || ""}-${
          modalPrefill?.endTime || ""
        }-${isAdding ? "open" : "closed"}`}
        isOpen={isAdding}
        onClose={handleCloseTaskModal}
        clients={clients}
        task={selectedTask}
        prefill={modalPrefill}
        variant="side"
        onSaved={(task) => upsertTask(task)}
        onFallbackRefresh={fetchData}
      />

      {view === "calendar" && (
        <CalendarView
          tasks={filteredTasks}
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
          onOpenTask={openEditModal}
        />
      )}
      {view === "kanban" && (
        <KanbanView
          tasks={filteredTasks}
          onUpdateStatus={handleKanbanUpdate}
          onReorderTask={(taskId, newStatus, beforeTaskId) =>
            handleTaskReorder(taskId, newStatus, beforeTaskId ?? null)
          }
          onToggleTimer={async (task) => {
            if (isSessionRunning) return;
            await toggleTimer(task);
          }}
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
