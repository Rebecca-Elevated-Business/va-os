"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Search,
  User,
  CheckSquare,
  FileText,
  LifeBuoy,
  X,
} from "lucide-react"; // Icons for categories

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

const SUPPORT_OPTIONS = [
  {
    id: "support_request",
    label: "Support Request",
    helper:
      "Need guidance on how to use a specific feature? Tell us what you were trying to do.",
  },
  {
    id: "report_bug",
    label: "Report Bug",
    helper:
      "Something not working as intended? Share steps to reproduce and what you expected.",
  },
  {
    id: "request_feature",
    label: "Request a Feature",
    helper:
      "Have an idea to improve VA-OS? Explain what you want and why it helps.",
  },
];

const SUPPORT_MAX_LENGTH = 280;

export default function DashboardHeader() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportType, setSupportType] = useState(SUPPORT_OPTIONS[0].id);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportStatus, setSupportStatus] = useState<"idle" | "sent">("idle");

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);

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
      if (
        supportRef.current &&
        !supportRef.current.contains(event.target as Node)
      ) {
        setShowSupport(false);
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

  const activeSupportOption =
    SUPPORT_OPTIONS.find((option) => option.id === supportType) ||
    SUPPORT_OPTIONS[0];

  const handleSupportSubmit = async () => {
    if (!user?.id || supportMessage.trim().length < 10) return;
    setSupportSubmitting(true);
    const { error } = await supabase.from("va_support_requests").insert([
      {
        va_id: user.id,
        request_type: supportType,
        message: supportMessage.trim(),
        full_name: user.full_name || null,
        email: user.email || null,
      },
    ]);
    setSupportSubmitting(false);
    if (!error) {
      setSupportStatus("sent");
      setSupportMessage("");
    }
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
        <div className="relative" ref={supportRef}>
          <button
            onClick={() => {
              setShowSupport((prev) => !prev);
              setSupportStatus("idle");
            }}
            className="w-10 h-10 rounded-full bg-[#7b2cbf] flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity shadow-sm"
            title="Reach out"
          >
            <LifeBuoy size={18} />
          </button>

          {showSupport && (
            <div className="absolute right-0 mt-3 w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 animate-in fade-in slide-in-from-top-2 z-50">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-bold text-[#333333] flex items-center gap-2">
                    <LifeBuoy size={16} className="text-[#9d4edd]" />
                    Reach out
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    We will use your account email to follow up.
                  </p>
                </div>
                <button
                  onClick={() => setShowSupport(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close support form"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase block">
                  Category
                </label>
                <select
                  value={supportType}
                  onChange={(event) => setSupportType(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none"
                >
                  {SUPPORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">
                  {activeSupportOption.helper}
                </p>

                <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase block mt-4">
                  Details
                </label>
                <textarea
                  value={supportMessage}
                  onChange={(event) =>
                    setSupportMessage(event.target.value.slice(0, SUPPORT_MAX_LENGTH))
                  }
                  maxLength={SUPPORT_MAX_LENGTH}
                  placeholder="Keep it brief and specific..."
                  className="w-full min-h-[120px] rounded-xl border border-gray-200 p-3 text-sm text-[#333333] focus:ring-2 focus:ring-[#9d4edd] outline-none resize-none"
                />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {supportMessage.length}/{SUPPORT_MAX_LENGTH}
                  </span>
                  {supportStatus === "sent" && (
                    <span className="text-emerald-500 font-semibold">
                      Sent - thank you
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSupportSubmit}
                  disabled={
                    supportSubmitting || supportMessage.trim().length < 10
                  }
                  className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                    supportSubmitting || supportMessage.trim().length < 10
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-[#9d4edd] text-white hover:bg-[#7b2cbf]"
                  }`}
                >
                  {supportSubmitting ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>

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
