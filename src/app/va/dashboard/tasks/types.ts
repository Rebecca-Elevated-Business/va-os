export interface Task {
  id: string;
  va_id: string;
  client_id: string | null;
  task_name: string;
  status: string;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  total_minutes: number;
  is_running: boolean;
  is_completed?: boolean;
  start_time: string | null;
  end_time?: string | null;
  parent_task_id?: string | null;
  details?: string;
  category?: string; // <--- This is the magic line that fixes the errors
  clients?: {
    business_name: string;
    surname: string;
  };
}

export type StatusOption = {
  id: string;
  label: string;
  color: string;
};

export const STATUS_CONFIG: Record<string, StatusOption> = {
  todo: { id: "todo", label: "To Do", color: "bg-purple-100 text-purple-700" },
  up_next: {
    id: "up_next",
    label: "Up Next",
    color: "bg-blue-100 text-blue-700",
  },
  in_progress: {
    id: "in_progress",
    label: "In Progress",
    color: "bg-yellow-100 text-yellow-700",
  },
  completed: {
    id: "completed",
    label: "Completed",
    color: "bg-green-100 text-green-700",
  },
};
