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
  start_time: string | null;
  details?: string;
  category?: string; // <--- This is the magic line that fixes the errors
  clients?: {
    business_name: string;
    surname: string;
  };
}
