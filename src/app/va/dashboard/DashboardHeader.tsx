"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search, User, CheckSquare, FileText } from "lucide-react"; // Icons for categories

type UserProfile = {
  id?: string;
  email?: string;
  full_name?: string;
};

type SearchResult = {
  id: string;
  title: string;
  type: "client" | "task" | "document";
  subtitle?: string;
};

export default function DashboardHeader() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- SEARCH LOGIC ---
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. Search Clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, surname, business_name")
        .or(
          `surname.ilike.%${searchQuery}%,business_name.ilike.%${searchQuery}%`
        )
        .limit(3);

      // 2. Search Tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, task_name")
        .ilike("task_name", `%${searchQuery}%`)
        .limit(3);

      // 3. Search Documents
      const { data: docs } = await supabase
        .from("client_documents")
        .select("id, title, type")
        .ilike("title", `%${searchQuery}%`)
        .limit(3);

      // Combine Results
      const combined: SearchResult[] = [
        ...(clients?.map((c) => ({
          id: c.id,
          title: `${c.first_name} ${c.surname}`,
          type: "client" as const,
          subtitle: c.business_name,
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

  // --- UI HANDLERS ---
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
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery("");
    if (result.type === "client")
      router.push(`/va/dashboard/crm/profile/${result.id}`);
    if (result.type === "task") router.push(`/va/dashboard/tasks`); // Deep link if needed later
    if (result.type === "document")
      router.push(`/va/dashboard/documents/edit/${result.id}`);
  };

  // (Keep your existing getUser and handleSignOut logic here...)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/va/login");
  };

  const getInitials = () => {
    if (!user) return "VA";
    if (user.full_name) {
      const names = user.full_name.split(" ");
      if (names.length >= 2)
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      return names[0].substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || "VA";
  };

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-20">
      {/* 1. SEARCH BAR WITH DROPDOWN */}
      <div className="relative w-full max-w-md group" ref={searchRef}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search
            size={18}
            className="text-gray-400 group-focus-within:text-[#9d4edd] transition-colors"
          />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-[#9d4edd] transition-all text-black"
          placeholder="Search for clients, tasks, or documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
        />

        {/* SEARCH RESULTS DROPDOWN */}
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
                  <p className="text-sm font-bold text-[#333333]">
                    {result.title}
                  </p>
                  {result.subtitle && (
                    <p className="text-[10px] text-gray-400 uppercase font-medium">
                      {result.subtitle}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. ICONS CONTAINER (Right side) */}
      <div className="flex items-center gap-4">
        <a
          href="https://google.com"
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
