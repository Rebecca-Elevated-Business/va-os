"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import DashboardHeader from "./DashboardHeader";
// Import the clean line icons
import {
  LayoutDashboard,
  ClipboardList,
  Mail,
  Users,
  FileText,
  ShieldCheck,
  LogOut,
} from "lucide-react";

export default function VADashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const checkAccessAndUnread = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/va/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "va") {
      router.push("/client/dashboard");
      return;
    }

    setAuthorized(true);

    const { count } = await supabase
      .from("client_requests")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("is_completed", false);

    setUnreadCount(count || 0);
  }, [router]);

  useEffect(() => {
    const sub = supabase
      .channel("inbox-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_requests" },
        checkAccessAndUnread
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [checkAccessAndUnread]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/va/login");
  };

  // Updated navigation with Title Case and professional icons
  const navItems = [
    { name: "Dashboard", href: "/va/dashboard", icon: LayoutDashboard },
    { name: "Task Centre", href: "/va/dashboard/tasks", icon: ClipboardList },
    { name: "Inbox", href: "/va/dashboard/inbox", icon: Mail },
    { name: "CRM", href: "/va/dashboard/crm", icon: Users },
    { name: "Documents", href: "/va/dashboard/documents", icon: FileText },
    {
      name: "Service Agreements",
      href: "/va/dashboard/agreements",
      icon: ShieldCheck,
    },
  ];

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 italic text-gray-400 font-sans">
        <div className="text-center animate-pulse">
          <p className="text-xl font-black text-[#9d4edd] uppercase tracking-tighter">
            VA-OS
          </p>
          <p className="text-xs font-bold mt-2 uppercase tracking-widest">
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] text-[#333333] font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 shadow-sm">
        {/* Darker divider line under logo */}
        <div className="p-6 border-b border-gray-200 mb-4">
          <h2 className="text-xl font-black text-[#9d4edd] tracking-tighter uppercase">
            VA-OS
          </h2>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-[#9d4edd] text-white shadow-md shadow-purple-100"
                    : "text-[#555555] hover:bg-gray-50 hover:text-black"
                }`}
              >
                {/* Icon logic with subtle grey for inactive items */}
                <Icon
                  size={18}
                  className={isActive ? "text-white" : "text-gray-400"}
                />

                <span className="text-[13.5px] flex-1">{item.name}</span>

                {item.name === "Inbox" && unreadCount > 0 && (
                  <span
                    className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
                      isActive
                        ? "bg-white text-[#9d4edd]"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-400 hover:text-red-600 transition-colors uppercase tracking-widest"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 flex flex-col min-w-0">
        <DashboardHeader />
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
