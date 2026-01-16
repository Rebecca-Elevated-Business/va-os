"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Filter, MoreHorizontal, X, Clock, CheckCircle2 } from "lucide-react";
import CalendarView from "./CalendarView";
import KanbanView from "./KanbanView";
import { Task } from "./types";

type ClientOption = {
  id: string;
  business_name: string;
  surname: string;
};

const STATUS_ORDER = ["completed", "in_progress", "up_next", "todo"];

export default function TaskCentrePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [view, setView] = useState<"list" | "calendar" | "kanban">("list");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  // Filters & UI State
  const [filterStatus, setFilterStatus] = useState<string[]>([
    "todo",
    "up_next",
    "in_progress",
    "completed",
  ]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // New Task State
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskClient, setNewTaskClient] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("todo");

  const filterRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*, clients(business_name, surname)")
      .eq("va_id", user.id);

    if (taskData) setTasks(taskData as Task[]);

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, business_name, surname")
      .eq("va_id", user.id);

    if (clientData) setClients(clientData);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Resolved cascading render error by using a non-sync trigger
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        fetchData
      )
      .subscribe();

    const ticker = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(ticker);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // --- ACTIONS ---
  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("tasks").insert([
      {
        va_id: user?.id,
        client_id: newTaskClient || null,
        task_name: newTaskName,
        status: newTaskStatus,
        due_date: newTaskDate || null,
        total_minutes: 0,
        is_running: false,
      },
    ]);
    setIsAdding(false);
    setNewTaskName("");
    setNewTaskDate("");
    setNewTaskStatus("todo");
  };

  const toggleTimer = async (task: Task) => {
    if (task.is_running) {
      if (!task.start_time) return;
      const sessionMins = Math.max(
        1,
        Math.round((Date.now() - new Date(task.start_time).getTime()) / 60000)
      );
      await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          total_minutes: task.total_minutes + sessionMins,
        })
        .eq("id", task.id);
    } else {
      await supabase
        .from("tasks")
        .update({
          is_running: true,
          start_time: new Date().toISOString(),
          status: "in_progress",
        })
        .eq("id", task.id);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await supabase.from("tasks").update(updates).eq("id", taskId);
    if (selectedTask?.id === taskId)
      setSelectedTask({ ...selectedTask, ...updates });
  };

  // Bridge function for Kanban compatibility
  const handleKanbanUpdate = (taskId: string, newStatus: string) => {
    updateTask(taskId, { status: newStatus });
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task permanently?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    setSelectedTask(null);
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
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(["list", "calendar", "kanban"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  view === v
                    ? "bg-white text-[#9d4edd] shadow-sm"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
              <Filter size={14} className="text-gray-400" />
              Filter by Status
            </button>

            {isFilterOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-2">
                {["todo", "up_next", "in_progress", "completed"].map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer text-xs font-semibold capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={filterStatus.includes(s)}
                      onChange={() =>
                        setFilterStatus((prev) =>
                          prev.includes(s)
                            ? prev.filter((x) => x !== s)
                            : [...prev, s]
                        )
                      }
                      className="rounded text-[#9d4edd]"
                    />
                    {s.replace("_", " ")}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="bg-[#9d4edd] text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-[#7b2cbf] transition-all"
        >
          + New Task
        </button>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-10">
          {groupedTasks.length === 0 ? (
            <p className="text-center py-20 text-gray-400 italic">
              No tasks match your filter.
            </p>
          ) : (
            groupedTasks.map((group) => (
              <div key={group.status} className="space-y-2">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50 pb-2 flex items-center gap-2">
                  <CheckCircle2 size={14} /> {group.status.replace("_", " ")}
                </h2>
                <div className="divide-y divide-gray-50">
                  {group.items.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="group flex items-center justify-between py-4 hover:bg-gray-50/50 cursor-pointer transition-colors px-4 -mx-4 rounded-xl"
                    >
                      <div className="flex items-center gap-6 flex-1">
                        <input
                          type="checkbox"
                          checked={task.status === "completed"}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateTask(task.id, {
                              status: e.target.checked ? "completed" : "todo",
                            });
                          }}
                          className="w-5 h-5 rounded-full border-gray-300 text-[#9d4edd]"
                        />
                        <div>
                          <p
                            className={`font-semibold text-sm ${
                              task.status === "completed"
                                ? "line-through text-gray-400"
                                : "text-[#333333]"
                            }`}
                          >
                            {task.task_name}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            {task.clients?.business_name || "Individual"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 text-right">
                        <div className="w-24">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-0.5">
                            Due Date
                          </p>
                          <p className="text-xs font-bold">
                            {task.due_date
                              ? format(new Date(task.due_date), "dd MMM")
                              : "-"}
                          </p>
                        </div>
                        <div className="w-24">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-0.5">
                            Logged
                          </p>
                          <p className="text-xs font-mono font-bold text-[#9d4edd]">
                            {formatTime(task)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTimer(task);
                          }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            task.is_running
                              ? "bg-red-500 text-white animate-pulse"
                              : "bg-gray-100 text-gray-400 hover:text-[#9d4edd]"
                          }`}
                        >
                          {task.is_running ? <Clock size={16} /> : "▶"}
                        </button>
                        <button className="text-gray-300 hover:text-[#9d4edd] p-2">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-10 space-y-8">
              <div className="flex justify-between items-start">
                <div className="flex-1 mr-8">
                  <input
                    className="text-2xl font-black text-[#333333] w-full border-none outline-none focus:ring-0 p-0 mb-2"
                    value={selectedTask.task_name}
                    onChange={(e) =>
                      updateTask(selectedTask.id, { task_name: e.target.value })
                    }
                  />
                  <p className="text-[10px] font-black text-[#9d4edd] uppercase tracking-widest">
                    {selectedTask.clients?.business_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-black"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-6 py-6 border-y border-gray-100">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Status
                  </label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) =>
                      updateTask(selectedTask.id, { status: e.target.value })
                    }
                    className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold capitalize py-2 px-3"
                  >
                    {["todo", "up_next", "in_progress", "completed"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-2 px-3"
                    value={selectedTask.due_date || ""}
                    onChange={(e) =>
                      updateTask(selectedTask.id, { due_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Time Logged
                  </label>
                  <div className="flex items-center gap-2 text-[#9d4edd] font-mono font-bold">
                    <Clock size={14} /> {formatTime(selectedTask)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">
                  Task Details
                </label>
                <textarea
                  className="w-full p-6 bg-gray-50 border-none rounded-3xl outline-none min-h-40 text-sm leading-relaxed"
                  placeholder="Notes, instructions, or links..."
                  value={selectedTask.details || ""}
                  onChange={(e) =>
                    updateTask(selectedTask.id, { details: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => deleteTask(selectedTask.id)}
                  className="text-xs font-bold text-red-300 hover:text-red-500 uppercase tracking-widest"
                >
                  Delete Task
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="bg-[#333333] text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD TASK MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100ex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black mb-6">New Task</h2>
            <div className="space-y-4">
              <input
                autoFocus
                className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-[#9d4edd] font-bold text-[#333333]"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Task name"
              />
              <select
                className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none bg-white text-sm text-[#333333]"
                value={newTaskClient}
                onChange={(e) => setNewTaskClient(e.target.value)}
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.surname} ({c.business_name})
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none text-sm text-[#333333]"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
              />
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddTask}
                  className="flex-1 bg-[#9d4edd] text-white py-3 rounded-xl font-bold uppercase text-xs"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-6 text-gray-400 font-bold text-xs uppercase"
                >
                  Cancel
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
            setNewTaskDate(date);
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
            setNewTaskStatus(status);
            setIsAdding(true);
          }}
        />
      )}
    </div>
  );
}
