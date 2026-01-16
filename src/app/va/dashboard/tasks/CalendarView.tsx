"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  setHours,
  startOfDay,
  addMinutes,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  Building2,
  User,
} from "lucide-react";
import { Task } from "./types";
import { supabase } from "@/lib/supabase";

interface CalendarViewProps {
  tasks: Task[];
  onAddTask: (date: string) => void;
}

// Helper to generate time options for dropdowns
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

export default function CalendarView({ tasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());

  // --- MODAL STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [clients, setClients] = useState<
    { id: string; business_name: string; surname: string }[]
  >([]);

  // Modal Form State
  const [formTaskName, setFormTaskName] = useState("");
  const [formCategory, setFormCategory] = useState<
    "client" | "business" | "personal"
  >("client");
  const [formClientId, setFormClientId] = useState("");
  const [formStatus, setFormStatus] = useState("todo");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formDetails, setFormDetails] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Clients for Dropdown
  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, business_name, surname");
      if (data) setClients(data);
    }
    fetchClients();
  }, []);

  // 2. Ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 3. Open Modal Logic
  const openModal = (
    dateStr: string,
    timeStr?: string,
    existingTask?: Task
  ) => {
    if (existingTask) {
      setEditingTask(existingTask);
      setFormTaskName(existingTask.task_name);
      setFormCategory(existingTask.client_id ? "client" : "personal"); // Simplified logic
      setFormClientId(existingTask.client_id || "");
      setFormStatus(existingTask.status);
      setFormDate(
        existingTask.due_date
          ? format(new Date(existingTask.due_date), "yyyy-MM-dd")
          : dateStr
      );
      setFormDetails(existingTask.details || "");

      if (existingTask.scheduled_start) {
        setFormStartTime(
          format(new Date(existingTask.scheduled_start), "HH:mm")
        );
      }
      if (existingTask.scheduled_end) {
        setFormEndTime(format(new Date(existingTask.scheduled_end), "HH:mm"));
      }
    } else {
      setEditingTask(null);
      setFormTaskName("");
      setFormCategory("client");
      setFormClientId("");
      setFormStatus("todo");
      setFormDate(dateStr);
      setFormStartTime(timeStr || "09:00");
      setFormEndTime(
        timeStr ? timeStr.replace(/:00/, ":30").replace(/:30/, ":00") : "10:00"
      ); // Crude +30m logic
      setFormDetails("");
    }
    setIsModalOpen(true);
  };

  // 4. Save Logic
  const handleSave = async () => {
    if (!formTaskName.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Construct Timestamps
    const startDateTime = `${formDate}T${formStartTime}:00`;
    const endDateTime = `${formDate}T${formEndTime}:00`;

    const payload = {
      va_id: user?.id,
      task_name: formTaskName,
      status: formStatus,
      client_id: formCategory === "client" ? formClientId : null,
      due_date: formDate,
      scheduled_start: startDateTime,
      scheduled_end: endDateTime,
      details: formDetails,
      // Default fields
      total_minutes: editingTask?.total_minutes || 0,
      is_running: editingTask?.is_running || false,
    };

    if (editingTask?.id) {
      await supabase.from("tasks").update(payload).eq("id", editingTask.id);
    } else {
      await supabase.from("tasks").insert([payload]);
    }

    setIsModalOpen(false);
    // Note: The parent 'tasks' prop needs to refresh.
    // In a real app, you'd trigger a callback here like onRefresh().
    // For now, Supabase realtime in parent handles it.
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Helper for red line
  const getTimeLineTop = () => {
    const mins = now.getHours() * 60 + now.getMinutes();
    return (mins / 60) * 80;
  };

  return (
    <div className="bg-white border-t border-gray-200 h-[calc(100vh-280px)] flex flex-col font-sans text-[#333333]">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-[#fcfcfc]">
        <h1 className="text-xl font-semibold tracking-tight text-[#333333]">
          {format(currentDate, "MMMM yyyy")}
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all border border-gray-100"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* --- STICKY DAYS --- */}
      <div className="grid grid-cols-[100px_1fr] border-b border-gray-200 sticky top-0 z-30 bg-white shadow-sm">
        <div className="border-r border-gray-100 bg-gray-50/50" />
        <div className="grid grid-cols-7 divide-x divide-gray-100">
          {days.map((day) => (
            <div key={day.toString()} className="py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#333333] mb-1">
                {format(day, "EEEE")}
              </p>
              <p
                className={`text-sm font-bold ${
                  isSameDay(day, new Date())
                    ? "text-[#9d4edd]"
                    : "text-gray-400"
                }`}
              >
                {format(day, "d MMM")}
              </p>

              {/* ALL DAY AREA */}
              <div className="mt-3 px-1 space-y-1 min-h-6">
                {tasks
                  .filter(
                    (t) =>
                      isSameDay(new Date(t.due_date || ""), day) &&
                      !t.scheduled_start
                  )
                  .map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(format(day, "yyyy-MM-dd"), undefined, task);
                      }}
                      className="text-[10px] bg-purple-50 text-[#9d4edd] font-bold py-1 px-2 rounded-lg border border-purple-100 truncate cursor-pointer hover:bg-purple-100"
                    >
                      {task.task_name}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- SCROLLABLE GRID --- */}
      <div className="flex-1 overflow-y-auto relative bg-white" ref={scrollRef}>
        <div className="grid grid-cols-[100px_1fr] min-h-full">
          {/* Time Labels */}
          <div className="border-r border-gray-100 bg-gray-50/30">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-20 pr-4 text-right border-b border-transparent"
              >
                <span className="text-[11px] font-bold text-gray-400 relative -top-2">
                  {format(setHours(startOfDay(new Date()), hour), "HH:mm")}
                </span>
              </div>
            ))}
          </div>

          {/* Columns */}
          <div className="grid grid-cols-7 divide-x divide-gray-200 relative">
            {days.map((day) => (
              <div key={day.toString()} className="relative h-full group">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-20 border-b border-gray-100 hover:bg-gray-50/30 transition-colors cursor-pointer"
                    onClick={() =>
                      openModal(
                        format(day, "yyyy-MM-dd"),
                        `${hour.toString().padStart(2, "0")}:00`
                      )
                    }
                  />
                ))}

                {/* Red Line (Only Today) */}
                {isSameDay(day, now) && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: `${getTimeLineTop()}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/80 -ml-1.5 shadow-sm" />
                    <div className="flex-1 h-px bg-red-300/60" />
                  </div>
                )}

                {/* Timed Tasks */}
                {tasks
                  .filter(
                    (t) =>
                      isSameDay(new Date(t.due_date || ""), day) &&
                      t.scheduled_start
                  )
                  .map((task) => {
                    const start = new Date(task.scheduled_start!);
                    const end = task.scheduled_end
                      ? new Date(task.scheduled_end)
                      : addMinutes(start, 30);

                    const top =
                      ((start.getHours() * 60 + start.getMinutes()) / 60) * 80;
                    const durationMin =
                      (end.getTime() - start.getTime()) / 60000;
                    const height = (durationMin / 60) * 80;

                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(format(day, "yyyy-MM-dd"), undefined, task);
                        }}
                        className="absolute left-1 right-1 p-3 bg-white border-l-4 border-[#9d4edd] shadow-md rounded-r-xl z-10 cursor-pointer hover:shadow-lg transition-all"
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 35)}px`,
                        }}
                      >
                        <p className="text-[11px] font-bold text-[#333333] truncate leading-none mb-1">
                          {task.task_name}
                        </p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-1">
                          <Clock size={8} />
                          {format(start, "HH:mm")} - {format(end, "HH:mm")}
                        </p>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- TASK MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-4xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-[#333333]">
                {editingTask ? "Edit Task" : "New Task"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-black transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Task Name */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  Task Name
                </label>
                <input
                  autoFocus
                  className="w-full bg-gray-50 border-none rounded-xl p-4 font-bold text-[#333333] outline-none focus:ring-2 focus:ring-purple-100"
                  value={formTaskName}
                  onChange={(e) => setFormTaskName(e.target.value)}
                  placeholder="Enter task name..."
                />
              </div>

              {/* Category & Client Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Category
                  </label>
                  <div className="flex bg-gray-50 rounded-xl p-1">
                    {(["client", "business", "personal"] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          onClick={() => setFormCategory(cat)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            formCategory === cat
                              ? "bg-white text-[#9d4edd] shadow-sm"
                              : "text-gray-400"
                          }`}
                        >
                          {cat === "client" ? (
                            <User size={12} className="mx-auto" />
                          ) : cat === "business" ? (
                            <Building2 size={12} className="mx-auto" />
                          ) : (
                            "ME"
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Client
                  </label>
                  <select
                    className="w-full bg-gray-50 border-none rounded-xl p-2.5 text-xs font-bold text-[#333333] outline-none focus:ring-2 focus:ring-purple-100"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    disabled={formCategory !== "client"}
                  >
                    <option value="">N/A</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.surname} ({c.business_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time & Status Row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Start
                  </label>
                  <select
                    className="w-full bg-gray-50 rounded-xl text-xs font-bold p-2.5 outline-none"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    End
                  </label>
                  <select
                    className="w-full bg-gray-50 rounded-xl text-xs font-bold p-2.5 outline-none"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Status
                  </label>
                  <select
                    className="w-full bg-gray-50 rounded-xl text-xs font-bold p-2.5 outline-none capitalize"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
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
              </div>

              {/* Details */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  Details
                </label>
                <textarea
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium text-[#333333] outline-none focus:ring-2 focus:ring-purple-100 min-h-25"
                  placeholder="Add details..."
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-50 flex gap-4 bg-gray-50/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-xl border-2 border-[#333333] text-[#333333] font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-[#9d4edd] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#7b2cbf] shadow-lg shadow-purple-100 transition-all"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
