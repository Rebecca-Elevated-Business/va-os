"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Filter } from "lucide-react";

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
  portal_invite_link?: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ["Enquiry", "Provisional", "Won", "Lost", "Paused"];

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusFilterRef.current &&
        !statusFilterRef.current.contains(event.target as Node)
      ) {
        setIsStatusFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

          {/* Status Filter Dropdown */}
          <div className="relative" ref={statusFilterRef}>
            <button
              onClick={() => setIsStatusFilterOpen((prev) => !prev)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm text-[#333333]"
            >
              <Filter size={14} className="text-gray-400" />
              Filter by Status
            </button>

            {isStatusFilterOpen && (
              <div className="absolute left-0 mt-2 w-60 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black text-[#333333] tracking-widest mb-3 ml-1">
                  Visible Statuses
                </p>
                <div className="space-y-1">
                  {STATUS_OPTIONS.map((status) => (
                    <label
                      key={status}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="w-4 h-4 rounded border-gray-300 text-[#9d4edd] focus:ring-[#9d4edd]"
                        />
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-gray-600 border border-gray-200 bg-white">
                          {status}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedStatuses.length > 0 && (
                  <button
                    onClick={() => setSelectedStatuses([])}
                    className="mt-3 text-[10px] font-bold text-red-500 hover:underline ml-1"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
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
                Phone
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                Portal Access
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-right">
                Access
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
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {client.phone || "-"}
                  </td>
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
                    {(() => {
                      const issued = Boolean(
                        client.portal_access_enabled ||
                          client.portal_invite_link?.trim(),
                      );
                      const accessed = Boolean(client.has_access);
                      const dotClass = accessed
                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                        : issued
                          ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.45)]"
                          : "bg-gray-300";
                      return (
                        <div
                          className={`w-2.5 h-2.5 rounded-full mx-auto ${dotClass}`}
                        />
                      );
                    })()}
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
