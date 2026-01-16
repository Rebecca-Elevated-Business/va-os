"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react"; // Professional magnifying glass icon

type UserProfile = {
  id?: string;
  email?: string;
  first_name?: string;
  surname?: string;
  full_name?: string;
};

export default function DashboardHeader() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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

  // Fetch User Data for the Profile Circle
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
      {/* 1. GLOBAL SEARCH BAR (Top Left) */}
      <div className="relative w-full max-w-md group">
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
        />
      </div>

      {/* 2. ICONS CONTAINER (Top Right) */}
      <div className="flex items-center gap-4">
        {/* Support Link (Darker Purple) */}
        <a
          href="https://google.com"
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full bg-[#7b2cbf] flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity shadow-sm"
          title="Support"
        >
          ?
        </a>

        {/* Profile Circle Dropdown (Standard Purple) */}
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
