"use client";

import { useState, useEffect, useRef } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  differenceInMinutes,
  startOfDay,
} from "date-fns";

// Re-using the Task type (simplified for display)
type Task = {
  id: string;
  task_name: string;
  status: string;
  category: string;
  due_date: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  client_id: string | null;
  clients?: { surname: string; business_name: string };
};

type CalendarViewProps = {
  tasks: Task[];
  onAddTask: (date: string, time?: string) => void;
};

export default function CalendarView({ tasks, onAddTask }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("week");
  // Initialize with 0 to avoid hydration mismatches
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 08:00 on initial load
  useEffect(() => {
    if (scrollRef.current) {
      // 8 AM * 60px height per hour = 480px
      scrollRef.current.scrollTop = 480;
    }
    // Update "Red Line" every minute
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // --- NAVIGATION ---
  const next = () =>
    viewMode === "month"
      ? setCurrentDate(addMonths(currentDate, 1))
      : setCurrentDate(addWeeks(currentDate, 1));
  const prev = () =>
    viewMode === "month"
      ? setCurrentDate(subMonths(currentDate, 1))
      : setCurrentDate(subWeeks(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  // --- RENDERING HELPERS ---
  const headerFormat =
    viewMode === "month" ? "MMMM yyyy" : "'Week of' d MMM yyyy";
  const daysInView = eachDayOfInterval({
    start: startOfWeek(
      viewMode === "month" ? startOfMonth(currentDate) : currentDate,
      { weekStartsOn: 1 }
    ),
    end: endOfWeek(
      viewMode === "month" ? endOfMonth(currentDate) : currentDate,
      { weekStartsOn: 1 }
    ),
  });

  return (
    <div className="bg-white rounded-4xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-200">
      {/* 1. CALENDAR HEADER */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black uppercase tracking-tight w-48">
            {format(currentDate, headerFormat)}
          </h2>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={prev}
              className="px-3 py-1 hover:bg-white rounded-md transition-all"
            >
              ←
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 text-xs font-bold uppercase hover:bg-white rounded-md transition-all"
            >
              Today
            </button>
            <button
              onClick={next}
              className="px-3 py-1 hover:bg-white rounded-md transition-all"
            >
              →
            </button>
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("month")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest ${
              viewMode === "month"
                ? "bg-white shadow-sm text-[#9d4edd]"
                : "text-gray-400"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest ${
              viewMode === "week"
                ? "bg-white shadow-sm text-[#9d4edd]"
                : "text-gray-400"
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* 2. MONTH VIEW */}
      {viewMode === "month" && (
        <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] bg-gray-50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="p-3 text-center text-[10px] font-black uppercase text-gray-400 border-b border-r border-gray-100 last:border-r-0"
            >
              {d}
            </div>
          ))}
          <div className="col-span-7 grid grid-cols-7 auto-rows-fr bg-white">
            {daysInView.map((day) => {
              const dayTasks = tasks.filter(
                (t) => t.due_date && isSameDay(new Date(t.due_date), day)
              );
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={day.toString()}
                  className={`border-b border-r border-gray-100 p-2 min-h-32 relative group transition-colors ${
                    !isCurrentMonth ? "bg-gray-50/50" : "hover:bg-purple-50/10"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      isSameDay(day, new Date())
                        ? "bg-[#9d4edd] text-white w-7 h-7 flex items-center justify-center rounded-full"
                        : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Hover Add Button */}
                  <button
                    onClick={() => onAddTask(format(day, "yyyy-MM-dd"))}
                    className="absolute top-2 right-2 text-[#9d4edd] opacity-0 group-hover:opacity-100 transition-opacity font-bold text-lg hover:scale-110"
                  >
                    +
                  </button>

                  <div className="mt-2 space-y-1">
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`text-[9px] px-2 py-1 rounded truncate font-medium ${
                          task.category === "personal"
                            ? "bg-green-100 text-green-700"
                            : "bg-purple-100 text-[#9d4edd]"
                        }`}
                      >
                        {task.task_name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. WEEK VIEW (24h Scroll) */}
      {viewMode === "week" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Week Header */}
          <div className="grid grid-cols-[60px_1fr] border-b border-gray-200 bg-white">
            <div className="p-4 border-r border-gray-100"></div>
            <div className="grid grid-cols-7">
              {daysInView.slice(0, 7).map((day) => (
                <div
                  key={day.toString()}
                  className={`text-center p-3 border-r border-gray-100 ${
                    isToday(day) ? "text-[#9d4edd]" : ""
                  }`}
                >
                  <div className="text-xs font-bold uppercase">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={`text-lg font-black ${
                      isToday(day)
                        ? "bg-[#9d4edd] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1"
                        : ""
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable Timeline */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto relative custom-scrollbar"
          >
            <div className="grid grid-cols-[60px_1fr] min-h-360">
              {" "}
              {/* 60px * 24 hours */}
              {/* Time Column */}
              <div className="border-r border-gray-100 bg-gray-50/30">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-15 text-[10px] text-gray-400 font-bold text-right pr-2 pt-1 -mt-2.5"
                  >
                    {i === 0
                      ? "12 AM"
                      : i < 12
                      ? `${i} AM`
                      : i === 12
                      ? "12 PM"
                      : `${i - 12} PM`}
                  </div>
                ))}
              </div>
              {/* Grid Columns */}
              <div className="grid grid-cols-7 relative">
                {/* Horizontal Hour Lines */}
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-b border-gray-50"
                    style={{ top: `${i * 60}px` }}
                  />
                ))}

                {/* THE RED LINE (Current Time) */}
                {daysInView.some((d) => isToday(d)) && (
                  <div
                    className="absolute w-full border-t-2 border-red-500 z-50 pointer-events-none flex items-center"
                    style={{
                      top: `${differenceInMinutes(now, startOfDay(now))}px`,
                      left: 0,
                    }}
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                  </div>
                )}

                {/* Day Columns */}
                {daysInView.slice(0, 7).map((day, dIndex) => {
                  const dayTasks = tasks.filter(
                    (t) => t.due_date && isSameDay(new Date(t.due_date), day)
                  );

                  return (
                    <div
                      key={dIndex}
                      className="border-r border-gray-50 relative h-full hover:bg-gray-50/20 transition-colors"
                      onClick={() => {
                        // FIX: Removed unused 'clickY' calculation
                        onAddTask(format(day, "yyyy-MM-dd"));
                      }}
                    >
                      {/* Render Tasks as Blocks */}
                      {dayTasks.map((task, tIndex) => (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            alert(`Opening task: ${task.task_name}`);
                          }}
                          className={`mx-1 p-2 rounded-lg text-[10px] font-bold shadow-sm mb-1 cursor-pointer border-l-4 overflow-hidden ${
                            task.category === "client"
                              ? "bg-purple-50 border-[#9d4edd] text-purple-900"
                              : "bg-blue-50 border-blue-400 text-blue-900"
                          }`}
                          style={{ marginTop: `${tIndex * 2}px` }}
                        >
                          {task.scheduled_start
                            ? format(new Date(task.scheduled_start), "h:mm a")
                            : "All Day"}{" "}
                          - {task.task_name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
