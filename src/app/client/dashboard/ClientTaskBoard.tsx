"use client";

import { Plus } from "lucide-react";
import type { ClientTask } from "./ClientTaskModal";

type ClientTaskBoardProps = {
  tasks: ClientTask[];
  onOpenTask: (task: ClientTask) => void;
  onAddTask: (status: string) => void;
};

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "up_next", title: "Up Next" },
  { id: "in_progress", title: "In Progress" },
  { id: "completed", title: "Completed" },
];

export default function ClientTaskBoard({
  tasks,
  onOpenTask,
  onAddTask,
}: ClientTaskBoardProps) {
  return (
    <div className="h-[520px] overflow-x-auto pb-2 custom-scrollbar">
      <div className="flex gap-6 h-full min-w-max px-2">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex-1 w-72 flex flex-col bg-gray-50/60 rounded-2xl border border-gray-100 h-full"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#333333]">
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
                  <Plus size={14} />
                </button>
              </div>

              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-100 transition-all"
                  >
                    <h4
                      className={`font-bold text-sm text-[#333333] leading-snug ${
                        task.status === "completed"
                          ? "line-through opacity-50"
                          : ""
                      }`}
                    >
                      {task.task_name}
                    </h4>
                    {task.created_by_client && (
                      <p className="text-[10px] font-semibold text-gray-400 mt-2">
                        Created by you
                      </p>
                    )}
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="h-20 border border-dashed border-gray-100 rounded-xl flex items-center justify-center text-[10px] font-bold text-gray-400 tracking-widest">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
