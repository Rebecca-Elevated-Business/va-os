"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// --- TYPES ---
type ClientProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  notes: string;
  status: string;
};

type Task = {
  id: string;
  title: string;
  is_complete: boolean;
  client_id: string;
};

type Agreement = {
  id: string;
  title: string;
  status: string;
  last_updated_at: string;
};

type ClientDocument = {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
};

type ClientRequest = {
  id: string;
  created_at: string;
  type: "work" | "meeting";
  message: string;
  status: "new" | "read" | "actioned" | "archived";
  is_hidden: boolean;
};

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // --- STATE ---
  const [loading, setLoading] = useState(true);

  // Client Data
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [notes, setNotes] = useState("");

  // Task Manager Data
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  // Agreements & Docs Data
  const [clientAgreements, setClientAgreements] = useState<Agreement[]>([]);
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);

  // Communication Feed Data
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [showHiddenRequests, setShowHiddenRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(
    null
  );

  // --- INITIAL LOAD ---
  useEffect(() => {
    async function loadAllData() {
      // 1. Client Profile
      const { data: cData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();
      if (cData) {
        setClient(cData);
        setNotes(cData.notes || "");
      }

      // 2. Tasks
      const { data: tData } = await supabase
        .from("todos")
        .select("*")
        .eq("client_id", id)
        .order("inserted_at", { ascending: false });
      if (tData) setClientTasks(tData as Task[]);

      // 3. Agreements
      const { data: agData } = await supabase
        .from("client_agreements")
        .select("id, title, status, last_updated_at")
        .eq("client_id", id)
        .order("last_updated_at", { ascending: false });
      if (agData) setClientAgreements(agData as Agreement[]);

      // 4. Documents
      const { data: docData } = await supabase
        .from("client_documents")
        .select("id, title, type, status, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (docData) setClientDocuments(docData as ClientDocument[]);

      // 5. Client Requests (Feed)
      const { data: reqData } = await supabase
        .from("client_requests")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (reqData) setRequests(reqData as ClientRequest[]);

      setLoading(false);
    }
    loadAllData();
  }, [id]);

  // --- HANDLERS: NOTES ---
  const handleUpdateNotes = async () => {
    const { error } = await supabase
      .from("clients")
      .update({ notes })
      .eq("id", id);
    if (!error) alert("Internal notes saved.");
  };

  // --- HANDLERS: TASK MANAGER ---
  const handleAddTask = async (e?: React.FormEvent, taskTitle?: string) => {
    if (e) e.preventDefault();
    const titleToUse = taskTitle || newTask;
    if (!titleToUse.trim()) return;

    const { data, error } = await supabase
      .from("todos")
      .insert([{ title: titleToUse, client_id: id, is_complete: false }])
      .select()
      .single();

    if (!error && data) {
      setClientTasks([data, ...clientTasks]);
      if (!taskTitle) setNewTask(""); // Only clear input if typed manually
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
    // Optimistic Update
    setClientTasks(
      clientTasks.map((t) =>
        t.id === taskId ? { ...t, is_complete: !currentStatus } : t
      )
    );
    await supabase
      .from("todos")
      .update({ is_complete: !currentStatus })
      .eq("id", taskId);
  };

  const deleteTask = async (taskId: string) => {
    setClientTasks(clientTasks.filter((t) => t.id !== taskId));
    await supabase.from("todos").delete().eq("id", taskId);
  };

  const calculateProgress = () => {
    if (clientTasks.length === 0) return 0;
    const completed = clientTasks.filter((t) => t.is_complete).length;
    return Math.round((completed / clientTasks.length) * 100);
  };

  // --- HANDLERS: AGREEMENTS & DOCS ---
  const deleteAgreement = async (agreementId: string) => {
    if (!confirm("Delete this agreement?")) return;
    const { error } = await supabase
      .from("client_agreements")
      .delete()
      .eq("id", agreementId);
    if (!error)
      setClientAgreements(clientAgreements.filter((a) => a.id !== agreementId));
  };

  // --- HANDLERS: REQUESTS (FEED) ---
  const handleOpenRequest = async (req: ClientRequest) => {
    setSelectedRequest(req);
    if (req.status === "new") {
      await supabase
        .from("client_requests")
        .update({ status: "read" })
        .eq("id", req.id);
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: "read" } : r))
      );
    }
  };

  const handleToggleHideRequest = async (
    reqId: string,
    currentHidden: boolean
  ) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqId ? { ...r, is_hidden: !currentHidden } : r
      )
    );
    await supabase
      .from("client_requests")
      .update({ is_hidden: !currentHidden })
      .eq("id", reqId);
  };

  const handleConvertToTask = async () => {
    if (!selectedRequest) return;

    // 1. Create the Task automatically
    await handleAddTask(undefined, `From Request: ${selectedRequest.message}`);

    // 2. Mark request as Actioned
    const { error } = await supabase
      .from("client_requests")
      .update({ status: "actioned" })
      .eq("id", selectedRequest.id);

    if (!error) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id ? { ...r, status: "actioned" } : r
        )
      );
      setSelectedRequest(null);
      alert("Request converted to Task successfully!");
    }
  };

  const handleReplyEmail = () => {
    if (!client || !selectedRequest) return;
    const subject = `Re: ${
      selectedRequest.type === "work" ? "Work Request" : "Meeting"
    } - ${new Date(selectedRequest.created_at).toLocaleDateString("en-GB")}`;
    const body = `\n\nOriginal Message:\n> ${selectedRequest.message}`;
    window.open(
      `mailto:${client.email}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`
    );
  };

  if (loading)
    return <div className="p-10 text-gray-500">Loading Profile...</div>;
  if (!client)
    return <div className="p-10 text-gray-500">Client not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      {/* 1. HEADER */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-gray-500">{client.company_name}</p>
        </div>
        <button
          onClick={() =>
            router.push(`/va/dashboard/documents/create?clientId=${id}`)
          }
          className="text-sm bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#7b2cbf] transition-all shadow-md"
        >
          + Create Document
        </button>
      </div>

      {/* 2. INFO CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase">
            Contact Email
          </p>
          <p className="text-gray-900 font-medium break-all">{client.email}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase">Phone</p>
          <p className="text-gray-900 font-medium">
            {client.phone || "No phone listed"}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase">Status</p>
          <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">
            {client.status}
          </span>
        </div>
      </div>

      {/* 3. SPLIT LAYOUT: TASKS (75%) & FEED (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
        {/* LEFT: TASK MANAGER (75%) */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-800">Task Manager</h2>
              <p className="text-xs text-gray-500">
                {calculateProgress()}% Complete
              </p>
            </div>
            {/* Progress Bar */}
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#9d4edd] transition-all duration-500"
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
          </div>

          <div className="p-6">
            {/* Add Task Input */}
            <form onSubmit={handleAddTask} className="flex gap-4 mb-8">
              <input
                type="text"
                placeholder="Add a new task..."
                className="flex-1 border border-gray-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-purple-100 bg-gray-50"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newTask.trim()}
                className="bg-[#9d4edd] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#7b2cbf] disabled:opacity-50 transition-all"
              >
                Add Task
              </button>
            </form>

            {/* Task List */}
            <div className="space-y-3">
              {clientTasks.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic">
                  No tasks active. Add one to get started.
                </div>
              ) : (
                clientTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                      task.is_complete
                        ? "bg-gray-50 border-gray-100 opacity-60"
                        : "bg-white border-gray-200 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() =>
                          toggleTaskStatus(task.id, task.is_complete)
                        }
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.is_complete
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-[#9d4edd]"
                        }`}
                      >
                        {task.is_complete && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </button>
                      <span
                        className={`font-medium ${
                          task.is_complete
                            ? "line-through text-gray-400"
                            : "text-gray-800"
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: CLIENT FEED (25%) */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-150">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="font-bold text-sm text-gray-800">Client Feed</h2>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="w-3 h-3 rounded border-gray-300"
                checked={showHiddenRequests}
                onChange={(e) => setShowHiddenRequests(e.target.checked)}
              />
              <span className="text-[10px] text-gray-500 uppercase font-bold">
                Show All
              </span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-0 divide-y divide-gray-100 custom-scrollbar">
            {requests.filter((r) => showHiddenRequests || !r.is_hidden)
              .length === 0 ? (
              <div className="p-6 text-center text-gray-300 text-xs italic flex flex-col items-center justify-center h-full">
                <span className="text-2xl mb-2">📭</span>
                No active messages
              </div>
            ) : (
              requests
                .filter((r) => showHiddenRequests || !r.is_hidden)
                .map((req) => (
                  <div
                    key={req.id}
                    className={`p-3 hover:bg-purple-50 transition-colors cursor-pointer group relative ${
                      req.status === "new" ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <div
                      className="flex justify-between items-start mb-1"
                      onClick={() => handleOpenRequest(req)}
                    >
                      <span
                        className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                          req.type === "work"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {req.type}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(req.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>

                    {/* Truncated Message */}
                    <p
                      onClick={() => handleOpenRequest(req)}
                      className={`text-xs line-clamp-3 leading-snug mb-2 ${
                        req.status === "new"
                          ? "font-bold text-black"
                          : "text-gray-500"
                      }`}
                    >
                      {req.message}
                    </p>

                    {/* Hide Checkbox (Only appears on hover) */}
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleHideRequest(req.id, req.is_hidden);
                        }}
                        className="text-[10px] text-gray-400 hover:text-red-500 underline"
                      >
                        {req.is_hidden ? "Unhide" : "Hide"}
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* 4. DOCUMENTS & AGREEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* DOCUMENTS LIST */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-800">Documents</h2>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-gray-100">
              {clientDocuments.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-400 italic">
                    No documents.
                  </td>
                </tr>
              ) : (
                clientDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-black">
                      {doc.title}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                          doc.status === "paid" || doc.status === "signed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() =>
                          router.push(`/va/dashboard/documents/edit/${doc.id}`)
                        }
                        className="text-[#9d4edd] font-bold text-xs hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* AGREEMENTS LIST */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between">
            <h2 className="font-bold text-gray-800">Agreements</h2>
            <button
              onClick={() => router.push("/va/dashboard/agreements")}
              className="text-xs font-bold text-[#9d4edd]"
            >
              + New
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-gray-100">
              {clientAgreements.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-400 italic">
                    No agreements.
                  </td>
                </tr>
              ) : (
                clientAgreements.map((ag) => (
                  <tr key={ag.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-black">
                      {ag.title}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          ag.status === "active"
                            ? "bg-green-500"
                            : ag.status === "pending_client"
                            ? "bg-yellow-400"
                            : "bg-red-500"
                        }`}
                      ></div>
                    </td>
                    <td className="px-6 py-3 text-right flex justify-end gap-3">
                      <button
                        onClick={() =>
                          router.push(
                            `/va/dashboard/agreements/portal-view/${ag.id}`
                          )
                        }
                        className="text-[#9d4edd] font-bold text-xs hover:underline"
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteAgreement(ag.id)}
                        className="text-gray-300 hover:text-red-500"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. INTERNAL NOTES (Full Width) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-800">Internal Notes</h2>
          <button
            onClick={handleUpdateNotes}
            className="text-xs font-bold text-[#9d4edd] hover:underline"
          >
            Save Notes
          </button>
        </div>
        <textarea
          className="w-full h-48 p-4 border border-gray-200 rounded-lg bg-yellow-50/50 text-sm leading-relaxed focus:ring-2 focus:ring-yellow-200 outline-none resize-none text-black"
          placeholder="Type your internal notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* 6. MODAL OVERLAY (Communication) */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div
              className={`p-6 border-b flex justify-between items-center ${
                selectedRequest.type === "work" ? "bg-green-50" : "bg-blue-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                    selectedRequest.type === "work"
                      ? "bg-green-100 text-green-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {selectedRequest.type === "work" ? "💼" : "📅"}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 capitalize">
                    {selectedRequest.type} Request
                  </h3>
                  <p className="text-xs text-gray-500">
                    Sent:{" "}
                    {new Date(selectedRequest.created_at).toLocaleString(
                      "en-GB"
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-8 h-8 rounded-full bg-white text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors font-bold shadow-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
                {selectedRequest.message}
              </p>
            </div>

            {/* Modal Footer (Actions) */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={handleReplyEmail}
                className="text-gray-600 hover:text-black font-bold text-sm flex items-center gap-2"
              >
                Reply via Email
              </button>

              <button
                onClick={handleConvertToTask}
                disabled={selectedRequest.status === "actioned"}
                className={`px-6 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2 ${
                  selectedRequest.status === "actioned"
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                }`}
              >
                {selectedRequest.status === "actioned"
                  ? "✓ Actioned"
                  : "Convert to Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
