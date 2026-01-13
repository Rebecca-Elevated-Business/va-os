"use client";

import { useState, useEffect, use, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  first_name: string;
  surname: string;
  business_name: string;
  email: string;
  phone: string;
  status: string;
  price_quoted: string;
  work_type: string;
  has_access: boolean;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reusable refresh function for manual actions (saving notes/edits)
  const refreshData = useCallback(async () => {
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();
    if (clientData) setClient(clientData);

    const { data: notesData } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false });
    if (notesData) setNotes(notesData);
  }, [id]);

  // React 19 standard for data fetching in effects
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!active) return;

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) {
        router.push("/va/dashboard/crm");
        return;
      }

      const { data: notesData } = await supabase
        .from("client_notes")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (active) {
        setClient(clientData);
        setNotes(notesData || []);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [id, router]);

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    const { error } = await supabase
      .from("clients")
      .update({
        first_name: client.first_name,
        surname: client.surname,
        business_name: client.business_name,
        email: client.email,
        phone: client.phone,
        status: client.status,
      })
      .eq("id", id);

    if (!error) {
      setIsEditing(false);
      refreshData();
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("client_notes").insert([
      {
        client_id: id,
        va_id: userData.user?.id,
        content: newNote,
      },
    ]);

    if (!error) {
      setNewNote("");
      refreshData();
    }
  };

  if (loading) return <div className="p-10 text-black">Loading Profile...</div>;
  if (!client) return <div className="p-10 text-black">Client not found.</div>;

  return (
    <div className="flex flex-col h-full text-black space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold">
            {client.first_name} {client.surname}
          </h1>
          <p className="text-gray-500">
            {client.business_name || "No Business Name"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="bg-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-black"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancel" : "Edit Details"}
          </button>
          <button className="bg-[#9d4edd] text-white px-4 py-2 rounded-lg font-bold shadow-sm">
            Issue Portal Access
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Info */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">
            Client Information
          </h2>
          {isEditing ? (
            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border p-2 rounded text-black"
                  value={client.first_name}
                  onChange={(e) =>
                    setClient({ ...client, first_name: e.target.value })
                  }
                />
                <input
                  className="border p-2 rounded text-black"
                  value={client.surname}
                  onChange={(e) =>
                    setClient({ ...client, surname: e.target.value })
                  }
                />
              </div>
              <input
                className="w-full border p-2 rounded text-black"
                placeholder="Email"
                value={client.email}
                onChange={(e) =>
                  setClient({ ...client, email: e.target.value })
                }
              />
              <input
                className="w-full border p-2 rounded text-black"
                placeholder="Phone"
                value={client.phone}
                onChange={(e) =>
                  setClient({ ...client, phone: e.target.value })
                }
              />

              <select
                className="w-full border p-2 rounded text-black bg-white"
                value={client.status}
                onChange={(e) =>
                  setClient({ ...client, status: e.target.value })
                }
              >
                <option value="Enquiry">Enquiry</option>
                <option value="Provisional">Provisional</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>

              <button
                type="submit"
                className="w-full bg-[#9d4edd] text-white py-2 rounded font-bold hover:bg-[#7b2cbf]"
              >
                Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p>
                <strong>Email:</strong> {client.email || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {client.phone || "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {client.status}
              </p>
              <p>
                <strong>Work Type:</strong> {client.work_type}
              </p>
              <p>
                <strong>Price Quoted:</strong> {client.price_quoted || "N/A"}
              </p>
            </div>
          )}
        </section>

        {/* Task Manager Placeholder */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">
            Task Manager & Timer
          </h2>
          <div className="bg-purple-50 p-10 rounded-lg border-2 border-dashed border-purple-200 text-center">
            <p className="text-purple-400 font-medium">
              Task tracking module coming soon...
            </p>
          </div>
        </section>
      </div>

      {/* Internal Notes */}
      <section className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-[#9d4edd] flex flex-col h-96">
        <h2 className="text-lg font-bold mb-4 text-black">
          Internal Confidential Notes
        </h2>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 p-3 rounded-lg border border-gray-100"
            >
              <p className="text-sm text-black">{note.content}</p>
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
            className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#7b2cbf] transition-colors"
          >
            Save Note
          </button>
        </div>
      </section>
    </div>
  );
}
