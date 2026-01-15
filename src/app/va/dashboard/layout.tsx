"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import DashboardHeader from "./DashboardHeader";
import {
  LayoutDashboard,
  ClipboardList,
  Mail,
  Users,
  FileText,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
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
  const [isCollapsed, setIsCollapsed] = useState(false); // New state for collapsing

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

  if (!authorized) return null;

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] text-[#333333] font-sans">
      {/* SIDEBAR - Width changes based on state */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out shadow-sm ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Toggle Button Container */}
        <div className="absolute -right-3 top-24 z-50">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-6 h-6 bg-[#9d4edd] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#7b2cbf] transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronLeft size={14} />
            )}
          </button>
        </div>

        {/* Logo Section */}
        <div
          className={`p-6 border-b border-gray-200 mb-4 h-20 flex items-center ${
            isCollapsed ? "justify-center" : "justify-start"
          }`}
        >
          <h2
            className={`font-black text-[#9d4edd] tracking-tighter uppercase transition-all ${
              isCollapsed ? "text-sm" : "text-xl"
            }`}
          >
            {isCollapsed ? "OS" : "VA-OS"}
          </h2>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-4 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed ? item.name : ""}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-[#9d4edd] text-white shadow-md shadow-purple-100"
                    : "text-[#555555] hover:bg-gray-50 hover:text-black"
                }`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 ${
                    isActive ? "text-white" : "text-gray-400"
                  }`}
                />
                {!isCollapsed && (
                  <span className="text-[13.5px] truncate">{item.name}</span>
                )}

                {item.name === "Inbox" && unreadCount > 0 && (
                  <span
                    className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm shrink-0 ${
                      isActive
                        ? "bg-white text-[#9d4edd]"
                        : "bg-red-500 text-white"
                    } ${isCollapsed ? "absolute top-2 right-4" : ""}`}
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section - Settings replaced Logout */}
        <div className="p-4 border-t border-gray-100">
          <Link
            href="/va/dashboard/settings"
            title={isCollapsed ? "Settings" : ""}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${
              pathname === "/va/dashboard/settings"
                ? "bg-[#9d4edd] text-white"
                : "text-[#555555] hover:bg-gray-50"
            }`}
          >
            <Settings
              size={18}
              className={
                pathname === "/va/dashboard/settings"
                  ? "text-white"
                  : "text-gray-400"
              }
            />
            {!isCollapsed && <span className="text-[13.5px]">Settings</span>}
          </Link>
        </div>
      </aside>

      {/* Main Area - Margin changes based on sidebar width */}
      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        <DashboardHeader />
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
