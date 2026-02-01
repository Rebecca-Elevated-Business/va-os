"use client";

import type { ClientTask } from "./ClientTaskModal";

type ClientTaskBoardProps = {
  tasks: ClientTask[];
  onOpenTask: (task: ClientTask) => void;
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
}: ClientTaskBoardProps) {
  return (
    <div className="h-[520px] overflow-x-auto pb-2 custom-scrollbar">
      <div className="flex gap-4 h-full min-w-max px-1">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex-1 w-64 flex flex-col bg-white rounded-2xl h-full"
            >
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#333333]">
                    {col.title}
                  </h3>
                  <span className="bg-gray-50 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#333333] border border-gray-100">
                    {colTasks.length}
                  </span>
                </div>
                <span />
              </div>

              <div className="px-3 pb-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className="bg-gray-50 p-3 rounded-xl shadow-md border border-gray-100 hover:shadow-lg hover:border-purple-100 transition-all"
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
                  <div className="h-20 border border-dashed border-gray-100 rounded-xl flex items-center justify-center text-[10px] font-bold text-gray-400 tracking-widest bg-gray-50/60">
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
