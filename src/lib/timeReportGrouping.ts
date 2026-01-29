export type ReportEntryBase = {
  id?: string;
  source_time_entry_id?: string;
  entry_date: string;
  task_title: string;
  duration_seconds: number;
  notes: string | null;
  session_id?: string | null;
  task_id?: string | null;
};

export type ReportDisplayEntry = {
  key: string;
  entry_date: string;
  task_title: string;
  duration_seconds: number;
  notes: string | null;
  level: number;
  is_session_summary: boolean;
};

type Block =
  | {
      type: "session";
      sortKey: number;
      sessionId: string;
      entries: ReportEntryBase[];
      startMs: number;
    }
  | { type: "entry"; sortKey: number; entry: ReportEntryBase };

const toMs = (value: string) => new Date(value).getTime();

const isUnassignedEntry = (entry: ReportEntryBase) => {
  if (entry.task_id) return false;
  const title = entry.task_title.toLowerCase();
  return (
    title.includes("client session") ||
    title.includes("client work") ||
    title.includes("unassigned")
  );
};

const buildEntryKey = (entry: ReportEntryBase, index: number) =>
  entry.source_time_entry_id ||
  entry.id ||
  `${entry.entry_date}-${entry.task_title}-${index}`;

export const buildReportDisplayEntries = (
  entries: ReportEntryBase[],
): ReportDisplayEntry[] => {
  if (entries.length === 0) return [];

  const sessionGroups = new Map<string, ReportEntryBase[]>();
  const standalone: ReportEntryBase[] = [];

  entries.forEach((entry) => {
    if (entry.session_id) {
      const bucket = sessionGroups.get(entry.session_id) || [];
      bucket.push(entry);
      sessionGroups.set(entry.session_id, bucket);
    } else {
      standalone.push(entry);
    }
  });

  const blocks: Block[] = [];
  sessionGroups.forEach((group, sessionId) => {
    const sorted = [...group].sort(
      (a, b) => toMs(a.entry_date) - toMs(b.entry_date),
    );
    const startMs = toMs(sorted[0]?.entry_date || new Date().toISOString());
    const endMs = toMs(sorted[sorted.length - 1]?.entry_date || new Date().toISOString());
    blocks.push({
      type: "session",
      sortKey: endMs,
      sessionId,
      entries: sorted,
      startMs,
    });
  });

  standalone.forEach((entry) => {
    blocks.push({ type: "entry", sortKey: toMs(entry.entry_date), entry });
  });

  blocks.sort((a, b) => b.sortKey - a.sortKey);

  const display: ReportDisplayEntry[] = [];
  blocks.forEach((block) => {
    if (block.type === "entry") {
      const entry = block.entry;
      display.push({
        key: buildEntryKey(entry, display.length),
        entry_date: entry.entry_date,
        task_title: isUnassignedEntry(entry)
          ? "Client Work"
          : entry.task_title,
        duration_seconds: entry.duration_seconds,
        notes: entry.notes ?? null,
        level: 0,
        is_session_summary: false,
      });
      return;
    }

    const totalSeconds = block.entries.reduce(
      (sum, entry) => sum + entry.duration_seconds,
      0,
    );
    display.push({
      key: `session-${block.sessionId}`,
      entry_date: new Date(block.startMs).toISOString(),
      task_title: "Client Session",
      duration_seconds: totalSeconds,
      notes: null,
      level: 0,
      is_session_summary: true,
    });

    block.entries.forEach((entry, index) => {
      display.push({
        key: buildEntryKey(entry, index),
        entry_date: entry.entry_date,
        task_title: isUnassignedEntry(entry)
          ? "Client Work"
          : entry.task_title,
        duration_seconds: entry.duration_seconds,
        notes: entry.notes ?? null,
        level: 1,
        is_session_summary: false,
      });
    });
  });

  return display;
};
