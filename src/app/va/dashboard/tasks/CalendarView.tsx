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
  isSameMonth,
  addMonths,
  startOfMonth,
  endOfMonth,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { STATUS_CONFIG, Task } from "./types";

interface CalendarViewProps {
  tasks: Task[];
  onAddTask: (date: string, time?: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

export default function CalendarView({
  tasks,
  onAddTask,
  onUpdateTask,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const containerHeightClass =
    viewMode === "month"
      ? "min-h-[calc(100vh-220px)]"
      : "h-[calc(100vh-220px)]";

  // Helper: Red Line Position (64px height per hour to save vertical space)
  const HOUR_HEIGHT = 64;

  // Keep current time indicator updated
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewMode === "month") return;
    const container = scrollRef.current;
    if (!container) return;
    const minutes = now.getHours() * 60 + now.getMinutes();
    const targetTop = (minutes / 60) * HOUR_HEIGHT;
    requestAnimationFrame(() => {
      const centered = Math.max(0, targetTop - container.clientHeight / 2);
      container.scrollTop = centered;
    });
  }, [viewMode, now, HOUR_HEIGHT]);

  // --- DATE LOGIC ---
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
  const daysToShow = viewMode === "week" ? 7 : 1;
  const startDate = viewMode === "week" ? weekStart : currentDate;

  const days = Array.from({ length: daysToShow }, (_, i) =>
    addDays(startDate, i),
  );
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = [];
  for (let day = monthGridStart; day <= monthGridEnd; day = addDays(day, 1)) {
    monthDays.push(day);
  }
  const weekDayLabels = Array.from({ length: 7 }, (_, i) =>
    format(addDays(monthGridStart, i), "EEE"),
  );

  const getTimeLineTop = () => {
    const mins = now.getHours() * 60 + now.getMinutes();
    return (mins / 60) * HOUR_HEIGHT;
  };

  const getStatusLineColor = (status: string) => {
    return STATUS_CONFIG[status]?.color || STATUS_CONFIG["todo"].color;
  };

  const getTaskDurationMinutes = (task: Task) => {
    if (task.scheduled_start && task.scheduled_end) {
      const duration =
        (new Date(task.scheduled_end).getTime() -
          new Date(task.scheduled_start).getTime()) /
        60000;
      return Math.max(15, Math.round(duration));
    }
    return 60;
  };

  const isTaskOnDay = (task: Task, day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = addMinutes(dayStart, 24 * 60 - 1);
    if (task.scheduled_start) {
      const taskStart = new Date(task.scheduled_start);
      const taskEnd = task.scheduled_end
        ? new Date(task.scheduled_end)
        : addMinutes(taskStart, 60);
      return (
        taskStart.getTime() <= dayEnd.getTime() &&
        taskEnd.getTime() >= dayStart.getTime()
      );
    }
    if (task.due_date) {
      return isSameDay(new Date(task.due_date), day);
    }
    return false;
  };

  const handleDropToSlot = (day: Date, hour?: number) => {
    if (!draggedTask) return;
    const dateString = format(day, "yyyy-MM-dd");

    if (typeof hour === "number") {
      const existingStart = draggedTask.scheduled_start
        ? new Date(draggedTask.scheduled_start)
        : null;
      const minutes = existingStart ? existingStart.getMinutes() : 0;
      const newStart = addMinutes(setHours(startOfDay(day), hour), minutes);
      const durationMinutes = getTaskDurationMinutes(draggedTask);
      const newEnd = addMinutes(newStart, durationMinutes);

      onUpdateTask(draggedTask.id, {
        due_date: dateString,
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString(),
      });
    } else {
      onUpdateTask(draggedTask.id, {
        due_date: dateString,
        scheduled_start: null,
        scheduled_end: null,
      });
    }

    setDraggedTask(null);
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col font-sans text-[#333333] ${
        viewMode === "month" ? "overflow-visible" : "overflow-hidden"
      } ${containerHeightClass}`}
    >
      {/* 1. CALENDAR HEADER & CONTROLS */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-20">
        {/* Left: View Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === "month"
                  ? "bg-white shadow-sm text-[#333333]"
                  : "text-[#333333]/60 hover:text-[#333333]"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === "week"
                  ? "bg-white shadow-sm text-[#333333]"
                  : "text-[#333333]/60 hover:text-[#333333]"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === "day"
                  ? "bg-white shadow-sm text-[#333333]"
                  : "text-[#333333]/60 hover:text-[#333333]"
              }`}
            >
              Day
            </button>
          </div>
          {viewMode === "month" && (
            <span className="text-sm font-bold text-[#333333]">
              {format(currentDate, "MMMM yyyy")}
            </span>
          )}
        </div>

        {/* Right: Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCurrentDate(
                viewMode === "month"
                  ? addMonths(currentDate, -1)
                  : addDays(currentDate, viewMode === "week" ? -7 : -1),
              )
            }
            className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-[#333333] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-bold hover:bg-gray-50 rounded-lg border border-gray-100 text-[#333333]"
          >
            Today
          </button>
          <button
            onClick={() =>
              setCurrentDate(
                viewMode === "month"
                  ? addMonths(currentDate, 1)
                  : addDays(currentDate, viewMode === "week" ? 7 : 1),
              )
            }
            className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-[#333333] transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {viewMode === "month" && (
        <div className="flex-1 bg-white overflow-y-auto md:overflow-visible custom-scrollbar">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {weekDayLabels.map((label) => (
              <div
                key={label}
                className="py-3 text-center border-r border-gray-50 last:border-0 text-[10px] font-bold tracking-widest text-[#333333]"
              >
                {label}
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-7 gap-px bg-gray-100"
            style={{ gridTemplateRows: "repeat(6, minmax(0, 1fr))" }}
          >
            {monthDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const dayTasks = tasks.filter((task) => isTaskOnDay(task, day));
              return (
                <div
                  key={day.toISOString()}
                  className="min-h-27.5 bg-white p-2 border-r border-b border-gray-50 last:border-r-0"
                  onClick={() => onAddTask(format(day, "yyyy-MM-dd"))}
                >
                  <div
                    className={`text-xs font-bold ${
                      isCurrentMonth ? "text-[#333333]" : "text-[#333333]/40"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center bg-white border border-gray-100 rounded px-2 py-1 shadow-sm text-[10px] font-bold text-[#333333] hover:border-purple-100 transition-all"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${getStatusLineColor(
                            task.status,
                          )}`}
                        />
                        <span className="truncate">{task.task_name}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] font-bold text-[#333333]/60">
                        +{dayTasks.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode !== "month" && (
        <>
          {/* 2. THE GRID HEADER (Sticky) */}
          <div className="flex flex-col border-b border-gray-100 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] z-10 relative">
            <div
              className="grid"
              style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}
            >
              {/* Top Left: Month Label (Integrated) */}
              <div className="p-3 border-r border-gray-50 flex items-end justify-center pb-2">
                <span className="text-xs font-black text-[#333333] leading-tight tracking-tight text-center">
                  {format(startDate, "MMM")}
                  <br />
                  <span className="text-[#333333]">
                    {format(startDate, "yyyy")}
                  </span>
                </span>
              </div>

              {/* Days Header */}
              {days.map((day) => (
                <div
                  key={day.toString()}
                  className={`py-3 text-center border-r border-gray-50 last:border-0 ${
                    !isSameMonth(day, currentDate) ? "bg-gray-50/30" : ""
                  }`}
                >
                  <p className="text-[10px] font-bold tracking-widest text-[#333333] mb-0.5">
                    {format(day, "EEE")}
                  </p>
                  <div
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      isSameDay(day, new Date())
                        ? "bg-[#9d4edd] text-white shadow-md shadow-purple-100"
                        : "text-[#333333]"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>

            {/* All Day Section */}
            <div
              className="grid border-t border-gray-50"
              style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}
            >
              <div className="py-2 px-1 border-r border-gray-50 flex items-center justify-center">
                <span
                  className="text-[9px] font-bold text-[#333333] rotate-180"
                  style={{ writingMode: "vertical-rl" }}
                >
                  All Day
                </span>
              </div>

              {days.map((day) => (
                <div
                  key={`allday-${day}`}
                  className="p-1 border-r border-gray-50 min-h-10 flex flex-col gap-1 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => onAddTask(format(day, "yyyy-MM-dd"))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDropToSlot(day);
                  }}
                >
                  {tasks
                    .filter(
                      (t) =>
                        isSameDay(new Date(t.due_date || ""), day) &&
                        !t.scheduled_start,
                    )
                    .map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", task.id);
                          setDraggedTask(task);
                        }}
                        onDragEnd={() => setDraggedTask(null)}
                        className="flex items-center bg-white border border-gray-100 rounded px-2 py-1 shadow-sm text-[10px] font-bold text-[#333333] hover:border-purple-100 transition-all"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${getStatusLineColor(
                            task.status,
                          )}`}
                        />
                        <span className="truncate">{task.task_name}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* 3. SCROLLABLE TIME GRID */}
          <div
            className="flex-1 overflow-y-auto relative bg-white custom-scrollbar"
            ref={scrollRef}
          >
            <div
              className="grid min-h-full"
              style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}
            >
              {/* Time Labels Column */}
              <div className="border-r border-gray-50 bg-[#fcfcfc]">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="text-right pr-2 relative"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  >
                    <span className="text-[10px] font-bold text-gray-300 relative -top-2">
                      {format(setHours(startOfDay(new Date()), hour), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              {days.map((day) => (
                <div
                  key={`col-${day}`}
                  className="relative border-r border-gray-50 last:border-0 group"
                >
                  {/* Hour Cells */}
                  {hours.map((hour) => (
                    <div
                      key={`cell-${day}-${hour}`}
                      className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors cursor-pointer"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() =>
                        onAddTask(
                          format(day, "yyyy-MM-dd"),
                          `${hour.toString().padStart(2, "0")}:00`,
                        )
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDropToSlot(day, hour);
                      }}
                    />
                  ))}

                  {/* Red Current Time Line */}
                  {isSameDay(day, now) && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                      style={{ top: `${getTimeLineTop()}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-400 -ml-1 shadow-sm" />
                      <div className="flex-1 h-px bg-red-300/80" />
                    </div>
                  )}

                  {/* Timed Task Cards */}
                  {tasks
                    .filter((t) => t.scheduled_start)
                    .map((task) => {
                      const taskStart = new Date(task.scheduled_start!);
                      const taskEnd = task.scheduled_end
                        ? new Date(task.scheduled_end)
                        : addMinutes(taskStart, 60);
                      const dayStart = startOfDay(day);
                      const dayEnd = addMinutes(dayStart, 24 * 60 - 1);

                      if (
                        taskEnd.getTime() <= dayStart.getTime() ||
                        taskStart.getTime() >= dayEnd.getTime()
                      ) {
                        return null;
                      }

                      const renderStart = new Date(
                        Math.max(taskStart.getTime(), dayStart.getTime()),
                      );
                      const renderEnd = new Date(
                        Math.min(taskEnd.getTime(), dayEnd.getTime()),
                      );
                      const top =
                        ((renderStart.getHours() * 60 +
                          renderStart.getMinutes()) /
                          60) *
                        HOUR_HEIGHT;
                      const durationMin =
                        (renderEnd.getTime() - renderStart.getTime()) / 60000;
                      const height = (durationMin / 60) * HOUR_HEIGHT;

                      return (
                        <div
                          key={`${task.id}-${day.toISOString()}`}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", task.id);
                            setDraggedTask(task);
                          }}
                          onDragEnd={() => setDraggedTask(null)}
                          className="absolute left-1 right-1 px-2 py-1 bg-white rounded-lg border border-gray-100 shadow-sm z-10 cursor-pointer hover:shadow-md hover:border-[#9d4edd]/30 transition-all flex items-start gap-2 overflow-hidden"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 40)}px`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation(); /* Future: Open Edit */
                          }}
                        >
                          {/* Status Line */}
                          <div
                            className={`w-1 shrink-0 rounded-full h-full opacity-80 ${getStatusLineColor(
                              task.status,
                            )}`}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-[#333333] truncate leading-tight">
                              {task.task_name}
                            </p>
                            {height > 45 && (
                              <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                                <Clock size={8} />
                                {format(renderStart, "HH:mm")} -{" "}
                                {format(renderEnd, "HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
