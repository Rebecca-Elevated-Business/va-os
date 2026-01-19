"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Circle, Play, Search } from "lucide-react";
import TaskModal from "../tasks/TaskModal";
import { Task } from "../tasks/types";

type TimeEntry = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  created_at: string;
};

const getTodayDateString = () => {
  const now = new Date();
  return now.toISOString().split("T")[0];
};

const formatHms = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const formatEntryTime = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const isEntryInRange = (entry: TimeEntry, start: string, end: string) => {
  const entryDate = new Date(entry.started_at);
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59.999`);
  return entryDate >= startDate && entryDate <= endDate;
};

export default function TimeTrackingPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<
    { id: string; business_name: string; surname: string }[]
  >([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [searchValue, setSearchValue] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(0);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [filterStart, setFilterStart] = useState(getTodayDateString());
  const [filterEnd, setFilterEnd] = useState(getTodayDateString());
  const [activeRange, setActiveRange] = useState({
    start: getTodayDateString(),
    end: getTodayDateString(),
  });
  const [isFilterActive, setIsFilterActive] = useState(false);

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );

  const selectedTask = selectedTaskId ? tasksById.get(selectedTaskId) : null;

  const filteredTasks = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => {
      const clientName = task.clients?.surname?.toLowerCase() || "";
      return (
        task.task_name.toLowerCase().includes(query) ||
        clientName.includes(query)
      );
    });
  }, [searchValue, tasks]);

  const totalSeconds = useMemo(() => {
    if (!selectedTask) return 0;
    let seconds = selectedTask.total_minutes * 60;
    if (selectedTask.is_running && selectedTask.start_time && now > 0) {
      seconds +=
        (now - new Date(selectedTask.start_time).getTime()) / 1000;
    }
    return seconds;
  }, [now, selectedTask]);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*, clients(business_name, surname)")
      .eq("va_id", user.id)
      .order("created_at", { ascending: false });
    if (taskData) setTasks(taskData as Task[]);

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, business_name, surname")
      .eq("va_id", user.id);
    if (clientData) setClients(clientData);
  }, []);

  const loadEntries = useCallback(
    async (rangeStart: string, rangeEnd: string) => {
      if (!userId) return;
      setLoadingEntries(true);
      const startIso = new Date(`${rangeStart}T00:00:00`).toISOString();
      const endIso = new Date(`${rangeEnd}T23:59:59.999`).toISOString();

      const { data } = await supabase
        .from("time_entries")
        .select("id, task_id, started_at, ended_at, duration_minutes, created_at")
        .eq("va_id", userId)
        .gte("started_at", startIso)
        .lte("started_at", endIso)
        .order("started_at", { ascending: false });

      setTimeEntries((data as TimeEntry[]) || []);
      setLoadingEntries(false);
    },
    [userId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    const ticker = setInterval(() => setNow(Date.now()), 1000);

    const taskChannel = supabase
      .channel("time-tracking-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        fetchData
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      clearInterval(ticker);
      supabase.removeChannel(taskChannel);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!userId) return;
    loadEntries(activeRange.start, activeRange.end);
  }, [activeRange, loadEntries, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("time-entries-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "time_entries",
          filter: `va_id=eq.${userId}`,
        },
        (payload) => {
          const entry = payload.new as TimeEntry;
          if (!isEntryInRange(entry, activeRange.start, activeRange.end)) {
            return;
          }
          setTimeEntries((prev) =>
            prev.some((item) => item.id === entry.id)
              ? prev
              : [entry, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRange.end, activeRange.start, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const nowTime = new Date();
    const nextMidnight = new Date(
      nowTime.getFullYear(),
      nowTime.getMonth(),
      nowTime.getDate() + 1
    );
    const timeout = nextMidnight.getTime() - nowTime.getTime();
    const timer = setTimeout(() => {
      if (isFilterActive) return;
      const today = getTodayDateString();
      setFilterStart(today);
      setFilterEnd(today);
      setActiveRange({ start: today, end: today });
    }, timeout);

    return () => clearTimeout(timer);
  }, [isFilterActive]);

  useEffect(() => {
    if (selectedTask && searchValue !== selectedTask.task_name) {
      setSearchValue(selectedTask.task_name);
    }
  }, [searchValue, selectedTask]);

  const applyFilter = () => {
    if (!filterStart || !filterEnd) return;
    setIsFilterActive(true);
    setActiveRange({ start: filterStart, end: filterEnd });
  };

  const clearFilter = () => {
    const today = getTodayDateString();
    setIsFilterActive(false);
    setFilterStart(today);
    setFilterEnd(today);
    setActiveRange({ start: today, end: today });
  };

  const upsertTask = (task: Task) => {
    setTasks((prev) => {
      const index = prev.findIndex((item) => item.id === task.id);
      if (index === -1) return [task, ...prev];
      const next = [...prev];
      next[index] = { ...prev[index], ...task };
      return next;
    });
  };

  const patchTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    );
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id);
    setSearchValue(task.task_name);
    setIsDropdownOpen(false);
  };

  const handleToggleTimer = async () => {
    if (!selectedTask) return;
    if (selectedTask.is_running) {
      if (!selectedTask.start_time) return;
      const endTime = new Date().toISOString();
      const sessionMins = Math.max(
        1,
        Math.round(
          (new Date().getTime() -
            new Date(selectedTask.start_time).getTime()) /
            60000
        )
      );

      const { data: entryData } = await supabase
        .from("time_entries")
        .insert([
          {
            task_id: selectedTask.id,
            va_id: selectedTask.va_id,
            started_at: selectedTask.start_time,
            ended_at: endTime,
            duration_minutes: sessionMins,
          },
        ])
        .select("id, task_id, started_at, ended_at, duration_minutes, created_at")
        .single();

      await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          end_time: endTime,
          total_minutes: selectedTask.total_minutes + sessionMins,
        })
        .eq("id", selectedTask.id);

      patchTask(selectedTask.id, {
        is_running: false,
        start_time: null,
        end_time: endTime,
        total_minutes: selectedTask.total_minutes + sessionMins,
      });

      if (entryData) {
        const entry = entryData as TimeEntry;
        if (isEntryInRange(entry, activeRange.start, activeRange.end)) {
          setTimeEntries((prev) =>
            prev.some((item) => item.id === entry.id)
              ? prev
              : [entry, ...prev]
          );
        }
      }
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
        .eq("id", selectedTask.id);

      patchTask(selectedTask.id, {
        is_running: true,
        start_time: startTime,
        end_time: null,
        status: "in_progress",
      });
    }
  };

  const entryTaskLabel = (entry: TimeEntry) => {
    const task = tasksById.get(entry.task_id);
    if (!task) return "Untitled task";
    return task.task_name;
  };

  const entryClientLabel = (entry: TimeEntry) => {
    const task = tasksById.get(entry.task_id);
    if (!task || !task.clients) return "Internal";
    return task.clients.surname || task.clients.business_name || "Client";
  };

  return (
    <div className="min-h-screen text-[#333333] pb-20 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Time Tracking</h1>
      </header>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="w-full lg:w-3/5" ref={dropdownRef}>
            <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase block mb-2">
              Task
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Select a task to track"
                className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold focus:ring-2 focus:ring-[#9d4edd] outline-none"
                value={searchValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchValue(value);
                  setIsDropdownOpen(true);
                  if (!value) setSelectedTaskId(null);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-bold">
                {filteredTasks.length}
              </div>

              {isDropdownOpen && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-100 bg-white shadow-xl max-h-72 overflow-auto">
                  {filteredTasks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">
                      No tasks found.
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-[#333333] hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{task.task_name}</span>
                          {task.clients?.surname && (
                            <span className="text-[11px] font-bold text-gray-400 shrink-0">
                              {task.clients.surname}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
              <button
                onClick={() => {
                  setEditingTask(null);
                  setIsAdding(true);
                }}
                className="text-[#9d4edd] font-bold hover:text-[#7b2cbf] underline underline-offset-4"
              >
                Create new task
              </button>
              {selectedTask && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <Link
                    href="/va/dashboard/tasks"
                    className="font-semibold text-[#333333] hover:text-[#9d4edd]"
                  >
                    View in Task Centre
                  </Link>
                  {selectedTask.client_id ? (
                    <Link
                      href={`/va/dashboard/crm/profile/${selectedTask.client_id}`}
                      className="font-semibold text-[#333333] hover:text-[#9d4edd]"
                    >
                      Open in CRM
                    </Link>
                  ) : (
                    <span className="text-gray-400">No CRM link</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-between gap-6">
            <div className="text-3xl font-black tracking-widest text-[#333333] font-mono">
              {formatHms(totalSeconds)}
            </div>
            <button
              onClick={handleToggleTimer}
              disabled={!selectedTask}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${
                !selectedTask
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : selectedTask.is_running
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
              }`}
            >
              {selectedTask?.is_running ? (
                <Circle size={14} fill="currentColor" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              {selectedTask?.is_running ? "Stop" : "Start"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-black tracking-widest text-gray-500 uppercase">
            Recent time entries
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col text-xs font-semibold text-gray-500">
              Start date
              <input
                type="date"
                value={filterStart}
                onChange={(event) => setFilterStart(event.target.value)}
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
              />
            </div>
            <div className="flex flex-col text-xs font-semibold text-gray-500">
              End date
              <input
                type="date"
                value={filterEnd}
                onChange={(event) => setFilterEnd(event.target.value)}
                className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
              />
            </div>
            <button
              onClick={applyFilter}
              className="bg-[#9d4edd] text-white px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-[#7b2cbf] transition-colors"
            >
              Search
            </button>
            {isFilterActive && (
              <button
                onClick={clearFilter}
                className="text-xs font-bold text-gray-500 hover:text-[#9d4edd]"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          {loadingEntries ? (
            <div className="text-sm text-gray-400 italic">
              Loading entries...
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-8 text-center">
              No time entries yet. Start tracking to see your history.
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-xl border border-gray-100 px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#333333]">
                        {entryTaskLabel(entry)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {entryClientLabel(entry)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-500">
                        {formatEntryTime(entry.started_at)} -{" "}
                        {formatEntryTime(entry.ended_at)}
                      </p>
                      <p className="text-sm font-mono text-[#333333]">
                        {formatHms(entry.duration_minutes * 60)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskModal
        key={`${editingTask?.id || "new"}-${isAdding ? "open" : "closed"}`}
        isOpen={isAdding}
        onClose={() => {
          setIsAdding(false);
          setEditingTask(null);
        }}
        clients={clients}
        task={editingTask}
        onSaved={(task) => upsertTask(task)}
        onFallbackRefresh={fetchData}
      />
    </div>
  );
}
