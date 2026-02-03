"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import DashboardHeader from "./DashboardHeader";
import { ClientSessionProvider } from "./ClientSessionContext";
import ImpersonationBanner from "@/components/ImpersonationBanner";
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
  Timer,
  BookOpen,
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const checkAccessAndUnread = useCallback(async () => {
    try {
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

      const { data: clientRows } = await supabase
        .from("clients")
        .select("id")
        .eq("va_id", session.user.id);

      const clientIds = (clientRows || []).map((row) => row.id);

      if (clientIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from("client_requests")
        .select("id", { count: "exact", head: true })
        .in("client_id", clientIds)
        .eq("is_read", false)
        .eq("is_completed", false);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error("Dashboard Access Error:", error);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAccessAndUnread();
    }, 0);

    const sub = supabase
      .channel("inbox-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_requests" },
        checkAccessAndUnread,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(sub);
    };
  }, [checkAccessAndUnread]);

  const navItems = [
    { name: "Dashboard", href: "/va/dashboard", icon: LayoutDashboard },
    { name: "Task Centre", href: "/va/dashboard/tasks", icon: ClipboardList },
    { name: "Time Tracking", href: "/va/dashboard/time-tracking", icon: Timer },
    { name: "Inbox", href: "/va/dashboard/inbox", icon: Mail },
    { name: "CRM", href: "/va/dashboard/crm", icon: Users },
    { name: "Documents", href: "/va/dashboard/documents", icon: FileText },
    {
      name: "Workflows",
      href: "/va/dashboard/workflows",
      icon: ShieldCheck,
    },
    { name: "Tutorials", href: "/va/dashboard/tutorials", icon: BookOpen },
  ];

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfcfc] font-sans">
        <div className="text-center animate-pulse">
          <p className="text-xl font-black text-[#9d4edd] uppercase tracking-tighter">
            VA-OS
          </p>
          <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fcfcfc] text-[#333333] font-sans print:block print:bg-white">
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out shadow-sm print:hidden ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
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

                {item.name === "Inbox" && unreadCount > 0 && !isCollapsed && (
                  <span
                    className={`ml-auto text-[12px] font-semibold shrink-0 ${
                      isActive ? "text-white" : "text-[#555555]"
                    }`}
                  >
                    ({unreadCount})
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 relative">
          <div className="absolute -right-3 -top-3 z-50">
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

      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 print:ml-0 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        <ImpersonationBanner />
        <ClientSessionProvider>
          <DashboardHeader />
          <div className="p-8 print:p-0">{children}</div>
        </ClientSessionProvider>
      </main>
    </div>
  );
}
