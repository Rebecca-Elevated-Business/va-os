"use client";

import { useState, useEffect, use, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// --- TYPES ---
type Client = {
  id: string;
  first_name: string;
  surname: string;
  business_name: string;
  email: string;
  phone: string;
  status: string;
  price_quoted: string;
  work_type: string;
  has_access: boolean;
};

type Task = {
  id: string;
  task_name: string;
  due_date: string | null;
  start_time: string | null;
  is_running: boolean;
  total_minutes: number;
  is_completed: boolean;
  created_at: string;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

type Agreement = {
  id: string;
  title: string;
  status: string;
  last_updated_at: string;
};

// --- COMPONENT ---
export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // --- STATE ---
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientAgreements, setClientAgreements] = useState<Agreement[]>([]);

  // Task Manager State
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [now, setNow] = useState(0); // Initialize with 0 to satisfy React Purity
  // NEW: State for Editing Tasks
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editTaskDate, setEditTaskDate] = useState("");
  // UI States
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");

  // --- DATA FETCHING ---
  const refreshData = useCallback(async () => {
    // 1. Fetch Client
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();
    if (clientData) setClient(clientData);

    // 2. Fetch Notes
    const { data: notesData } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });
    if (notesData) setNotes(notesData || []);

    // 3. Fetch Tasks
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });

    if (tasksData) setTasks(tasksData);
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      await refreshData();
      if (active) setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, [id, refreshData]);

  useEffect(() => {
    async function fetchAgreements() {
      const { data } = await supabase
        .from("client_agreements")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (data) setClientAgreements(data);
    }
    fetchAgreements();
  }, [id]);

  // --- GLOBAL TICKER ---
  // Updates the UI every second so any running tasks show their time ticking up
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS ---

  // 1. Create New Task
  const addTask = async () => {
    if (!newTaskName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();

    // Default billing type based on client setup
    const billingType = client?.work_type === "Ongoing" ? "Retainer" : "Billed";

    await supabase.from("tasks").insert([
      {
        client_id: id,
        va_id: userData.user?.id,
        task_name: newTaskName,
        due_date: newTaskDate || null,
        is_running: false,
        total_minutes: 0,
        is_completed: false,
        billing_type: billingType,
      },
    ]);

    setNewTaskName("");
    setNewTaskDate("");
    refreshData();
  };

  // 2. Toggle Timer (Play/Stop logic)
  const toggleTimer = async (task: Task) => {
    if (task.is_running) {
      // STOPPING: Calculate elapsed time and add to total
      if (!task.start_time) return;
      const start = new Date(task.start_time).getTime();
      const end = new Date().getTime(); // Use new Date() object instead of Date.now()
      const currentSessionMinutes = Math.max(
        1,
        Math.round((end - start) / 60000)
      );

      await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          total_minutes: task.total_minutes + currentSessionMinutes,
        })
        .eq("id", task.id);
    } else {
      // STARTING: Mark as running and save start timestamp
      await supabase
        .from("tasks")
        .update({
          is_running: true,
          start_time: new Date().toISOString(),
        })
        .eq("id", task.id);
    }
    refreshData();
  };

  // 3. Toggle Completion
  const toggleComplete = async (task: Task) => {
    // If task was running, stop it first before completing
    if (task.is_running) await toggleTimer(task);

    await supabase
      .from("tasks")
      .update({
        is_completed: !task.is_completed,
      })
      .eq("id", task.id);
    refreshData();
  };

  // 4. Update Client Info
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const { error } = await supabase
      .from("clients")
      .update({
        first_name: client.first_name,
        surname: client.surname,
        business_name: client.business_name,
        email: client.email,
        phone: client.phone,
        status: client.status,
      })
      .eq("id", id);
    if (!error) {
      setIsEditing(false);
      refreshData();
    }
  };

  // 5. Add Internal Note
  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("client_notes").insert([
      {
        client_id: id,
        va_id: userData.user?.id,
        content: newNote,
      },
    ]);
    setNewNote("");
    refreshData();
  };
  // 6. Delete Task
  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (!error) refreshData();
  };

  // 7. Start Editing
  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskName(task.task_name);
    setEditTaskDate(task.due_date ? task.due_date.split("T")[0] : "");
  };

  // 8. Save Edited Task
  const saveTask = async () => {
    if (!editingTaskId || !editTaskName.trim()) return;

    const { error } = await supabase
      .from("tasks")
      .update({
        task_name: editTaskName,
        due_date: editTaskDate || null,
      })
      .eq("id", editingTaskId);

    if (!error) {
      setEditingTaskId(null);
      refreshData();
    }
  };
  // 6. Generate Portal Link
  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/client/setup?email=${encodeURIComponent(
      client?.email || ""
    )}&id=${id}`;
    setInviteLink(link);
  };

  // --- HELPER: Format Time Display ---
  const formatTime = (task: Task) => {
    // 1. Convert stored minutes to seconds so we can do precise math
    let totalSeconds = task.total_minutes * 60;

    // 2. If running, add the live elapsed seconds
    if (task.is_running && task.start_time) {
      totalSeconds += (now - new Date(task.start_time).getTime()) / 1000;
    }

    // 3. Calculate hours, minutes, AND seconds
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    return `${hrs}h ${mins}m ${secs}s`;
  };

  if (loading) return <div className="p-10 text-black">Loading Profile...</div>;
  if (!client)
    return (
      <div className="p-10 text-black text-center mt-20">Client not found.</div>
    );

  const visibleTasks = tasks.filter((t) =>
    showCompleted ? true : !t.is_completed
  );

  return (
    <div className="flex flex-col h-full text-black space-y-8 pb-20">
      {/* 1. HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {client.first_name} {client.surname}
          </h1>
          <p className="text-gray-500">
            {client.business_name || "No Business Name"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-gray-100 px-4 py-2 rounded-lg font-semibold text-black hover:bg-gray-200"
          >
            {isEditing ? "Cancel" : "Edit Details"}
          </button>
          <button
            onClick={generateInviteLink}
            className="bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#7b2cbf]"
          >
            {inviteLink ? "Link Generated!" : "Issue Portal Access"}
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="p-4 bg-purple-50 border border-[#9d4edd] rounded-lg flex justify-between items-center animate-in fade-in">
          <p className="text-sm font-bold text-purple-900">
            Portal Invite Link:{" "}
            <span className="font-normal text-gray-600 ml-2">{inviteLink}</span>
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteLink);
              alert("Copied!");
            }}
            className="ml-4 bg-white text-[#9d4edd] border border-[#9d4edd] px-3 py-1 rounded font-bold text-xs hover:bg-purple-100"
          >
            Copy
          </button>
        </div>
      )}

      {/* 2. CLIENT INFORMATION (Horizontal Layout) */}
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 border-b pb-2">
          Client Information
        </h2>
        {isEditing ? (
          <form
            onSubmit={handleUpdateClient}
            className="flex flex-wrap gap-4 items-end"
          >
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400">
                FIRST NAME
              </label>
              <input
                className="border p-2 rounded text-black w-32"
                value={client.first_name}
                onChange={(e) =>
                  setClient({ ...client, first_name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400">SURNAME</label>
              <input
                className="border p-2 rounded text-black w-32"
                value={client.surname}
                onChange={(e) =>
                  setClient({ ...client, surname: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400">EMAIL</label>
              <input
                className="border p-2 rounded text-black w-48"
                value={client.email}
                onChange={(e) =>
                  setClient({ ...client, email: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400">PHONE</label>
              <input
                className="border p-2 rounded text-black w-32"
                value={client.phone}
                onChange={(e) =>
                  setClient({ ...client, phone: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400">STATUS</label>
              <select
                className="border p-2 rounded text-black bg-white"
                value={client.status}
                onChange={(e) =>
                  setClient({ ...client, status: e.target.value })
                }
              >
                {["Enquiry", "Provisional", "Won", "Lost"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-[#9d4edd] text-white px-6 py-2 rounded font-bold h-10.5"
            >
              Save
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm">
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold mb-1">
                Email
              </span>
              {client.email || "-"}
            </div>
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold mb-1">
                Phone
              </span>
              {client.phone || "-"}
            </div>
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold mb-1">
                Status
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  client.status === "Won"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100"
                }`}
              >
                {client.status}
              </span>
            </div>
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold mb-1">
                Work Type
              </span>
              {client.work_type}
            </div>
            <div>
              <span className="block text-gray-400 text-xs uppercase font-bold mb-1">
                Price Quote
              </span>
              {client.price_quoted || "-"}
            </div>
          </div>
        )}
      </section>

      {/* 3. TASK MANAGER (Table Layout) */}
      <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Task Manager</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded text-[#9d4edd] focus:ring-[#9d4edd]"
            />
            Show Completed
          </label>
        </div>

        {/* Add New Task Row */}
        <div className="flex gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 mb-1">
              NEW TASK NAME
            </label>
            <input
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-[#9d4edd] text-black"
              placeholder="e.g. Monthly Newsletter"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">
              DUE DATE
            </label>
            <input
              type="date"
              className="border p-2 rounded outline-none focus:ring-2 focus:ring-[#9d4edd] text-black"
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
            />
          </div>
          <button
            onClick={addTask}
            className="bg-black text-white px-6 py-2 rounded font-bold hover:bg-gray-800 h-10.5"
          >
            Add Task
          </button>
        </div>

        {/* Tasks Table */}
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase w-12 text-center">
                  Done
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">
                  Task
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase w-32">
                  Due Date
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase w-24 text-center">
                  Timer
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase w-24 text-right">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-gray-400 italic"
                  >
                    No tasks found.
                  </td>
                </tr>
              ) : (
                visibleTasks.map((task) => {
                  const isEditing = editingTaskId === task.id;

                  return (
                    <tr
                      key={task.id}
                      className={`group hover:bg-gray-50 transition-colors ${
                        task.is_completed ? "bg-gray-50 opacity-60" : ""
                      }`}
                    >
                      {/* 1. CHECKBOX */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => toggleComplete(task)}
                          disabled={isEditing}
                          className="w-5 h-5 text-[#9d4edd] rounded focus:ring-[#9d4edd] cursor-pointer"
                        />
                      </td>

                      {/* 2. TASK NAME (Editable) */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              className="border p-1 rounded w-full text-black focus:ring-2 focus:ring-[#9d4edd] outline-none"
                              value={editTaskName}
                              onChange={(e) => setEditTaskName(e.target.value)}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveTask}
                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingTaskId(null)}
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div
                              className={`font-medium ${
                                task.is_completed
                                  ? "line-through text-gray-400"
                                  : ""
                              }`}
                            >
                              {task.task_name}
                            </div>
                            {/* THE NEW EDIT/DELETE ACTIONS */}
                            <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditing(task)}
                                className="text-[10px] font-bold text-gray-400 hover:text-[#9d4edd] uppercase tracking-wider"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 3. DUE DATE (Editable) */}
                      <td className="px-4 py-3 text-sm text-gray-500 align-top pt-4">
                        {isEditing ? (
                          <input
                            type="date"
                            className="border p-1 rounded w-full focus:ring-2 focus:ring-[#9d4edd] outline-none text-black"
                            value={editTaskDate}
                            onChange={(e) => setEditTaskDate(e.target.value)}
                          />
                        ) : task.due_date ? (
                          new Date(task.due_date).toLocaleDateString("en-GB")
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 4. TIMER BUTTON */}
                      <td className="px-4 py-3 text-center align-top pt-4">
                        {!task.is_completed && !isEditing && (
                          <button
                            onClick={() => toggleTimer(task)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all mx-auto ${
                              task.is_running
                                ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
                                : "bg-green-100 text-green-600 hover:bg-green-200"
                            }`}
                          >
                            {task.is_running ? (
                              <div className="w-3 h-3 bg-current rounded-sm" />
                            ) : (
                              <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-8 border-l-current border-b-[5px] border-b-transparent ml-1" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* 5. TIME DISPLAY */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#9d4edd] align-top pt-4">
                        {formatTime(task)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SERVICE AGREEMENTS SECTION */}
      <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">
            Service Agreements
          </h2>
          <button
            onClick={() => router.push("/va/dashboard/agreements")}
            className="text-sm bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#7b2cbf] transition-all"
          >
            + New Agreement
          </button>
        </div>
        <div className="p-0">
          <table className="w-full text-left">
            <tbody className="divide-y divide-gray-100">
              {clientAgreements.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-400 italic">
                    No agreements issued for this client yet.
                  </td>
                </tr>
              ) : (
                clientAgreements.map((ag) => (
                  <tr key={ag.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-black">{ag.title}</div>
                      <div className="text-xs text-gray-500">
                        Updated:{" "}
                        {new Date(ag.last_updated_at).toLocaleDateString(
                          "en-GB"
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          ag.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : ag.status === "pending_client"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {ag.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() =>
                          router.push(
                            `/va/dashboard/agreements/portal-view/${ag.id}`
                          )
                        }
                        className="text-xs font-bold text-[#9d4edd] hover:underline"
                      >
                        {ag.status === "draft"
                          ? "Review & Issue"
                          : "View Document"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. NOTES (Sticky Bottom) */}
      <section className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-[#9d4edd] flex flex-col h-96">
        <h2 className="text-lg font-bold mb-4">Internal Confidential Notes</h2>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 p-3 rounded-lg border border-gray-100"
            >
              <p className="text-sm text-gray-800">{note.content}</p>
              <span className="text-[10px] text-gray-400 mt-2 block">
                {new Date(note.created_at).toLocaleString("en-GB")}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-[#9d4edd] text-black"
            placeholder="Type a new internal note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <button
            onClick={addNote}
            className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#7b2cbf]"
          >
            Save Note
          </button>
        </div>
      </section>
    </div>
  );
}
