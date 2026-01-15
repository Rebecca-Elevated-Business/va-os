"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UserProfile = {
  id?: string;
  email?: string;
  first_name?: string;
  surname?: string;
  full_name?: string; // <--- ADD THIS
};

export default function DashboardHeader() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
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

  // Fetch User Data
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Try to get profile details if available, otherwise just use auth user
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

  // Helper to get initials
  const getInitials = () => {
    if (!user) return "VA";

    // Check for VA "full_name" first
    if (user.full_name) {
      const names = user.full_name.split(" ");
      if (names.length >= 2)
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      return names[0].substring(0, 2).toUpperCase();
    }

    // Fallback to Client "first_name" / "surname"
    if (user.first_name && user.surname) {
      return `${user.first_name[0]}${user.surname[0]}`.toUpperCase();
    }

    return user.email?.substring(0, 2).toUpperCase() || "VA";
  };

  const getFullName = () => {
    if (user?.full_name) return user.full_name; // <--- The Fix
    if (user?.first_name && user?.surname)
      return `${user.first_name} ${user.surname}`;
    return "Admin Account";
  };

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-end px-8 gap-4 sticky top-0 z-20">
      {/* 1. SUPPORT ICON (Darker Purple #7b2cbf) */}
      <a
        href="https://google.com"
        target="_blank"
        rel="noreferrer"
        className="w-10 h-10 rounded-full bg-[#7b2cbf] flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity shadow-sm"
        title="Support"
      >
        ?
      </a>

      {/* 2. PROFILE DROPDOWN CONTAINER */}
      <div className="relative" ref={dropdownRef}>
        {/* AVATAR BUTTON (Standard Purple #9d4edd) */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-10 h-10 rounded-full bg-[#9d4edd] flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity shadow-sm"
        >
          {getInitials()}
        </button>

        {/* DROPDOWN MENU */}
        {showDropdown && (
          <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="mb-4 pb-4 border-b border-gray-50">
              <p className="font-bold text-gray-800 text-sm mb-1">
                {getFullName()}
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
    </header>
  );
}
