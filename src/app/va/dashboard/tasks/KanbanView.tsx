"use client";

import { useState } from "react";
import { format } from "date-fns";

// Re-using the Task type
type Task = {
  id: string;
  task_name: string;
  status: string;
  category: string;
  due_date: string | null;
  total_minutes: number;
  is_running: boolean;
  start_time: string | null;
  client_id: string | null;
  clients?: { surname: string; business_name: string };
};

type KanbanViewProps = {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: string) => void;
  onToggleTimer: (task: Task) => void;
  onAddTask: (status: string) => void;
};

const COLUMNS = [
  { id: "todo", label: "To Do", color: "bg-gray-100 text-gray-500" },
  { id: "up_next", label: "Up Next", color: "bg-blue-50 text-blue-600" },
  {
    id: "in_progress",
    label: "In Progress",
    color: "bg-purple-50 text-[#9d4edd]",
  },
  { id: "completed", label: "Completed", color: "bg-green-50 text-green-600" },
];

export default function KanbanView({
  tasks,
  onUpdateStatus,
  onToggleTimer,
  onAddTask,
}: KanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // --- DRAG HANDLERS ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    // Make the ghost element slightly transparent
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      onUpdateStatus(draggedTaskId, status);
      setDraggedTaskId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-240px)] gap-6 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        // Filter tasks for this column
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            className="flex-1 min-w-75 flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* COLUMN HEADER */}
            <div
              className={`p-4 border-b border-gray-50 flex justify-between items-center ${col.color}`}
            >
              <span className="font-black uppercase tracking-widest text-xs">
                {col.label}
              </span>
              <span className="bg-white/50 px-2 py-1 rounded text-[10px] font-bold">
                {colTasks.length}
              </span>
            </div>

            {/* DROP ZONE / TASK LIST */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-gray-50/30">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white p-4 rounded-2xl shadow-sm border-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative ${
                    task.category === "client"
                      ? "border-l-4 border-l-[#9d4edd] border-gray-100"
                      : "border-l-4 border-l-blue-400 border-gray-100"
                  }`}
                >
                  {/* Category / Client Label */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      {task.client_id ? task.clients?.surname : task.category}
                    </span>
                    {task.is_running && (
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                  </div>

                  {/* Task Name */}
                  <p className="text-sm font-bold text-gray-800 mb-3 leading-tight">
                    {task.task_name}
                  </p>

                  {/* Footer Actions */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                    <span className="text-[10px] font-mono font-bold text-gray-400">
                      {task.due_date
                        ? format(new Date(task.due_date), "dd MMM")
                        : ""}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTimer(task);
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        task.is_running
                          ? "bg-red-50 text-red-500 hover:bg-red-100"
                          : "bg-gray-50 text-gray-300 hover:bg-[#9d4edd] hover:text-white"
                      }`}
                    >
                      {task.is_running ? "wm" : "▶"}
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Button per Column */}
              <button
                onClick={() => onAddTask(col.id)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-xs font-bold hover:border-[#9d4edd] hover:text-[#9d4edd] transition-all"
              >
                + Add Card
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
