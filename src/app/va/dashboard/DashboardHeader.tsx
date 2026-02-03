"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search, User, CheckSquare, FileText, Timer } from "lucide-react";
import { useClientSession } from "./ClientSessionContext";

type UserProfile = {
  id?: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
};

type SearchResult = {
  id: string;
  title: string;
  type: "client" | "task" | "document";
  subtitle?: string;
};

type ClientOption = {
  id: string;
  business_name: string | null;
  first_name: string | null;
  surname: string | null;
};

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

const formatClientName = (client: ClientOption) =>
  `${client.first_name || ""} ${client.surname || ""}`.trim();

const formatClientLabel = (client: ClientOption) => {
  const name = formatClientName(client);
  if (client.business_name) {
    return name ? `${name} (${client.business_name})` : client.business_name;
  }
  return name || "Unnamed Client";
};

export default function DashboardHeader() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientResults, setShowClientResults] = useState(false);
  const [isClientFocused, setIsClientFocused] = useState(false);

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  const {
    activeClientId,
    activeSession,
    isRunning,
    isLoading,
    sessionElapsedSeconds,
    startSession,
    stopSession,
  } = useClientSession();

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .or(
          `first_name.ilike.%${searchQuery}%,surname.ilike.%${searchQuery}%,business_name.ilike.%${searchQuery}%`
        )
        .limit(3);

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, task_name")
        .ilike("task_name", `%${searchQuery}%`)
        .is("deleted_at", null)
        .limit(3);

      const { data: docs } = await supabase
        .from("client_documents")
        .select("id, title, type")
        .ilike("title", `%${searchQuery}%`)
        .limit(3);

      const combined: SearchResult[] = [
        ...(clients?.map((c) => ({
          id: c.id,
          title: `${c.first_name || ""} ${c.surname || ""}`.trim(),
          type: "client" as const,
          subtitle: c.business_name || undefined,
        })) || []),
        ...(tasks?.map((t) => ({
          id: t.id,
          title: t.task_name,
          type: "task" as const,
        })) || []),
        ...(docs?.map((d) => ({
          id: d.id,
          title: d.title,
          type: "document" as const,
          subtitle: d.type.replace("_", " "),
        })) || []),
      ];

      setResults(combined);
      setShowResults(true);
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        clientRef.current &&
        !clientRef.current.contains(event.target as Node)
      ) {
        setShowClientResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");
    if (result.type === "client")
      router.push(`/va/dashboard/crm/profile/${result.id}`);
    if (result.type === "task") router.push(`/va/dashboard/tasks`);
    if (result.type === "document") {
      const docType = result.subtitle?.replace(" ", "_");
      const routeSuffix =
        docType === "proposal"
          ? "proposal"
          : docType === "invoice"
          ? "invoice"
          : docType === "booking_form"
          ? "booking_form"
          : docType === "upload"
          ? "upload"
          : "";
      router.push(
        routeSuffix
          ? `/va/dashboard/documents/edit-${routeSuffix}/${result.id}`
          : `/va/dashboard/documents/edit/${result.id}`
      );
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUser({ ...user, ...profile });
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    const loadClients = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .eq("va_id", user.id)
        .order("surname", { ascending: true });
      setClients((data as ClientOption[]) || []);
    };
    loadClients();
  }, []);

  const activeClientLabel = useMemo(() => {
    if (!activeClientId) return "";
    const activeClient = clients.find((client) => client.id === activeClientId);
    if (!activeClient) return "";
    return formatClientLabel(activeClient);
  }, [activeClientId, clients]);

  const clientInputValue = isClientFocused
    ? clientQuery
    : clientQuery || activeClientLabel;

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return [];
    return clients.filter((client) =>
      `${client.first_name || ""} ${client.surname || ""} ${
        client.business_name || ""
      }`
        .toLowerCase()
        .includes(query),
    );
  }, [clientQuery, clients]);

  const handleSelectClient = (client: ClientOption) => {
    setSelectedClientId(client.id);
    setClientQuery(formatClientLabel(client));
    setShowClientResults(false);
    setIsClientFocused(false);
  };

  const handleToggleClientSession = async () => {
    if (isLoading) return;
    if (isRunning && activeSession) {
      if (selectedClientId && selectedClientId !== activeClientId) {
        await startSession(selectedClientId);
        return;
      }
      await stopSession();
      return;
    }
    if (!selectedClientId) return;
    await startSession(selectedClientId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/va/login");
  };

  const getInitials = () => {
    if (!user) return "VA";
    const assembledName =
      user.first_name || user.last_name
        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
        : user.full_name;

    if (assembledName) {
      const names = assembledName.split(" ");
      if (names.length >= 2)
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      return names[0].substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || "VA";
  };

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-20 print:hidden">
      
      <div className="relative w-full max-w-md group" ref={searchRef}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search
            size={18}
            className="text-[#9d4edd] transition-colors"
          />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-[#707070] rounded-2xl text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-[#707070] transition-all text-black"
          placeholder="Search for clients, tasks, or documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
        />

        
        {showResults && results.length > 0 && (
          <div className="absolute w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in slide-in-from-top-2">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#9d4edd]">
                  {result.type === "client" && <User size={16} />}
                  {result.type === "task" && <CheckSquare size={16} />}
                  {result.type === "document" && <FileText size={16} />}
                </div>
                <div>
                  {result.type === "client" ? (
                    <p className="text-sm font-bold text-[#333333]">
                      {result.title || "Unnamed Client"}
                      {result.subtitle && (
                        <span className="font-semibold text-[#525252]">
                          {" "}
                          ({result.subtitle})
                        </span>
                      )}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[#333333]">
                        {result.title}
                      </p>
                      {result.subtitle && (
                        <p className="text-[10px] text-gray-400 uppercase font-medium">
                          {result.subtitle}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      
      <div className="flex items-center gap-4">
        <div
          className="hidden lg:flex items-center gap-3 border border-gray-100 rounded-2xl px-3 py-2 bg-white shadow-sm"
          ref={clientRef}
        >
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-[#9d4edd]" />
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Client Session
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Select client"
              className="w-48 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={clientInputValue}
              onChange={(event) => {
                const value = event.target.value;
                setClientQuery(value);
                setShowClientResults(value.trim().length > 0);
                if (!value) setSelectedClientId(null);
              }}
              onFocus={() => {
                setIsClientFocused(true);
                setShowClientResults(clientQuery.trim().length > 0);
              }}
              onBlur={() => {
                if (!clientQuery.trim()) {
                  setIsClientFocused(false);
                }
              }}
            />
            {showClientResults && clientQuery.trim().length > 0 && (
              <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-100 bg-white shadow-xl max-h-60 overflow-auto">
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    No clients found.
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#333333] hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-[#333333]">
                        {formatClientName(client) || "Unnamed Client"}
                      </span>
                      {client.business_name && (
                        <span className="text-[#525252]">
                          {" "}
                          ({client.business_name})
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleToggleClientSession}
            disabled={isLoading || (!selectedClientId && !isRunning)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              isRunning
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
            } ${isLoading || (!selectedClientId && !isRunning) ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {isRunning && selectedClientId && selectedClientId !== activeClientId
              ? "Switch"
              : isRunning
                ? "Stop"
                : "Start"}
          </button>
          <div className="font-mono text-xs text-[#333333] tracking-wide">
            {formatHms(sessionElapsedSeconds)}
          </div>
        </div>
        <a
          href="https://elevatedbusiness.co.uk/va-os/ticket"
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full bg-[#7b2cbf] flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity shadow-sm"
          title="Support"
        >
          ?
        </a>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-10 h-10 rounded-full bg-[#9d4edd] flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            {getInitials()}
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-5 animate-in fade-in slide-in-from-top-2">
              <div className="mb-4 pb-4 border-b border-gray-50">
                <p className="font-bold text-gray-800 text-sm mb-1">
                  {user?.full_name || "Valued Admin"}
                </p>
                <p className="text-xs text-gray-400 wrap-break-word">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-2 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
