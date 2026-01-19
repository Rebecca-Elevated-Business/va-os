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
  portal_access_enabled?: boolean | null;
  created_at: string;
};

const STATUS_OPTIONS = ["Enquiry", "Provisional", "Won", "Lost", "Paused"];

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  // Filter Logic: Handles both Search and Multi-select Status
  const filteredClients = clients.filter((c) => {
    const matchesSearch = c.surname
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(c.status);

    return matchesSearch && matchesStatus;
  });

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search Box with Clear */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search by surname..."
              className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="ml-2 text-xs font-bold text-[#9d4edd] hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="hidden md:block w-px h-8 bg-gray-200 mx-2"></div>

          {/* Status Multi-select Chips */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 mr-2">
              Filter Status:
            </span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                  selectedStatuses.includes(status)
                    ? "bg-[#9d4edd] border-[#9d4edd] text-white shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-[#9d4edd]"
                }`}
              >
                {status}
              </button>
            ))}

            {selectedStatuses.length > 0 && (
              <button
                onClick={() => setSelectedStatuses([])}
                className="ml-2 text-xs font-bold text-red-500 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-black">
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
              <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-right">
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
                <td
                  colSpan={7}
                  className="px-6 py-4 text-center text-gray-400 p-8"
                >
                  No clients match your filters.
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
                      className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-black ${
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
                  <td className="px-6 py-4 text-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mx-auto ${
                        client.portal_access_enabled ?? client.has_access
                          ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                          : "bg-gray-300"
                      }`}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/va/dashboard/crm/profile/${client.id}`}
                      className="text-[#9d4edd] font-bold text-sm hover:text-[#7b2cbf] bg-purple-50 px-3 py-1.5 rounded-md transition-colors"
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
