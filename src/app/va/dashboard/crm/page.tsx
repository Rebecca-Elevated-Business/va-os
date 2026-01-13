"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Client = {
  id: string;
  first_name: string;
  surname: string;
  business_name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  has_access: boolean;
  created_at: string;
};

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // React 19 Best Practice: Define the async function inside the effect
    const loadData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("surname", { ascending: true });

      if (!error && data) {
        setClients(data);
      }
      setLoading(false);
    };

    loadData();
  }, []); // Empty dependency array means this runs once on mount

  const filteredClients = clients.filter((c) =>
    c.surname.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="text-black">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">CRM</h1>
        <Link
          href="/va/dashboard/crm/add"
          className="bg-[#9d4edd] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#7b2cbf] transition-all shadow-md"
        >
          + Add New Client
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by client surname..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Name
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Business
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Email
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Source
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Access
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-400">
                  Loading clients...
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-400">
                  No clients found.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium">
                    {client.first_name} {client.surname}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {client.business_name || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {client.email}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{client.source}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        client.status === "Won"
                          ? "bg-green-100 text-green-700"
                          : client.status === "Lost"
                          ? "bg-red-100 text-red-700"
                          : client.status === "Provisional"
                          ? "bg-purple-100 text-[#9d4edd]"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        client.has_access ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/va/dashboard/crm/profile/${client.id}`}
                      className="text-[#9d4edd] font-semibold text-sm hover:underline"
                    >
                      Open Profile
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
