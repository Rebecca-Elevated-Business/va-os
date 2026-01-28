"use client";

import { useState, useEffect, use, useCallback, useRef, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usePrompt } from "@/components/ui/PromptProvider";
import {
  ChevronDown,
  ChevronRight,
  FileSignature,
  FileText,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  ReceiptText,
} from "lucide-react";
import { format } from "date-fns";
import TaskModal from "../../../tasks/TaskModal";
import { STATUS_CONFIG, Task } from "../../../tasks/types";
import { useClientSession } from "../../../ClientSessionContext";

// --- TYPES ---
type Client = {
  id: string;
  first_name: string;
  surname: string;
  business_name: string;
  job_title?: string;
  email: string;
  phone: string;
  address?: string;
  status: string;
  work_type: string;
  has_access: boolean;
  portal_invite_link?: string | null;
  portal_access_enabled?: boolean | null;
  portal_access_revoked_at?: string | null;
  auth_user_id?: string | null;
  source?: string | null;
  website_links?: string[] | null;
};

type ClientDocument = {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

type Agreement = {
  id: string;
  title: string;
  status: string;
  last_updated_at: string;
};

const CRM_TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Task Manager" },
  { id: "docs", label: "Documents & Workflows" },
  { id: "notes", label: "Internal Notes" },
] as const;

type CrmTabId = (typeof CRM_TABS)[number]["id"];

const formatHms = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
};

const formatDateCell = (dateValue: string | null | undefined) => {
  if (!dateValue) return "-";
  return format(new Date(dateValue), "d MMM");
};

// --- COMPONENT ---
export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, alert } = usePrompt();
  const {
    activeClientId,
    activeEntry,
    isRunning: isSessionRunning,
    sessionElapsedSeconds,
    startSession,
    stopSession,
    startTaskEntry,
    stopActiveTaskEntry,
    dismissActiveTaskEntry,
    getActiveEntryDurationSeconds,
  } = useClientSession();

  // --- STATE ---
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientAgreements, setClientAgreements] = useState<Agreement[]>([]);
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);

  // Task Manager State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([
    "todo",
    "up_next",
    "in_progress",
  ]);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(0); // Initialize with 0 to satisfy React Purity
  const [taskModalTask, setTaskModalTask] = useState<Task | null>(null);
  const [taskModalPrefill, setTaskModalPrefill] = useState<{
    parentTaskId?: string | null;
  } | null>(null);
  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [portalManageOpen, setPortalManageOpen] = useState(false);
  const [revokeInput, setRevokeInput] = useState("");
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [portalCopied, setPortalCopied] = useState(false);
  const [deleteClientBusy, setDeleteClientBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [draftClient, setDraftClient] = useState<Client | null>(null);
  const [websiteLinks, setWebsiteLinks] = useState<string[]>([]);
  const [isSavingOverview, setIsSavingOverview] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [docStartDate, setDocStartDate] = useState("");
  const [docEndDate, setDocEndDate] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>(
    {},
  );
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [draggingParentId, setDraggingParentId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [collapsedStatus, setCollapsedStatus] = useState<Record<string, boolean>>(
    { completed: true },
  );
  const [activeTab, setActiveTab] = useState<CrmTabId>("overview");

  // --- DATA FETCHING ---
  const refreshData = useCallback(async () => {
    // 1. Fetch Client
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();
    if (clientData) setClient(clientData);

    // 2. Fetch Notes
    const { data: notesData } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });
    if (notesData) setNotes(notesData || []);

    // 3. Fetch Tasks
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (tasksData) setTasks(tasksData);
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      await refreshData();
      if (active) setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, [id, refreshData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusFilterRef.current &&
        !statusFilterRef.current.contains(event.target as Node)
      ) {
        setIsStatusFilterOpen(false);
      }
      if (!(event.target as Element).closest(".action-menu-trigger")) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchAgreements() {
      console.log("Fetching agreements for Client ID:", id); // Debug Log 1

      const { data, error } = await supabase // Capture 'error'
        .from("client_agreements")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching agreements:", error.message); // Debug Log 2
      } else {
        console.log("Agreements found:", data); // Debug Log 3
        if (data) setClientAgreements(data);
      }
    }
    fetchAgreements();
    // New: Fetch Documents (Proposals, Booking Forms, Invoices)
    async function fetchDocuments() {
      const { data: docData } = await supabase
        .from("client_documents")
        .select("id, title, type, status, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (docData) setClientDocuments(docData as ClientDocument[]);
    }
    fetchDocuments();
  }, [id]);


  // --- GLOBAL TICKER ---
  // Updates the UI every second so any running tasks show their time ticking up
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS ---

  // 1. Toggle Timer (Play/Stop logic)
  const toggleTimer = async (task: Task) => {
    if (isSessionRunning) return;
    if (task.is_running) {
      // STOPPING: Calculate elapsed time and add to total
      if (!task.start_time) return;
      const start = new Date(task.start_time).getTime();
      const end = new Date().getTime(); // Use new Date() object instead of Date.now()
      const elapsedSeconds = Math.max(0, Math.round((end - start) / 1000));
      const currentSessionMinutes = elapsedSeconds / 60;
      const endTime = new Date().toISOString();

      await supabase
        .from("tasks")
        .update({
          is_running: false,
          start_time: null,
          end_time: endTime,
          total_minutes: task.total_minutes + currentSessionMinutes,
        })
        .eq("id", task.id);
      await supabase.from("time_entries").insert([
        {
          task_id: task.id,
          va_id: task.va_id,
          started_at: task.start_time,
          ended_at: endTime,
          duration_minutes: currentSessionMinutes,
        },
      ]);
    } else {
      const startTime = new Date().toISOString();
      // STARTING: Mark as running and save start timestamp
      await supabase
        .from("tasks")
        .update({
          is_running: true,
          start_time: startTime,
          end_time: null,
          status: "in_progress",
        })
        .eq("id", task.id);
    }
    refreshData();
  };

  // 3. Update Status
  const updateTaskStatus = async (task: Task, newStatus: string) => {
    if (task.status === newStatus) return;
    await supabase
      .from("tasks")
      .update({
        status: newStatus,
        is_completed: newStatus === "completed",
      })
      .eq("id", task.id);
    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: newStatus,
              is_completed: newStatus === "completed",
            }
          : item,
      ),
    );
  };

  // 4. Update Client Info
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const workingClient = draftClient ?? client;
    const nextWebsiteLinks =
      draftClient !== null ? websiteLinks : client.website_links ?? [];
    setIsSavingOverview(true);
    const { error } = await supabase
      .from("clients")
      .update({
        first_name: workingClient.first_name,
        surname: workingClient.surname,
        job_title: workingClient.job_title || null,
        business_name: workingClient.business_name,
        email: workingClient.email,
        phone: workingClient.phone,
        address: workingClient.address || null,
        source: workingClient.source || null,
        status: workingClient.status,
        work_type: workingClient.work_type,
        website_links: nextWebsiteLinks.filter((link) => link.trim().length > 0),
      })
      .eq("id", id);
    if (error) {
      await alert({
        title: "Error saving client",
        message: error.message,
        tone: "danger",
      });
      setIsSavingOverview(false);
      return;
    }

    const normalizedSummary = summaryDraft.trim();
    const currentSummary = (notes[0]?.content || "").trim();
    if (normalizedSummary && normalizedSummary !== currentSummary) {
      const { data: userData } = await supabase.auth.getUser();
      const { error: noteError } = await supabase.from("client_notes").insert([
        {
          client_id: id,
          va_id: userData.user?.id,
          content: normalizedSummary,
        },
      ]);
      if (noteError) {
        await alert({
          title: "Saved client, but note failed",
          message: noteError.message,
          tone: "danger",
        });
      }
    }
    setIsEditing(false);
    setDraftClient(null);
    setIsSavingOverview(false);
    refreshData();
  };

  // 5. Add Internal Note
  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("client_notes").insert([
      {
        client_id: id,
        va_id: userData.user?.id,
        content: newNote,
      },
    ]);
    setNewNote("");
    refreshData();
  };
  // 6. Delete Task
  const deleteTask = async (taskId: string) => {
    const ok = await confirm({
      title: "Delete task?",
      message: "Are you sure you want to delete this task?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;

    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: deletedAt })
      .eq("id", taskId);
    if (!error) refreshData();
  };

  const deleteAgreement = async (agreementId: string) => {
    const ok = await confirm({
      title: "Delete agreement?",
      message: "Delete this agreement?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_agreements")
      .delete()
      .eq("id", agreementId);
    if (!error) {
      setClientAgreements((prev) => prev.filter((a) => a.id !== agreementId));
    }
  };

  // New: Function to delete a service agreement
  const revokeAgreement = async (agreementId: string) => {
    const ok = await confirm({
      title: "Revoke agreement?",
      message:
        "Revoke this agreement? It will return to draft mode and hide from the client.",
      confirmLabel: "Revoke",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_agreements")
      .update({ status: "draft" })
      .eq("id", agreementId);
    if (!error) {
      setClientAgreements(
        clientAgreements.map((ag) =>
          ag.id === agreementId ? { ...ag, status: "draft" } : ag,
        ),
      );
    }
  };

  const deleteDocument = async (docId: string) => {
    const ok = await confirm({
      title: "Delete document?",
      message: "Delete this document permanently?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_documents")
      .delete()
      .eq("id", docId);
    if (!error)
      setClientDocuments(clientDocuments.filter((d) => d.id !== docId));
  };
  const revokeDocument = async (docId: string) => {
    const ok = await confirm({
      title: "Revoke document?",
      message:
        "Revoke this document? It will disappear from the client portal and return to draft.",
      confirmLabel: "Revoke",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("client_documents")
      .update({ status: "draft" })
      .eq("id", docId);
    if (!error) {
      setClientDocuments(
        clientDocuments.map((d) =>
          d.id === docId ? { ...d, status: "draft" } : d,
        ),
      );
    }
  };

  const openTaskModal = (
    task?: Task,
    options?: { parentTaskId?: string | null },
  ) => {
    setTaskModalTask(task || null);
    setTaskModalPrefill(options || null);
    setIsTaskModalOpen(true);
    if (task) {
      void startTaskEntry(task.id, task.client_id);
    }
  };

  const handleToggleSession = async () => {
    if (!client) return;
    if (isSessionRunning) {
      if (activeClientId && activeClientId !== client.id) {
        await startSession(client.id);
        return;
      }
      await stopSession();
      return;
    }
    await startSession(client.id);
  };

  const toggleParentExpanded = (taskId: string) => {
    setExpandedParents((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleDropOnParent = async (parentId: string) => {
    if (!draggingTaskId || draggingTaskId === parentId) return;
    await supabase
      .from("tasks")
      .update({ parent_task_id: parentId })
      .eq("id", draggingTaskId);
    setDraggingTaskId(null);
    setDropTargetId(null);
    refreshData();
  };

  const handleDropToTopLevel = async () => {
    if (!draggingTaskId) return;
    await supabase
      .from("tasks")
      .update({ parent_task_id: null })
      .eq("id", draggingTaskId);
    setDraggingTaskId(null);
    setDraggingParentId(null);
    setDropTargetId(null);
    refreshData();
  };

  const reorderSubtasks = async (parentId: string, targetId: string) => {
    if (!draggingTaskId || draggingTaskId === targetId) return;
    if (draggingParentId !== parentId) return;
    const siblings = subtasksByParent[parentId] || [];
    const currentIndex = siblings.findIndex((task) => task.id === draggingTaskId);
    const targetIndex = siblings.findIndex((task) => task.id === targetId);
    if (currentIndex === -1 || targetIndex === -1) return;
    const reordered = [...siblings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    await Promise.all(
      reordered.map((task, index) =>
        supabase
          .from("tasks")
          .update({ sort_order: index + 1 })
          .eq("id", task.id),
      ),
    );
    setDraggingTaskId(null);
    setDraggingParentId(null);
    setDropTargetId(null);
    refreshData();
  };

  const reorderParents = async (targetId: string) => {
    if (!draggingTaskId || draggingTaskId === targetId) return;
    const currentIndex = topLevelTasks.findIndex(
      (task) => task.id === draggingTaskId,
    );
    const targetIndex = topLevelTasks.findIndex(
      (task) => task.id === targetId,
    );
    if (currentIndex === -1 || targetIndex === -1) return;
    const reordered = [...topLevelTasks];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    await Promise.all(
      reordered.map((task, index) =>
        supabase
          .from("tasks")
          .update({ sort_order: index + 1 })
          .eq("id", task.id),
      ),
    );
    setDraggingTaskId(null);
    setDraggingParentId(null);
    setDropTargetId(null);
    refreshData();
  };

  const handleCloseTaskModal = async () => {
    if (taskModalTask && activeEntry?.task_id === taskModalTask.id) {
      const duration = getActiveEntryDurationSeconds();
      if (duration < 5) {
        const dismiss = await confirm({
          title: "Dismiss task from timer report?",
          message: "Close task and dismiss from timer report?",
          confirmLabel: "Dismiss",
          cancelLabel: "Keep open",
        });
        if (!dismiss) return;
        await dismissActiveTaskEntry();
      } else {
        await stopActiveTaskEntry();
      }
    }
    setIsTaskModalOpen(false);
    setTaskModalTask(null);
    setTaskModalPrefill(null);
  };
  const issuePortalAccess = async () => {
    if (!client) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/client/setup?email=${encodeURIComponent(
      client.email || "",
    )}&id=${id}`;
    const { error } = await supabase
      .from("clients")
      .update({
        portal_invite_link: link,
        portal_access_enabled: false,
        portal_access_revoked_at: null,
      })
      .eq("id", id);
    if (!error) {
      setClient({ ...client, portal_invite_link: link });
    }
  };

  const copyInviteLink = async () => {
    if (!client?.portal_invite_link) return;
    await navigator.clipboard.writeText(client.portal_invite_link);
    setPortalCopied(true);
    setTimeout(() => setPortalCopied(false), 1500);
  };

  const reissuePortalAccess = async () => {
    if (!client) return;
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/client/setup?email=${encodeURIComponent(
      client.email || "",
    )}&id=${id}`;
    const { error } = await supabase
      .from("clients")
      .update({ portal_invite_link: link })
      .eq("id", id);
    if (!error) {
      setClient({ ...client, portal_invite_link: link });
    }
  };

  const revokePortalAccess = async () => {
    if (!client || revokeInput.trim() !== "REVOKE") return;
    const { error } = await supabase
      .from("clients")
      .update({
        portal_access_enabled: false,
        portal_access_revoked_at: new Date().toISOString(),
        has_access: false,
      })
      .eq("id", id);

    if (client.auth_user_id) {
      await supabase
        .from("profiles")
        .update({ status: "revoked" })
        .eq("id", client.auth_user_id);
    }

    if (!error) {
      setClient({ ...client, portal_access_enabled: false, has_access: false });
      setPortalManageOpen(false);
      setRevokeInput("");
    }
  };

  const deleteClient = async () => {
    if (!client || deleteConfirmInput.trim() !== "DELETE") return;
    const ok = await confirm({
      title: "Delete client?",
      message: "Delete this client permanently?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleteClientBusy(true);
    await supabase.from("tasks").delete().eq("client_id", id);
    await supabase.from("client_notes").delete().eq("client_id", id);
    await supabase.from("client_documents").delete().eq("client_id", id);
    await supabase.from("client_agreements").delete().eq("client_id", id);
    await supabase.from("client_requests").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    setDeleteClientBusy(false);
    if (!error) {
      router.push("/va/dashboard/crm");
    }
  };

  // --- HELPER: Format Time Display ---
  const formatTime = (task: Task) => {
    // 1. Convert stored minutes to seconds so we can do precise math
    let totalSeconds = task.total_minutes * 60;

    // 2. If running, add the live elapsed seconds
    if (task.is_running && task.start_time) {
      totalSeconds += (now - new Date(task.start_time).getTime()) / 1000;
    }

    // 3. Calculate hours, minutes, AND seconds
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    return `${hrs}h ${mins}m ${secs}s`;
  };

  if (loading) return <div className="p-10 text-black">Loading Profile...</div>;
  if (!client)
    return (
      <div className="p-10 text-black text-center mt-20">Client not found.</div>
    );

  const getTaskStatus = (task: Task) =>
    task.status || (task.is_completed ? "completed" : "todo");
  const visibleTasks = tasks.filter((task) => {
    const status = getTaskStatus(task);
    if (!statusFilter.includes(status)) return false;
    return true;
  });
  const statusOrder = ["todo", "up_next", "in_progress", "completed"];
  const orderTasks = (items: Task[]) =>
    [...items].sort((a, b) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });

  const topLevelTasks = orderTasks(
    visibleTasks.filter((task) => !task.parent_task_id),
  );
  const groupedTasks = statusOrder
    .map((status) => ({
      status,
      items: topLevelTasks.filter(
        (task) => getTaskStatus(task) === status,
      ),
    }))
    .filter((group) => group.items.length > 0);
  const subtasksByParent = visibleTasks.reduce<Record<string, Task[]>>(
    (acc, task) => {
      if (!task.parent_task_id) return acc;
      if (!acc[task.parent_task_id]) acc[task.parent_task_id] = [];
      acc[task.parent_task_id].push(task);
      return acc;
    },
    {},
  );
  Object.keys(subtasksByParent).forEach((parentId) => {
    subtasksByParent[parentId] = orderTasks(subtasksByParent[parentId]);
  });
  const hasSubtasks = (taskId: string) =>
    Boolean(subtasksByParent[taskId]?.length);
  const portalInviteLink = client.portal_invite_link?.trim() || "";
  const portalAccessEnabled = client.portal_access_enabled ?? client.has_access;
  const inDateRange = (value: string) => {
    if (!docStartDate && !docEndDate) return true;
    const dateValue = new Date(value);
    if (docStartDate) {
      const start = new Date(`${docStartDate}T00:00:00`);
      if (dateValue < start) return false;
    }
    if (docEndDate) {
      const end = new Date(`${docEndDate}T23:59:59.999`);
      if (dateValue > end) return false;
    }
    return true;
  };
  const filteredDocuments = clientDocuments.filter(
    (doc) =>
      (docTypeFilter === "all" || docTypeFilter === doc.type) &&
      inDateRange(doc.created_at),
  );
  const filteredAgreements = clientAgreements.filter(
    (ag) =>
      (docTypeFilter === "all" || docTypeFilter === "workflow") &&
      inDateRange(ag.last_updated_at),
  );
  const documentIcon = (type: string) => {
    if (type === "invoice") return ReceiptText;
    if (type === "booking_form") return FileSignature;
    return FileText;
  };
  const hasDocuments = filteredDocuments.length > 0;
  const hasAgreements = filteredAgreements.length > 0;
  const summaryValue = notes[0]?.content || "";
  const displayClient = (isEditing ? draftClient : client) || client;
  const websiteDisplayLinks =
    (isEditing ? websiteLinks : client?.website_links) ?? [];
  const startEditing = () => {
    if (!client) return;
    setDraftClient({ ...client });
    setWebsiteLinks(client.website_links ?? []);
    setSummaryDraft(summaryValue);
    setIsEditing(true);
  };
  const cancelEditing = () => {
    setIsEditing(false);
    setDraftClient(null);
    setWebsiteLinks(client?.website_links ?? []);
    setSummaryDraft(summaryValue);
  };

  return (
    <div className="flex flex-col h-full text-black space-y-8 pb-20">
      {/* 1. HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {client.first_name} {client.surname}
          </h1>
          <p className="text-sm text-gray-400">
            {client.business_name || "No Business Name"}
          </p>
        </div>
        <div className="flex gap-3">
          {!isEditing && (
            <button
              onClick={startEditing}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800"
            >
              Edit Details
            </button>
          )}
          {!portalAccessEnabled && !portalInviteLink && (
            <button
              onClick={issuePortalAccess}
              className="bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#7b2cbf]"
            >
              Issue Portal Access
            </button>
          )}
          {!portalAccessEnabled && portalInviteLink && (
            <button
              onClick={copyInviteLink}
              className="bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#7b2cbf]"
            >
              {portalCopied ? "Copied" : "Copy Invite Link"}
            </button>
          )}
          {portalAccessEnabled && (
            <button
              onClick={() => setPortalManageOpen((prev) => !prev)}
              className="bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#7b2cbf]"
            >
              Manage Portal Access
            </button>
          )}
        </div>
      </div>

      <nav className="bg-white rounded-xl shadow-sm border border-gray-100 px-4">
        <div className="flex flex-wrap gap-6 border-b border-gray-100">
          {CRM_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "py-4 text-sm font-semibold transition-colors",
                  isActive
                    ? "text-[#9d4edd] border-b-2 border-[#9d4edd]"
                    : "text-gray-500 hover:text-gray-800",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {portalAccessEnabled && portalManageOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Manage Portal Access</h2>
            <button
              onClick={() => setPortalManageOpen(false)}
              className="text-sm text-gray-500 hover:text-black"
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={copyInviteLink}
              className="border border-[#9d4edd] text-[#9d4edd] px-4 py-2 rounded-lg font-bold hover:bg-purple-50"
            >
              {portalCopied ? "Copied" : "Copy Invite Link"}
            </button>
            <button
              onClick={reissuePortalAccess}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-black"
            >
              Re-issue Portal Access
            </button>
          </div>
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-400 mb-2">Danger Zone</p>
            <p className="text-sm text-gray-600 mb-3">
              Revoke portal access immediately for this client.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={revokeInput}
                onChange={(e) => setRevokeInput(e.target.value)}
                placeholder="Type REVOKE to confirm"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={revokePortalAccess}
                disabled={revokeInput.trim() !== "REVOKE"}
                className="text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CLIENT INFORMATION (Horizontal Layout) */}
      {activeTab === "overview" && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <form onSubmit={handleUpdateClient}>
            <div className="p-6">
              <div className="flex items-center justify-end gap-2 pb-4">
                {isEditing && (
                  <>
                    <button
                      type="submit"
                      disabled={isSavingOverview}
                      className="bg-[#9d4edd] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#7b2cbf] disabled:opacity-60"
                    >
                      {isSavingOverview ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-sm font-semibold text-gray-500 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              {displayClient && (
                <>
                  <div className="relative">
                    <div className="hidden md:block absolute left-1/2 -translate-x-1/2 border-l border-gray-200" style={{ top: "12.5%", bottom: "12.5%" }} />
                    <div className="grid gap-10 md:grid-cols-2">
                      <dl className="space-y-5">
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Name
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <div className="grid grid-cols-2 gap-3">
                                <input
                                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                  value={displayClient.first_name || ""}
                                  onChange={(e) =>
                                    draftClient &&
                                    setDraftClient({
                                      ...draftClient,
                                      first_name: e.target.value,
                                    })
                                  }
                                />
                                <input
                                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                  value={displayClient.surname || ""}
                                  onChange={(e) =>
                                    draftClient &&
                                    setDraftClient({
                                      ...draftClient,
                                      surname: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              `${displayClient.first_name || ""} ${
                                displayClient.surname || ""
                              }`.trim() || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Email
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.email || ""}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    email: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              displayClient.email || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Phone
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.phone || ""}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    phone: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              displayClient.phone || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Address
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                            {isEditing ? (
                              <textarea
                                rows={3}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.address || ""}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    address: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              displayClient.address || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Website & Social Links
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <div className="space-y-3">
                                {websiteLinks.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setWebsiteLinks([""])}
                                    className="text-sm font-semibold text-[#9d4edd] hover:underline"
                                  >
                                    + Add website address
                                  </button>
                                )}
                                {websiteLinks.map((link, index) => (
                                  <div
                                    key={`website-${index}`}
                                    className="flex flex-col gap-2"
                                  >
                                    <input
                                      type="text"
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                      placeholder="example.com or https://example.com"
                                      value={link}
                                      onChange={(event) => {
                                        const next = [...websiteLinks];
                                        next[index] = event.target.value;
                                        setWebsiteLinks(next);
                                      }}
                                    />
                                    <div className="flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = websiteLinks.filter(
                                            (_, i) => i !== index,
                                          );
                                          setWebsiteLinks(next);
                                        }}
                                        className="text-xs font-semibold text-gray-400 hover:text-red-500"
                                      >
                                        Remove
                                      </button>
                                      {index === websiteLinks.length - 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setWebsiteLinks([
                                              ...websiteLinks,
                                              "",
                                            ])
                                          }
                                          className="text-sm font-semibold text-[#9d4edd] hover:underline"
                                        >
                                          + Add another website address
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : websiteDisplayLinks.length ? (
                              <div className="flex flex-col gap-1">
                                {websiteDisplayLinks.map((link, index) => (
                                  <span key={`website-${index}`} className="text-sm">
                                    {link}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                      </dl>
                      <dl className="space-y-5">
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Business Name
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.business_name || ""}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    business_name: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              displayClient.business_name || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Job Title
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.job_title || ""}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    job_title: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              displayClient.job_title || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Work Type
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <select
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.work_type}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    work_type: e.target.value,
                                  })
                                }
                              >
                                <option value="Retainer">Retainer</option>
                                <option value="Hourly">Hourly</option>
                                <option value="Ad-hoc">Ad-hoc</option>
                              </select>
                            ) : (
                              displayClient.work_type || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Source
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <select
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.source || ""}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    source: e.target.value,
                                  })
                                }
                              >
                                {[
                                  "",
                                  "Referral",
                                  "Social Media",
                                  "Networking",
                                  "Cold Outreach",
                                  "Affiliate",
                                  "Other",
                                ].map((s) => (
                                  <option key={s || "blank"} value={s}>
                                    {s || "—"}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              displayClient.source || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Summary scope notes
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                            {isEditing ? (
                              <textarea
                                rows={4}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={summaryDraft}
                                onChange={(e) => setSummaryDraft(e.target.value)}
                              />
                            ) : (
                              summaryValue || "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold text-[#333333]">
                            Status
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            {isEditing ? (
                              <select
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9d4edd]"
                                value={displayClient.status}
                                onChange={(e) =>
                                  draftClient &&
                                  setDraftClient({
                                    ...draftClient,
                                    status: e.target.value,
                                  })
                                }
                              >
                                {[
                                  "Enquiry",
                                  "Provisional",
                                  "Won",
                                  "Lost",
                                  "Paused",
                                ].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                                  displayClient.status === "Won"
                                    ? "bg-green-100 text-green-700"
                                    : displayClient.status === "Lost"
                                      ? "bg-red-100 text-red-700"
                                      : displayClient.status === "Provisional"
                                        ? "bg-purple-100 text-[#9d4edd]"
                                        : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {displayClient.status}
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-6 border-t border-gray-200 pt-4">
                      <p className="text-xs font-bold text-red-500 mb-1">
                        DELETE CLIENT?
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        This permanently removes the client and related data.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          value={deleteConfirmInput}
                          onChange={(e) =>
                            setDeleteConfirmInput(e.target.value)
                          }
                          placeholder="Type DELETE to confirm"
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={deleteClient}
                          disabled={
                            deleteConfirmInput.trim() !== "DELETE" ||
                            deleteClientBusy
                          }
                          className="text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                        >
                          Delete Client
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </form>
        </section>
      )}

      {/* 3. TASK MANAGER (Table Layout) */}
      {activeTab === "tasks" && (
        <section className="rounded-xl pb-8">
          <div className="p-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Client Session
                </div>
                <span className="font-mono text-sm text-[#333333]">
                  {formatHms(sessionElapsedSeconds)}
                </span>
                <button
                  onClick={handleToggleSession}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    isSessionRunning
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                  }`}
                >
                  {isSessionRunning && activeClientId && activeClientId !== id
                    ? "Switch to this client"
                    : isSessionRunning
                      ? "Stop Session"
                      : "Start Session"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative" ref={statusFilterRef}>
                  <button
                    onClick={() =>
                      setIsStatusFilterOpen((prev) => !prev)
                    }
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm text-[#333333]"
                  >
                    <Filter size={14} className="text-gray-400" />
                    Filter by Status
                  </button>
                  {isStatusFilterOpen && (
                    <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[10px] font-black text-[#333333] tracking-widest mb-3 ml-1">
                        Visible Statuses
                      </p>
                      <div className="space-y-1">
                        {Object.values(STATUS_CONFIG).map((status) => (
                          <label
                            key={status.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={statusFilter.includes(status.id)}
                                onChange={() =>
                                  setStatusFilter((prev) =>
                                    prev.includes(status.id)
                                      ? prev.filter((x) => x !== status.id)
                                      : [...prev, status.id],
                                  )
                                }
                                className="w-4 h-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
                              />
                              <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-gray-600 border border-gray-200 bg-white">
                                {status.label}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openTaskModal()}
                  className="bg-black text-white px-6 py-2 rounded font-bold hover:bg-gray-800"
                >
                  Add Task
                </button>
              </div>
            </div>

              {/* Tasks Table */}
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white">
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col />
                      <col className="w-32" />
                      <col className="w-32" />
                      <col className="w-24" />
                      <col className="w-24" />
                      <col className="w-8" />
                    </colgroup>
                    <thead>
                      <tr className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                        <th className="px-4 py-2 text-left">Task</th>
                        <th className="px-4 py-2 text-right">Start Date</th>
                        <th className="px-4 py-2 text-right">End Date</th>
                        <th className="px-4 py-2 text-center">Timer</th>
                        <th className="px-4 py-2 text-right">Time Count</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                  </table>
                </div>
                {groupedTasks.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 italic">
                    No tasks found.
                  </div>
                ) : (
                  groupedTasks.map((group) => {
                    const statusConfig =
                      STATUS_CONFIG[group.status] || STATUS_CONFIG["todo"];
                    const isCollapsed =
                      collapsedStatus[group.status] || false;
                    return (
                      <div
                        key={group.status}
                        className="relative rounded-lg border border-gray-200 bg-white overflow-visible"
                      >
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedStatus((prev) => ({
                                ...prev,
                                [group.status]: !isCollapsed,
                              }))
                            }
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={`Toggle ${statusConfig.label}`}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedStatus((prev) => ({
                                ...prev,
                                [group.status]: !isCollapsed,
                              }))
                            }
                            className="text-left text-xs font-semibold text-gray-600"
                          >
                            {statusConfig.label} ({group.items.length})
                          </button>
                        </div>
                        {!isCollapsed && (
                          <table className="w-full table-fixed text-left">
                            <colgroup>
                              <col />
                              <col className="w-32" />
                              <col className="w-32" />
                              <col className="w-24" />
                              <col className="w-24" />
                              <col className="w-8" />
                            </colgroup>
                            <tbody
                              className="divide-y divide-gray-100"
                              onDragOver={(event) => {
                                if (!draggingTaskId || !draggingParentId)
                                  return;
                                event.preventDefault();
                              }}
                              onDrop={(event) => {
                                if (!draggingTaskId || !draggingParentId)
                                  return;
                                event.preventDefault();
                                handleDropToTopLevel();
                              }}
                            >
                              {group.items.map((task) => {
                                const childTasks =
                                  subtasksByParent[task.id] || [];
                                const isExpanded =
                                  expandedParents[task.id] ?? true;
                                const dueDate =
                                  task.scheduled_start || task.due_date;
                                const statusValue = getTaskStatus(task);
                                const endDate =
                                  task.scheduled_end ||
                                  (task.scheduled_start ? null : task.due_date);

                                return (
                                  <Fragment key={task.id}>
                                    <tr
                                      draggable
                                      onDragStart={() => {
                                        setDraggingTaskId(task.id);
                                        setDraggingParentId(
                                          task.parent_task_id || null,
                                        );
                                      }}
                                      onDragEnd={() => {
                                        setDraggingTaskId(null);
                                        setDraggingParentId(null);
                                        setDropTargetId(null);
                                      }}
                                      onDragOver={(event) => {
                                        if (
                                          !draggingTaskId ||
                                          draggingTaskId === task.id
                                        )
                                          return;
                                        if (draggingParentId) return;
                                        event.preventDefault();
                                        setDropTargetId(task.id);
                                      }}
                                      onDragLeave={() => {
                                        if (dropTargetId === task.id) {
                                          setDropTargetId(null);
                                        }
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault();
                                        if (draggingParentId) {
                                          handleDropOnParent(task.id);
                                        } else {
                                          reorderParents(task.id);
                                        }
                                      }}
                                      className={`relative ${
                                        actionMenuId === task.id ? "z-50" : "z-0"
                                      } group hover:bg-gray-50 transition-colors ${
                                        statusValue === "completed"
                                          ? "bg-gray-50 opacity-60"
                                          : ""
                                      } ${
                                        dropTargetId === task.id
                                          ? "bg-purple-50/80 ring-1 ring-purple-100"
                                          : ""
                                      }`}
                                      onClick={() => openTaskModal(task)}
                                    >
                                      {/* 1. TASK NAME */}
                                      <td className="px-4 py-3">
                                        <div className="flex items-start gap-2">
                                          {hasSubtasks(task.id) ? (
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                toggleParentExpanded(task.id);
                                              }}
                                              className="mt-1 text-gray-400 hover:text-gray-600"
                                            >
                                              {isExpanded ? (
                                                <ChevronDown size={14} />
                                              ) : (
                                                <ChevronRight size={14} />
                                              )}
                                            </button>
                                          ) : (
                                            <div className="w-4" />
                                          )}
                                          <div>
                                            <div
                                              className={`text-sm font-semibold text-[#333333] ${
                                                statusValue === "completed"
                                                  ? "line-through opacity-50"
                                                  : ""
                                              }`}
                                            >
                                              {task.task_name}
                                            </div>
                                            <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  openTaskModal(task);
                                                }}
                                                className="text-[10px] font-bold text-gray-400 hover:text-[#9d4edd] case tracking-wider"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  openTaskModal(undefined, {
                                                    parentTaskId: task.id,
                                                  });
                                                }}
                                                className="text-[10px] font-bold text-gray-400 hover:text-[#9d4edd] case tracking-wider"
                                              >
                                                Add subtask
                                              </button>
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  deleteTask(task.id);
                                                }}
                                                className="text-[10px] font-bold text-gray-400 hover:text-red-500 case tracking-wider"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </td>

                                      {/* 2. START DATE */}
                                      <td className="px-4 py-3 text-xs font-medium text-gray-600 align-top pt-4 text-right">
                                        {formatDateCell(dueDate)}
                                      </td>

                                      {/* 3. END DATE */}
                                      <td className="px-4 py-3 text-xs font-medium text-gray-600 align-top pt-4 text-right">
                                        {formatDateCell(endDate)}
                                      </td>

                                      {/* 4. TIMER BUTTON */}
                                      <td className="px-4 py-3 text-center align-top pt-4">
                                        {statusValue !== "completed" && (
                                          <button
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              if (isSessionRunning) return;
                                              toggleTimer(task);
                                            }}
                                            disabled={isSessionRunning}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all mx-auto ${
                                              isSessionRunning
                                                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                                : task.is_running
                                                  ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
                                                  : "bg-green-100 text-green-600 hover:bg-green-200"
                                            }`}
                                          >
                                            {task.is_running &&
                                            !isSessionRunning ? (
                                              <div className="w-3 h-3 bg-current rounded-sm" />
                                            ) : (
                                              <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-8 border-l-current border-b-[5px] border-b-transparent ml-1" />
                                            )}
                                          </button>
                                        )}
                                      </td>

                                      {/* 5. TIME DISPLAY */}
                                      <td className="px-4 py-3 text-right font-mono text-xs text-[#333333] align-top pt-4">
                                        {formatTime(task)}
                                      </td>

                                      {/* 6. ACTIONS */}
                                      <td className="px-4 py-3 text-right align-top pt-4">
                                        <div className="relative action-menu-trigger inline-flex justify-end z-50">
                                          <button
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setActionMenuId(
                                                actionMenuId === task.id
                                                  ? null
                                                  : task.id,
                                              );
                                            }}
                                            className="text-[#333333] transition-colors"
                                            aria-label="Task actions"
                                          >
                                            <MoreHorizontal size={18} />
                                          </button>

                                          {actionMenuId === task.id && (
                                            <div
                                              className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1"
                                              onClick={(event) =>
                                                event.stopPropagation()
                                              }
                                            >
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  openTaskModal(task);
                                                  setActionMenuId(null);
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs font-bold text-[#333333] hover:bg-gray-50 flex items-center gap-2"
                                              >
                                                <Edit2 size={12} /> Edit
                                              </button>
                                              <div className="px-4 pt-3 pb-2 text-[9px] font-semibold text-gray-400 uppercase tracking-widest border-t border-gray-100">
                                                Move to
                                              </div>
                                              {Object.values(STATUS_CONFIG).map(
                                                (status) => (
                                                  <button
                                                    key={status.id}
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      updateTaskStatus(
                                                        task,
                                                        status.id,
                                                      );
                                                      setActionMenuId(null);
                                                    }}
                                                    className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50 ${
                                                      statusValue === status.id
                                                        ? "text-[#333333]"
                                                        : "text-gray-600"
                                                    }`}
                                                  >
                                                    {status.label}
                                                  </button>
                                                ),
                                              )}
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  deleteTask(task.id);
                                                  setActionMenuId(null);
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                                              >
                                                <Trash2 size={12} /> Delete
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                    {hasSubtasks(task.id) && isExpanded && (
                                      <>
                                        {childTasks.map((child) => {
                                          const childDue =
                                            child.scheduled_start ||
                                            child.due_date;
                                          const childStatusValue =
                                            getTaskStatus(child);
                                          const childEnd =
                                            child.scheduled_end ||
                                            (child.scheduled_start
                                              ? null
                                              : child.due_date);
                                          return (
                                            <tr
                                              key={child.id}
                                              draggable
                                              onDragStart={() => {
                                                setDraggingTaskId(child.id);
                                                setDraggingParentId(
                                                  child.parent_task_id || null,
                                                );
                                              }}
                                              onDragEnd={() => {
                                                setDraggingTaskId(null);
                                                setDraggingParentId(null);
                                                setDropTargetId(null);
                                              }}
                                              onDragOver={(event) => {
                                                if (
                                                  !draggingTaskId ||
                                                  draggingParentId !==
                                                    child.parent_task_id
                                                )
                                                  return;
                                                event.preventDefault();
                                                setDropTargetId(child.id);
                                              }}
                                              onDragLeave={() => {
                                                if (dropTargetId === child.id) {
                                                  setDropTargetId(null);
                                                }
                                              }}
                                              onDrop={(event) => {
                                                if (
                                                  !draggingTaskId ||
                                                  draggingParentId !==
                                                    child.parent_task_id
                                                )
                                                  return;
                                                event.preventDefault();
                                                reorderSubtasks(
                                                  child.parent_task_id || "",
                                                  child.id,
                                                );
                                              }}
                                              className={`relative ${
                                                actionMenuId === child.id
                                                  ? "z-50"
                                                  : "z-0"
                                              } group hover:bg-gray-50 transition-colors ${
                                                childStatusValue ===
                                                "completed"
                                                  ? "bg-gray-50 opacity-60"
                                                  : ""
                                              } ${
                                                dropTargetId === child.id
                                                  ? "bg-purple-50/80 ring-1 ring-purple-100"
                                                  : ""
                                              }`}
                                              onClick={() =>
                                                openTaskModal(child)
                                              }
                                            >
                                              <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 pl-6">
                                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    Subtask
                                                  </span>
                                                  <span
                                                    className={`text-sm font-semibold text-[#333333] ${
                                                      childStatusValue ===
                                                      "completed"
                                                        ? "line-through opacity-50"
                                                        : ""
                                                    }`}
                                                  >
                                                    {child.task_name}
                                                  </span>
                                                </div>
                                                <div className="flex gap-3 mt-1 pl-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      openTaskModal(child);
                                                    }}
                                                    className="text-[10px] font-bold text-gray-400 hover:text-[#9d4edd] case tracking-wider"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      deleteTask(child.id);
                                                    }}
                                                    className="text-[10px] font-bold text-gray-400 hover:text-red-500 case tracking-wider"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-xs font-medium text-gray-600 align-top pt-4 text-right">
                                                {formatDateCell(childDue)}
                                              </td>
                                              <td className="px-4 py-3 text-xs font-medium text-gray-600 align-top pt-4 text-right">
                                                {formatDateCell(childEnd)}
                                              </td>
                                              <td className="px-4 py-3 text-center align-top pt-4">
                                                {childStatusValue !==
                                                  "completed" && (
                                                  <button
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      if (isSessionRunning)
                                                        return;
                                                      toggleTimer(child);
                                                    }}
                                                    disabled={isSessionRunning}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all mx-auto ${
                                                      isSessionRunning
                                                        ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                                                        : child.is_running
                                                          ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
                                                          : "bg-green-100 text-green-600 hover:bg-green-200"
                                                    }`}
                                                  >
                                                    {child.is_running &&
                                                    !isSessionRunning ? (
                                                      <div className="w-3 h-3 bg-current rounded-sm" />
                                                    ) : (
                                                      <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-8 border-l-current border-b-[5px] border-b-transparent ml-1" />
                                                    )}
                                                  </button>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono text-xs text-[#333333] align-top pt-4">
                                                {formatTime(child)}
                                              </td>
                                              <td className="px-4 py-3 text-right align-top pt-4">
                                                <div className="relative action-menu-trigger inline-flex justify-end z-50">
                                                  <button
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      setActionMenuId(
                                                        actionMenuId ===
                                                          child.id
                                                          ? null
                                                          : child.id,
                                                      );
                                                    }}
                                                    className="text-[#333333] transition-colors"
                                                    aria-label="Task actions"
                                                  >
                                                    <MoreHorizontal size={18} />
                                                  </button>

                                                  {actionMenuId === child.id && (
                                                    <div
                                                      className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1"
                                                      onClick={(event) =>
                                                        event.stopPropagation()
                                                      }
                                                    >
                                                      <button
                                                        onClick={(event) => {
                                                          event.stopPropagation();
                                                          openTaskModal(child);
                                                          setActionMenuId(null);
                                                        }}
                                                        className="w-full text-left px-4 py-3 text-xs font-bold text-[#333333] hover:bg-gray-50 flex items-center gap-2"
                                                      >
                                                        <Edit2 size={12} /> Edit
                                                      </button>
                                                      <div className="px-4 pt-3 pb-2 text-[9px] font-semibold text-gray-400 uppercase tracking-widest border-t border-gray-100">
                                                        Move to
                                                      </div>
                                                      {Object.values(
                                                        STATUS_CONFIG,
                                                      ).map((status) => (
                                                        <button
                                                          key={status.id}
                                                          onClick={(event) => {
                                                            event.stopPropagation();
                                                            updateTaskStatus(
                                                              child,
                                                              status.id,
                                                            );
                                                            setActionMenuId(
                                                              null,
                                                            );
                                                          }}
                                                          className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50 ${
                                                            childStatusValue ===
                                                            status.id
                                                              ? "text-[#333333]"
                                                              : "text-gray-600"
                                                          }`}
                                                        >
                                                          {status.label}
                                                        </button>
                                                      ))}
                                                      <button
                                                        onClick={(event) => {
                                                          event.stopPropagation();
                                                          deleteTask(child.id);
                                                          setActionMenuId(null);
                                                        }}
                                                        className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                                                      >
                                                        <Trash2 size={12} />{" "}
                                                        Delete
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
          </div>
        </section>
      )}
      <TaskModal
        key={`${client.id}-${taskModalTask?.id || "new"}-${
          isTaskModalOpen ? "open" : "closed"
        }`}
        isOpen={isTaskModalOpen}
        onClose={handleCloseTaskModal}
        clients={[
          {
            id: client.id,
            business_name: client.business_name,
            surname: client.surname,
          },
        ]}
        lockClient
        task={taskModalTask}
        prefill={{
          clientId: client.id,
          category: "client",
          parentTaskId: taskModalPrefill?.parentTaskId,
        }}
        variant="side"
        onSaved={() => refreshData()}
        onFallbackRefresh={refreshData}
      />

      {/* SERVICE AGREEMENTS SECTION */}
      {activeTab === "docs" && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-gray-50">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDocsOpen((prev) => !prev)}
                className="text-[#333333] hover:text-[#333333] transition-colors"
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    isDocsOpen ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
              <h2 className="text-xl font-bold text-gray-800">
                Documents & Workflows
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <label htmlFor="doc-type-filter">Type</label>
                <select
                  id="doc-type-filter"
                  value={docTypeFilter}
                  onChange={(event) => setDocTypeFilter(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
                >
                  <option value="all">All</option>
                  <option value="proposal">Proposal</option>
                  <option value="booking_form">Booking Form</option>
                  <option value="invoice">Invoice</option>
                  <option value="workflow">Workflows</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <label htmlFor="doc-start">From</label>
                <input
                  id="doc-start"
                  type="date"
                  value={docStartDate}
                  onChange={(event) => setDocStartDate(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <label htmlFor="doc-end">To</label>
                <input
                  id="doc-end"
                  type="date"
                  value={docEndDate}
                  onChange={(event) => setDocEndDate(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
                />
              </div>
              <button
                onClick={() => router.push("/va/dashboard/documents")}
                className="text-sm border border-[#9d4edd] text-[#9d4edd] px-4 py-2 rounded-lg font-bold hover:bg-purple-50 transition-all"
              >
                + New Document
              </button>
              <button
                onClick={() => router.push("/va/dashboard/workflows")}
                className="text-sm bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#7b2cbf] transition-all shadow-sm"
              >
                + New Workflow
              </button>
            </div>
          </div>
          {isDocsOpen && (
            <div className="p-0">
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-100">
                  {/* --- NEW DOCUMENTS LIST --- */}
                  {hasDocuments &&
                    filteredDocuments.map((doc) => {
                      const DocIcon = documentIcon(doc.type);
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-purple-50/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <DocIcon size={18} className="text-[#333333]" />
                              <div>
                                <div className="font-bold text-black">
                                  {doc.title}
                                </div>
                                <div className="text-[10px] text-gray-400 case tracking-widest">
                                  {doc.type.replace("_", " ")}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  doc.status === "draft"
                                    ? "bg-red-500"
                                    : "bg-green-500"
                                }`}
                              />
                              <span className="text-[10px] font-black case text-gray-600">
                                {doc.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end gap-4 items-center">
                            {/* REVOKE LINK: Only shows if NOT a draft */}
                            {doc.status !== "draft" && (
                              <button
                                onClick={() => revokeDocument(doc.id)}
                                className="text-[10px] font-bold text-orange-500 hover:underline case"
                              >
                                Revoke
                              </button>
                            )}

                            <button
                              onClick={() => {
                                const routeSuffix =
                                  doc.type === "proposal"
                                    ? "proposal"
                                    : doc.type === "invoice"
                                      ? "invoice"
                                      : doc.type === "booking_form"
                                        ? "booking_form"
                                        : doc.type === "upload"
                                          ? "upload"
                                          : "";
                                router.push(
                                  routeSuffix
                                    ? `/va/dashboard/documents/edit-${routeSuffix}/${doc.id}`
                                    : `/va/dashboard/documents/edit/${doc.id}`,
                                );
                              }}
                              className="text-xs font-bold text-[#9d4edd] hover:underline"
                            >
                              {doc.status === "draft" ? "Edit & Issue" : "View"}
                            </button>

                            {/* RUBBISH BIN ICON */}
                            <button
                              onClick={() => deleteDocument(doc.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Delete Document"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {hasAgreements &&
                    filteredAgreements.map((ag) => (
                      <tr
                        key={ag.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-black">{ag.title}</div>
                          <div className="text-xs text-gray-500">
                            Updated:{" "}
                            {new Date(ag.last_updated_at).toLocaleDateString(
                              "en-GB",
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {/* TRAFFIC LIGHT STATUS INDICATORS */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                ag.status === "draft"
                                  ? "bg-red-500"
                                  : ag.status === "pending_client"
                                    ? "bg-yellow-400"
                                    : "bg-green-500"
                              }`}
                            />
                            <span className="text-[10px] font-black case tracking-tighter text-gray-600">
                              {ag.status === "draft"
                                ? "Draft"
                                : ag.status === "pending_client"
                                  ? "Issued - Pending"
                                  : "Authorised"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-4 items-center">
                          {/* REVOKE LINK: Only shows if NOT a draft */}
                          {ag.status !== "draft" && (
                            <button
                              onClick={() => revokeAgreement(ag.id)}
                              className="text-[10px] font-bold text-orange-500 hover:underline case"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() =>
                              router.push(
                                `/va/dashboard/workflows/portal-view/${ag.id}`,
                              )
                            }
                            className="text-xs font-bold text-[#9d4edd] hover:underline"
                          >
                            {ag.status === "draft"
                              ? "Review & Issue"
                              : "View Document"}
                          </button>
                          <button
                            onClick={() => deleteAgreement(ag.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Delete Agreement"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
          </div>
          )}
        </section>
      )}

      {/* 4. NOTES (Sticky Bottom) */}
      {activeTab === "notes" && (
        <section
          className={`bg-white rounded-xl shadow-lg border-t-4 border-[#9d4edd] flex flex-col overflow-hidden ${
            isNotesOpen ? "h-96" : "h-auto"
          }`}
        >
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNotesOpen((prev) => !prev)}
              className="text-[#333333] hover:text-[#333333] transition-colors"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  isNotesOpen ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
            <h2 className="text-lg font-bold">Internal Notes</h2>
          </div>
          {isNotesOpen && (
            <div className="p-6 flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-100"
                  >
                    <p className="text-sm text-gray-800">{note.content}</p>
                    <span className="text-[10px] text-gray-400 mt-2 block">
                      {new Date(note.created_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-[#9d4edd] text-black"
                  placeholder="Type a new internal note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                />
                <button
                  onClick={addNote}
                  className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#7b2cbf]"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
