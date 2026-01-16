"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRightCircle,
  PlayCircle,
} from "lucide-react";
import { Task } from "./types";

interface KanbanViewProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: string) => void;
  onToggleTimer: (task: Task) => Promise<void>;
  onAddTask: (status: string) => void;
}

// Define the columns and their display titles
const COLUMNS = [
  { id: "todo", title: "To Do", icon: Circle },
  { id: "up_next", title: "Up Next", icon: ArrowRightCircle },
  { id: "in_progress", title: "In Progress", icon: PlayCircle },
  { id: "completed", title: "Completed", icon: CheckCircle2 },
];

export default function KanbanView({
  tasks,
  onUpdateStatus,
  onToggleTimer,
  onAddTask,
}: KanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Handle Drop Logic
  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      onUpdateStatus(draggedTaskId, status);
      setDraggedTaskId(null);
    }
  };

  return (
    <div className="h-full overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-250 h-full">
        {COLUMNS.map((col) => {
          const ColIcon = col.icon;
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex-1 min-w-70 flex flex-col bg-gray-50/50 rounded-2xl border border-gray-100 h-full"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* COLUMN HEADER */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-gray-50/50 backdrop-blur-sm rounded-t-2xl z-10">
                <div className="flex items-center gap-2">
                  <ColIcon
                    size={16}
                    className={
                      col.id === "completed"
                        ? "text-green-500"
                        : col.id === "in_progress"
                        ? "text-[#9d4edd]"
                        : "text-gray-400"
                    }
                  />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">
                    {col.title}
                  </h3>
                  <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-400 border border-gray-100">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => onAddTask(col.id)}
                  className="text-gray-400 hover:text-[#9d4edd] transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* TASKS LIST */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedTaskId(task.id)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                  >
                    {/* Task Header & Options */}
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider border ${
                          task.client_id
                            ? "bg-purple-50 text-[#9d4edd] border-purple-100"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}
                      >
                        {/* FIX 1: Removed 'category' check */}
                        {task.client_id ? "Client" : "Personal"}
                      </span>
                      <button className="text-gray-300 hover:text-[#333333]">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>

                    {/* Task Content */}
                    <h4
                      className={`font-bold text-sm text-[#333333] mb-1 leading-snug ${
                        task.status === "completed"
                          ? "line-through text-gray-400"
                          : ""
                      }`}
                    >
                      {task.task_name}
                    </h4>

                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 truncate">
                      {/* FIX 2: Removed 'category', defaulted to 'Personal' */}
                      {task.client_id
                        ? task.clients?.business_name || task.clients?.surname
                        : "Personal"}
                    </p>

                    {/* Footer: Date & Timer */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
                      <div className="text-[10px] font-bold text-gray-400">
                        {task.due_date
                          ? format(new Date(task.due_date), "dd MMM")
                          : "No Date"}
                      </div>

                      <button
                        onClick={() => onToggleTimer(task)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          task.is_running
                            ? "bg-red-50 text-red-500 border border-red-100 animate-pulse"
                            : "bg-gray-50 text-gray-400 hover:text-[#9d4edd] hover:bg-purple-50"
                        }`}
                      >
                        <Clock size={12} />
                        {Math.floor(task.total_minutes / 60)}h{" "}
                        {task.total_minutes % 60}m
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
