"use client";

import { useState, useEffect, use, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  start_time: string;
  end_time: string | null;
  is_running: boolean;
  total_minutes: number;
  created_at: string;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

// --- COMPONENT ---
export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // --- STATE ---
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Form States
  const [newNote, setNewNote] = useState("");
  const [taskName, setTaskName] = useState("");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

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

    // 3. Fetch Tasks (For the log and active state)
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });

    if (tasksData) {
      setTasks(tasksData);
      // Check if any task is currently running
      const running = tasksData.find((t) => t.is_running);
      setActiveTask(running || null);
    }
  }, [id]);

  // Initial Load
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

  // --- TIMER LOGIC (The Live Clock) ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTask && activeTask.start_time) {
      interval = setInterval(() => {
        const start = new Date(activeTask.start_time).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 1000);

        // Format to HH:MM:SS
        const hrs = Math.floor(diff / 3600)
          .toString()
          .padStart(2, "0");
        const mins = Math.floor((diff % 3600) / 60)
          .toString()
          .padStart(2, "0");
        const secs = (diff % 60).toString().padStart(2, "0");
        setElapsedTime(`${hrs}:${mins}:${secs}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTask]);

  // --- ACTIONS ---

  // 1. Update Client Details
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

  // 2. Add Internal Note
  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("client_notes").insert([
      {
        client_id: id,
        va_id: userData.user?.id,
        content: newNote,
      },
    ]);

    if (!error) {
      setNewNote("");
      refreshData();
    }
  };

  // 3. Start Timer
  const startTimer = async () => {
    if (!taskName.trim()) {
      alert("Please enter what you are working on!");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();

    // Auto-detect billing type based on client work_type
    const billingType = client?.work_type === "Ongoing" ? "Retainer" : "Billed";

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          client_id: id,
          va_id: userData.user?.id,
          task_name: taskName,
          start_time: new Date().toISOString(),
          is_running: true,
          billing_type: billingType,
        },
      ])
      .select()
      .single();

    if (!error) {
      setActiveTask(data);
      setTaskName("");
      refreshData();
    }
  };

  // 4. Stop Timer
  const stopTimer = async () => {
    if (!activeTask) return;
    const end = new Date();
    const start = new Date(activeTask.start_time);
    // Calculate total minutes (minimum 1 minute)
    const diffMins = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60000)
    );

    const { error } = await supabase
      .from("tasks")
      .update({
        end_time: end.toISOString(),
        is_running: false,
        total_minutes: diffMins,
        is_completed: true,
      })
      .eq("id", activeTask.id);

    if (!error) {
      setActiveTask(null);
      setElapsedTime("00:00:00"); // <--- We reset it here safely now
      refreshData();
    }
  };

  // 5. Generate Invite Link
  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/client/setup?email=${encodeURIComponent(
      client?.email || ""
    )}&id=${id}`;
    setInviteLink(link);
  };

  // --- RENDER ---
  if (loading) return <div className="p-10 text-black">Loading Profile...</div>;
  if (!client)
    return (
      <div className="p-10 text-black text-center mt-20">Client not found.</div>
    );

  return (
    <div className="flex flex-col h-full text-black space-y-6 pb-20">
      {/* 1. HEADER SECTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center">
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

        {/* Invite Link Display Area */}
        {inviteLink && (
          <div className="mt-4 p-4 bg-purple-50 border border-[#9d4edd] rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-top-2">
            <div className="text-sm">
              <p className="font-bold text-purple-900">
                Portal Invite Link Created:
              </p>
              <p className="text-gray-600 break-all">{inviteLink}</p>
            </div>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. CLIENT INFO SECTION */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">
            Client Information
          </h2>
          {isEditing ? (
            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border p-2 rounded text-black w-full"
                  value={client.first_name}
                  onChange={(e) =>
                    setClient({ ...client, first_name: e.target.value })
                  }
                />
                <input
                  className="border p-2 rounded text-black w-full"
                  value={client.surname}
                  onChange={(e) =>
                    setClient({ ...client, surname: e.target.value })
                  }
                />
              </div>
              <input
                className="w-full border p-2 rounded text-black"
                placeholder="Email"
                value={client.email}
                onChange={(e) =>
                  setClient({ ...client, email: e.target.value })
                }
              />
              <input
                className="w-full border p-2 rounded text-black"
                placeholder="Phone"
                value={client.phone}
                onChange={(e) =>
                  setClient({ ...client, phone: e.target.value })
                }
              />

              <select
                className="w-full border p-2 rounded text-black bg-white"
                value={client.status}
                onChange={(e) =>
                  setClient({ ...client, status: e.target.value })
                }
              >
                <option value="Enquiry">Enquiry</option>
                <option value="Provisional">Provisional</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>

              <button
                type="submit"
                className="w-full bg-[#9d4edd] text-white py-2 rounded font-bold hover:bg-[#7b2cbf]"
              >
                Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p>
                <strong>Email:</strong> {client.email || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {client.phone || "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {client.status}
              </p>
              <p>
                <strong>Work Type:</strong> {client.work_type}
              </p>
              <p>
                <strong>Price Quoted:</strong> {client.price_quoted || "N/A"}
              </p>
            </div>
          )}
        </section>

        {/* 3. TASK MANAGER & TIMER SECTION */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">
            Live Task Timer
          </h2>

          {!activeTask ? (
            // STATE A: Timer is NOT running
            <div className="space-y-4">
              <input
                placeholder="What are you working on?"
                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#9d4edd] text-black"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
              <button
                onClick={startTimer}
                className="w-full py-4 bg-green-500 text-white rounded-xl font-black text-lg hover:bg-green-600 transition-all shadow-lg shadow-green-100"
              >
                START TIMER
              </button>
            </div>
          ) : (
            // STATE B: Timer IS running
            <div className="text-center space-y-4 p-4 bg-purple-50 rounded-xl border border-purple-100 animate-in zoom-in-95 duration-200">
              <p className="text-sm font-bold text-[#9d4edd] uppercase tracking-widest">
                Active Task
              </p>
              <p className="text-xl font-bold italic text-gray-800">
                &quot;{activeTask.task_name}&quot;
              </p>

              <div className="text-5xl font-mono font-black py-4 text-gray-800 tracking-wider">
                {elapsedTime}
              </div>
              <button
                onClick={stopTimer}
                className="w-full py-4 bg-red-500 text-white rounded-xl font-black text-lg hover:bg-red-600 transition-all shadow-lg shadow-red-100"
              >
                STOP & SAVE
              </button>
            </div>
          )}

          {/* Recent Tasks Log */}
          <div className="mt-8 border-t pt-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-tighter">
              Recent Logs
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No tasks logged yet.
                </p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium truncate text-gray-800">
                        {task.task_name}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(task.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                    {task.is_running ? (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="font-bold text-[#9d4edd] shrink-0 bg-purple-50 px-2 py-1 rounded">
                        {task.total_minutes}m
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 4. INTERNAL NOTES SECTION */}
      <section className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-[#9d4edd] flex flex-col h-96">
        <h2 className="text-lg font-bold mb-4">Internal Confidential Notes</h2>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {notes.length === 0 ? (
            <p className="text-gray-400 italic text-sm">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-gray-50 p-3 rounded-lg border border-gray-100"
              >
                <p className="text-sm text-gray-800">{note.content}</p>
                <span className="text-[10px] text-gray-400 mt-2 block">
                  {new Date(note.created_at).toLocaleString("en-GB")}
                </span>
              </div>
            ))
          )}
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
