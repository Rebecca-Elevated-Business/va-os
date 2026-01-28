"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

export type ClientSession = {
  id: string;
  va_id: string;
  client_id: string;
  started_at: string;
  ended_at: string | null;
  created_at?: string;
};

export type ClientSessionEntry = {
  id: string;
  session_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at?: string;
};

type ClientSessionContextValue = {
  activeSession: ClientSession | null;
  activeEntry: ClientSessionEntry | null;
  activeClientId: string | null;
  isRunning: boolean;
  isLoading: boolean;
  sessionElapsedSeconds: number;
  startSession: (clientId: string) => Promise<void>;
  stopSession: () => Promise<void>;
  startTaskEntry: (taskId: string, clientId: string | null) => Promise<void>;
  stopActiveTaskEntry: () => Promise<void>;
  dismissActiveTaskEntry: () => Promise<void>;
  getActiveEntryDurationSeconds: () => number;
};

const ClientSessionContext = createContext<ClientSessionContextValue | undefined>(
  undefined,
);

const toMs = (value: string) => new Date(value).getTime();

const formatDurationSeconds = (startIso: string, endIso: string) => {
  const durationSeconds = Math.round((toMs(endIso) - toMs(startIso)) / 1000);
  return Math.max(0, durationSeconds);
};

export function ClientSessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ClientSession | null>(null);
  const [activeEntry, setActiveEntry] = useState<ClientSessionEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const lastClosedEntryRef = useRef<ClientSessionEntry | null>(null);

  const activeClientId = activeSession?.client_id || null;
  const isRunning = Boolean(activeSession && !activeSession.ended_at);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    loadUser();
  }, []);

  const loadActiveSession = useCallback(async (currentUserId: string) => {
    const { data: sessionData } = await supabase
      .from("client_sessions")
      .select("*")
      .eq("va_id", currentUserId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    const session = sessionData?.[0] as ClientSession | undefined;
    setActiveSession(session || null);

    if (!session) {
      setActiveEntry(null);
      return;
    }

    const { data: entryData } = await supabase
      .from("client_session_entries")
      .select("*")
      .eq("session_id", session.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    setActiveEntry((entryData?.[0] as ClientSessionEntry) || null);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    loadActiveSession(userId).finally(() => setIsLoading(false));

    const sessionChannel = supabase
      .channel("client-sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_sessions",
          filter: `va_id=eq.${userId}`,
        },
        () => {
          loadActiveSession(userId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [loadActiveSession, userId]);

  const closeEntry = useCallback(
    async (
      entry: ClientSessionEntry,
      endTime: string,
      session: ClientSession | null,
    ) => {
      const durationSeconds = formatDurationSeconds(entry.started_at, endTime);
      await supabase
        .from("client_session_entries")
        .update({ ended_at: endTime, duration_seconds: durationSeconds })
        .eq("id", entry.id);

      if (session && durationSeconds > 0) {
        await supabase.from("time_entries").insert([
          {
            task_id: entry.task_id,
            client_id: session.client_id,
            va_id: session.va_id,
            started_at: entry.started_at,
            ended_at: endTime,
            duration_minutes: durationSeconds / 60,
          },
        ]);
      }

      return durationSeconds;
    },
    [],
  );

  const stopSession = useCallback(async () => {
    if (!activeSession) return;
    const endTime = new Date().toISOString();

    if (activeEntry) {
      await closeEntry(activeEntry, endTime, activeSession);
    }

    await supabase
      .from("client_sessions")
      .update({ ended_at: endTime })
      .eq("id", activeSession.id);

    setActiveSession(null);
    setActiveEntry(null);
    lastClosedEntryRef.current = null;
  }, [activeEntry, activeSession, closeEntry]);

  const startSession = useCallback(async (clientId: string) => {
    if (!userId) return;

    if (activeSession && !activeSession.ended_at) {
      await stopSession();
    }

    const startTime = new Date().toISOString();
    const { data: sessionData } = await supabase
      .from("client_sessions")
      .insert([
        {
          va_id: userId,
          client_id: clientId,
          started_at: startTime,
        },
      ])
      .select("*")
      .single();

    if (!sessionData) return;
    const session = sessionData as ClientSession;
    setActiveSession(session);

    const { data: entryData } = await supabase
      .from("client_session_entries")
      .insert([
        {
          session_id: session.id,
          task_id: null,
          started_at: startTime,
        },
      ])
      .select("*")
      .single();

    setActiveEntry((entryData as ClientSessionEntry) || null);
    lastClosedEntryRef.current = null;
  }, [activeSession, stopSession, userId]);

  const startTaskEntry = useCallback(
    async (taskId: string, clientId: string | null) => {
      if (!activeSession) return;
      if (!clientId || clientId !== activeSession.client_id) return;
      if (activeEntry?.task_id === taskId) return;

      const startTime = new Date().toISOString();

      if (activeEntry) {
      await closeEntry(activeEntry, startTime, activeSession);
        lastClosedEntryRef.current = activeEntry;
      }

      const { data: entryData } = await supabase
        .from("client_session_entries")
        .insert([
          {
            session_id: activeSession.id,
            task_id: taskId,
            started_at: startTime,
          },
        ])
        .select("*")
        .single();

      setActiveEntry((entryData as ClientSessionEntry) || null);
    },
    [activeEntry, activeSession, closeEntry],
  );

  const stopActiveTaskEntry = useCallback(async () => {
    if (!activeSession || !activeEntry || !activeEntry.task_id) return;
    const endTime = new Date().toISOString();
    await closeEntry(activeEntry, endTime, activeSession);

    const { data: entryData } = await supabase
      .from("client_session_entries")
      .insert([
        {
          session_id: activeSession.id,
          task_id: null,
          started_at: endTime,
        },
      ])
      .select("*")
      .single();

    setActiveEntry((entryData as ClientSessionEntry) || null);
    lastClosedEntryRef.current = null;
  }, [activeEntry, activeSession, closeEntry]);

  const dismissActiveTaskEntry = useCallback(async () => {
    if (!activeSession || !activeEntry || !activeEntry.task_id) return;

    await supabase.from("client_session_entries").delete().eq("id", activeEntry.id);

    const lastClosed = lastClosedEntryRef.current;
    if (lastClosed) {
      await supabase
        .from("client_session_entries")
        .update({ ended_at: null, duration_seconds: null })
        .eq("id", lastClosed.id);
      setActiveEntry({ ...lastClosed, ended_at: null, duration_seconds: null });
    } else {
      const startTime = new Date().toISOString();
      const { data: entryData } = await supabase
        .from("client_session_entries")
        .insert([
          {
            session_id: activeSession.id,
            task_id: null,
            started_at: startTime,
          },
        ])
        .select("*")
        .single();
      setActiveEntry((entryData as ClientSessionEntry) || null);
    }

    lastClosedEntryRef.current = null;
  }, [activeEntry, activeSession]);

  const getActiveEntryDurationSeconds = useCallback(() => {
    if (!activeEntry) return 0;
    return Math.max(0, Math.floor((now - toMs(activeEntry.started_at)) / 1000));
  }, [activeEntry, now]);

  const sessionElapsedSeconds = useMemo(() => {
    if (!activeSession) return 0;
    const endTime = activeSession.ended_at
      ? toMs(activeSession.ended_at)
      : now;
    return Math.max(0, Math.floor((endTime - toMs(activeSession.started_at)) / 1000));
  }, [activeSession, now]);

  const value = useMemo(
    () => ({
      activeSession,
      activeEntry,
      activeClientId,
      isRunning,
      isLoading,
      sessionElapsedSeconds,
      startSession,
      stopSession,
      startTaskEntry,
      stopActiveTaskEntry,
      dismissActiveTaskEntry,
      getActiveEntryDurationSeconds,
    }),
    [
      activeSession,
      activeEntry,
      activeClientId,
      isRunning,
      isLoading,
      sessionElapsedSeconds,
      startSession,
      stopSession,
      startTaskEntry,
      stopActiveTaskEntry,
      dismissActiveTaskEntry,
      getActiveEntryDurationSeconds,
    ],
  );

  return (
    <ClientSessionContext.Provider value={value}>
      {children}
    </ClientSessionContext.Provider>
  );
}

export function useClientSession() {
  const context = useContext(ClientSessionContext);
  if (!context) {
    throw new Error("useClientSession must be used within ClientSessionProvider");
  }
  return context;
}
