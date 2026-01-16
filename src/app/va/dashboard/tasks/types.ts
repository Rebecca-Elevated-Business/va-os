export interface Task {
  id: string;
  va_id: string;
  client_id: string | null;
  task_name: string;
  status: string;
  due_date: string | null;
  scheduled_start: string | null; // Added for Calendar
  scheduled_end: string | null; // Added for Calendar
  total_minutes: number;
  is_running: boolean;
  start_time: string | null; // This is for the LIVE timer
  details?: string;
  clients?: {
    business_name: string;
    surname: string;
  };
}
