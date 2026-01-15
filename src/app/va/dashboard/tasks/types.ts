export type Task = {
  id: string;
  task_name: string;
  status: string; // 'todo', 'up_next', 'in_progress', 'completed'
  category: string; // 'client', 'business', 'personal'
  priority: string;
  due_date: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  total_minutes: number;
  is_running: boolean;
  start_time: string | null;
  client_id: string | null;
  clients?: { business_name: string; surname: string };
};
