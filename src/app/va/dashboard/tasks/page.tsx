"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

// --- TYPES ---
type Task = {
  id: string;
  task_name: string;
  status: string; // 'todo', 'up_next', 'in_progress', 'completed'
  category: string; // 'client', 'business', 'personal'
  priority: string;
  due_date: string | null;
  total_minutes: number;
  is_running: boolean;
  start_time: string | null;
  client_id: string | null;
  clients?: { business_name: string; surname: string };
};

type ClientOption = {
  id: string;
  business_name: string;
  surname: string;
};

export default function TaskCentrePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [view, setView] = useState<"list" | "calendar" | "kanban">("list");
  const [loading, setLoading] = useState(true);

  // Initialize with 0 to avoid hydration mismatches
  const [now, setNow] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string[]>([
    "todo",
    "up_next",
    "in_progress",
  ]);

  // New Task State
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskClient, setNewTaskClient] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("business");
  const [newTaskDate, setNewTaskDate] = useState("");

  // --- GLOBAL TICKER ---
  useEffect(() => {
    // FIX 1: Removed direct setNow(Date.now()) call.
    // We let the interval handle the first update to avoid render cascades.
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch Tasks
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*, clients(business_name, surname)")
      .eq("va_id", user.id)
      .order("created_at", { ascending: false });

    if (taskData) setTasks(taskData as Task[]);

    // 2. Fetch Clients
    const { data: clientData } = await supabase
      .from("clients")
      .select("id, business_name, surname")
      .eq("va_id", user.id);

    if (clientData) setClients(clientData);
    setLoading(false);
  }, []);

  useEffect(() => {
    // FIX 2: Trigger fetch ONLY after subscription is confirmed
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          fetchData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchData();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // --- ACTIONS ---

  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const finalCategory = newTaskClient ? "client" : newTaskCategory;

    await supabase.from("tasks").insert([
      {
        va_id: user?.id,
        client_id: newTaskClient || null,
        task_name: newTaskName,
        status: "todo",
        category: finalCategory,
        due_date: newTaskDate || null,
        total_minutes: 0,
        is_running: false,
      },
    ]);

    setIsAdding(false);
    setNewTaskName("");
    setNewTaskDate("");
  };

  const toggleTimer = async (task: Task) => {
    if (task.is_running) {
      // STOP
      if (!task.start_time) return;
      const start = new Date(task.start_time).getTime();
      const end = Date.now();
      const sessionMins = Math.max(1, Math.round((end - start) / 60000));

      await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          total_minutes: task.total_minutes + sessionMins,
        })
        .eq("id", task.id);
    } else {
      // START
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

  const updateStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
  };

  const formatTime = (task: Task) => {
    let totalSecs = task.total_minutes * 60;

    // Only add live time if 'now' has been initialized
    if (task.is_running && task.start_time && now > 0) {
      totalSecs += (now - new Date(task.start_time).getTime()) / 1000;
    }

    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // --- FILTER LOGIC ---
  const visibleTasks = tasks.filter((t) => filterStatus.includes(t.status));

  if (loading)
    return (
      <div className="p-10 italic text-gray-400">Loading Command Centre...</div>
    );

  return (
    <div className="min-h-screen text-black pb-20">
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Task Command Centre
          </h1>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
            {visibleTasks.length} Active Tasks
          </p>
        </div>

        {/* View Switcher */}
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

        <button
          onClick={() => setIsAdding(true)}
          className="bg-[#9d4edd] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-[#7b2cbf] transition-all"
        >
          + New Task
        </button>
      </div>

      {/* 2. FILTERS */}
      <div className="flex flex-wrap gap-2 mb-8">
        {["todo", "up_next", "in_progress", "completed"].map((status) => (
          <button
            key={status}
            onClick={() =>
              setFilterStatus((prev) =>
                prev.includes(status)
                  ? prev.filter((s) => s !== status)
                  : [...prev, status]
              )
            }
            className={`px-4 py-2 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all ${
              filterStatus.includes(status)
                ? "border-[#9d4edd] bg-purple-50 text-[#9d4edd]"
                : "border-gray-100 text-gray-400 hover:border-gray-300"
            }`}
          >
            {status.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* 3. ADD TASK MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black mb-6">Create New Task</h2>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Task Name
                </label>
                <input
                  autoFocus
                  className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-[#9d4edd] font-bold"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="What needs doing?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Client (Optional)
                  </label>
                  <select
                    className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none bg-white text-sm"
                    value={newTaskClient}
                    onChange={(e) => setNewTaskClient(e.target.value)}
                  >
                    <option value="">-- No Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.surname} ({c.business_name || "Personal"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Selector (Only shows if No Client selected) */}
                {!newTaskClient && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">
                      Category
                    </label>
                    <select
                      className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none bg-white text-sm"
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value)}
                    >
                      <option value="business">My Business</option>
                      <option value="personal">Personal</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none text-sm"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddTask}
                  className="flex-1 bg-[#9d4edd] text-white py-3 rounded-xl font-bold uppercase text-xs"
                >
                  Save Task
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

      {/* 4. LIST VIEW */}
      {view === "list" && (
        <div className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 w-48">Owner / Category</th>
                <th className="px-6 py-4">Task</th>
                <th className="px-6 py-4 w-32">Status</th>
                <th className="px-6 py-4 w-32">Due</th>
                <th className="px-6 py-4 w-32 text-right">Timer</th>
                <th className="px-6 py-4 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10 text-center text-gray-400 italic"
                  >
                    No tasks found. Time for a coffee? ☕
                  </td>
                </tr>
              ) : (
                visibleTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="group hover:bg-purple-50/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {task.client_id ? (
                        <div>
                          <p className="font-bold text-sm">
                            {task.clients?.surname}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase">
                            {task.clients?.business_name}
                          </p>
                        </div>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            task.category === "business"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-pink-100 text-pink-600"
                          }`}
                        >
                          {task.category}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-sm text-gray-700">
                      {task.task_name}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={task.status}
                        onChange={(e) => updateStatus(task.id, e.target.value)}
                        className="bg-gray-100 border-none text-[10px] font-bold uppercase rounded-lg py-1 px-2 cursor-pointer focus:ring-2 focus:ring-[#9d4edd] outline-none"
                      >
                        <option value="todo">To Do</option>
                        <option value="up_next">Up Next</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">
                      {task.due_date
                        ? format(new Date(task.due_date), "dd MMM")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="font-mono text-xs font-bold text-[#9d4edd]">
                          {formatTime(task)}
                        </span>
                        <button
                          onClick={() => toggleTimer(task)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            task.is_running
                              ? "bg-red-500 text-white animate-pulse shadow-red-200 shadow-lg"
                              : "bg-gray-100 text-gray-400 hover:bg-green-500 hover:text-white"
                          }`}
                        >
                          {task.is_running ? "wm" : "▶"}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-gray-300 hover:text-[#9d4edd] font-bold text-lg">
                        ⋮
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PLACEHOLDERS FOR CALENDAR/KANBAN */}
      {view === "calendar" && (
        <div className="p-20 text-center border-4 border-dashed border-gray-200 rounded-4xl">
          <p className="text-gray-400 font-bold uppercase tracking-widest">
            Calendar View Coming Next
          </p>
        </div>
      )}
      {view === "kanban" && (
        <div className="p-20 text-center border-4 border-dashed border-gray-200 rounded-4xl">
          <p className="text-gray-400 font-bold uppercase tracking-widest">
            Kanban Board Coming Soon
          </p>
        </div>
      )}
    </div>
  );
}
