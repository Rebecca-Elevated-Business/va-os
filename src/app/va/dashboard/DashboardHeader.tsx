"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation"; // Added usePathname

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
  const router = useRouter();
  const pathname = usePathname(); // Get current URL
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Logic to determine the Page Title based on the URL
  const getPageTitle = () => {
    if (pathname === "/va/dashboard") return "Dashboard";
    if (pathname.includes("/tasks")) return "Task Centre";
    if (pathname.includes("/inbox")) return "Inbox";
    if (pathname.includes("/crm")) return "CRM";
    if (pathname.includes("/documents")) return "Documents";
    if (pathname.includes("/agreements")) return "Service Agreements";
    if (pathname.includes("/settings")) return "Settings";
    return "Overview";
  };

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
    // Changed justify-end to justify-between
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-20">
      {/* 1. PAGE TITLE (Top Left) */}
      <h2 className="text-sm font-bold text-[#333333] uppercase tracking-widest">
        {getPageTitle()}
      </h2>

      {/* 2. ICONS CONTAINER (Top Right) */}
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
                className="w-full text-left px-2 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg transition-colors"
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
