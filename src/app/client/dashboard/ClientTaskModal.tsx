"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import TaskNotes from "@/components/tasks/TaskNotes";

export type ClientTask = {
  id: string;
  task_name: string;
  details?: string | null;
  status: string;
  client_id: string | null;
  shared_with_client?: boolean;
  created_by_client?: boolean;
};

type ClientTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  task?: ClientTask | null;
  clientId: string;
  clientName: string;
  onCreate: (payload: {
    task_name: string;
    details: string | null;
    status: string;
  }) => Promise<void>;
  onUpdate: (taskId: string, payload: {
    task_name: string;
    details: string | null;
  }) => Promise<void>;
};

export default function ClientTaskModal({
  isOpen,
  onClose,
  task,
  clientId,
  clientName,
  onCreate,
  onUpdate,
}: ClientTaskModalProps) {
  const isEditing = Boolean(task);
  const canEditFields = task?.created_by_client ?? true;
  const [formName, setFormName] = useState(task?.task_name || "");
  const [formDetails, setFormDetails] = useState(task?.details || "");
  const createStatus = task?.status || "todo";
  const [saving, setSaving] = useState(false);

  const modalTitle = useMemo(
    () => (isEditing ? "Task details" : "New task"),
    [isEditing],
  );

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    if (task) {
      if (canEditFields) {
        await onUpdate(task.id, {
          task_name: formName.trim(),
          details: formDetails.trim() || null,
        });
      }
    } else {
      await onCreate({
        task_name: formName.trim(),
        details: formDetails.trim() || null,
        status: createStatus,
      });
    }
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-black text-[#333333]">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1">
              Task title
            </label>
            <input
              className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-[#333333]"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="What do you need done?"
              disabled={isEditing && !canEditFields}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-[#333333] tracking-widest block mb-1">
              Details
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-[#333333]"
              rows={4}
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder="Optional details"
              disabled={isEditing && !canEditFields}
            />
          </div>

          {task?.id && (
            <TaskNotes
              taskId={task.id}
              taskName={task.task_name}
              viewerType="client"
              viewerId={clientId}
              clientId={clientId}
              clientName={clientName}
              sharedWithClient={Boolean(task.shared_with_client)}
            />
          )}
        </div>

        <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-[#333333]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#9d4edd] text-white text-xs font-bold"
            >
              {task ? "Save changes" : "Create task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
