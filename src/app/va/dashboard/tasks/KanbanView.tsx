"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Plus, Clock } from "lucide-react";
import { Task } from "./types";

interface KanbanViewProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: string) => void;
  onReorderTask?: (
    taskId: string,
    newStatus: string,
    beforeTaskId?: string | null,
  ) => void;
  onToggleTimer: (task: Task) => Promise<void>;
  onAddTask: (status: string) => void;
  filterStatus: string[]; // Added to handle dynamic column hiding
  onOpenTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  variant?: "default" | "framed";
}

const COLUMNS = [
  { id: "todo", title: "To Do", color: "border-[#b5b3b3]" },
  {
    id: "up_next",
    title: "Up Next",
    color: "border-[#b5b3b3]",
  },
  {
    id: "in_progress",
    title: "In Progress",
    color: "border-[#b5b3b3]",
  },
  {
    id: "completed",
    title: "Completed",
    color: "border-[#b5b3b3]",
  },
];

export default function KanbanView({
  tasks,
  onUpdateStatus,
  onReorderTask,
  onToggleTimer,
  onAddTask,
  filterStatus,
  onOpenTask,
  onDeleteTask,
  variant = "default",
}: KanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedStatus, setDraggedStatus] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const isFramed = variant === "framed";

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      if (onReorderTask) {
        onReorderTask(draggedTaskId, status, null);
      } else {
        onUpdateStatus(draggedTaskId, status);
      }
      setDraggedTaskId(null);
      setDraggedStatus(null);
      setDragOverTaskId(null);
    }
  };

  const handleCardClick = (task: Task) => {
    if (isDraggingRef.current) return;
    onOpenTask(task);
  };

  const visibleColumns = COLUMNS.filter((col) => filterStatus.includes(col.id));

  return (
    <div className="h-[calc(100vh-180px)] overflow-x-auto pb-2 custom-scrollbar">
      <div
        className={
          isFramed
            ? "bg-white rounded-3xl p-6 shadow-[0_1px_10px_rgba(15,23,42,0.06)]"
            : ""
        }
      >
        <div className={`flex gap-6 h-full min-w-max ${isFramed ? "" : "px-2"}`}>
        {visibleColumns.map((col) => {
          const colTasks = tasks
            .filter((t) => t.status === col.id)
            .slice()
            .sort((a, b) => {
              const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
              const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
              if (orderA !== orderB) return orderA - orderB;
              const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return timeA - timeB;
            });

          return (
            <div
              key={col.id}
              className={`flex-1 w-80 flex flex-col rounded-2xl h-full transition-all duration-300 ${
                isFramed
                  ? "bg-gray-100/70"
                  : `bg-gray-50/50 border-2 ${col.color}`
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="p-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#333333] tracking-tight">
                    {col.title}
                  </h3>
                  <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-[#333333] border border-gray-100">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => onAddTask(col.id)}
                  className="text-[#333333] hover:text-[#9d4edd] transition-colors p-1"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => {
                      isDraggingRef.current = true;
                      setDraggedTaskId(task.id);
                      setDraggedStatus(col.id);
                    }}
                    onDragEnd={() => {
                      setTimeout(() => {
                        isDraggingRef.current = false;
                      }, 0);
                      setDraggedTaskId(null);
                      setDraggedStatus(null);
                      setDragOverTaskId(null);
                    }}
                    onDragOver={(event) => {
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      event.preventDefault();
                      setDragOverTaskId(task.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverTaskId === task.id) {
                        setDragOverTaskId(null);
                      }
                    }}
                    onDrop={(event) => {
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (onReorderTask) {
                        onReorderTask(draggedTaskId, col.id, task.id);
                      } else if (draggedStatus !== col.id) {
                        onUpdateStatus(draggedTaskId, col.id);
                      }
                      setDraggedTaskId(null);
                      setDraggedStatus(null);
                      setDragOverTaskId(null);
                    }}
                    onClick={() => handleCardClick(task)}
                    className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-purple-100 transition-all group ${
                      task.client_deleted_at
                        ? "bg-red-50/60 border-red-100"
                        : ""
                    } ${
                      dragOverTaskId === task.id
                        ? "ring-1 ring-purple-100 bg-purple-50/60"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black tracking-widest text-[#333333] opacity-70">
                          {task.category ||
                            (task.client_id ? "Client" : "Personal")}
                        </span>
                        {task.shared_with_client && (
                          <span className="text-[9px] font-black tracking-widest text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
                            Shared
                          </span>
                        )}
                        {task.client_deleted_at && (
                          <span className="text-[9px] font-black tracking-widest text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
                            Client deleted
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionMenuId(
                              actionMenuId === task.id ? null : task.id
                            );
                          }}
                          className="text-[#333333]"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenuId === task.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenTask(task);
                                setActionMenuId(null);
                              }}
                              className="w-full text-left px-4 py-3 text-xs font-bold text-[#333333] hover:bg-gray-50 flex items-center gap-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteTask(task.id);
                                setActionMenuId(null);
                              }}
                              className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <h4
                      className={`font-bold text-sm text-[#333333] mb-1 leading-snug ${
                        task.status === "completed"
                          ? "line-through opacity-40"
                          : ""
                      }`}
                    >
                      {task.task_name}
                    </h4>

                    {task.clients && (
                      <p className="text-[10px] font-bold text-[#333333] tracking-tight mb-4">
                        {task.clients.surname}
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#333333]">
                        <Clock size={12} className="text-gray-300" />
                        {task.due_date
                          ? format(new Date(task.due_date), "d MMM")
                          : "No date"}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTimer(task);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          task.is_running
                            ? "bg-red-50 text-red-500 border border-red-100 animate-pulse"
                            : "bg-green-50 text-green-600 border border-green-100 hover:bg-green-100"
                        }`}
                      >
                        {Math.floor(task.total_minutes / 60)}h{" "}
                        {task.total_minutes % 60}m
                      </button>
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-gray-100 rounded-xl" />
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
