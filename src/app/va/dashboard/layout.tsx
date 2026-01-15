"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";

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
        {
          event: "*",
          schema: "public",
          table: "client_requests",
        },
        () => {
          checkAccessAndUnread();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          checkAccessAndUnread();
        }
      });

    return () => {
      supabase.removeChannel(sub);
    };
  }, [checkAccessAndUnread]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/va/login");
  };

  const navItems = [
    { name: "Overview", href: "/va/dashboard" },
    { name: "Task Centre", href: "/va/dashboard/tasks" },
    { name: "Inbox", href: "/va/dashboard/inbox" },
    { name: "CRM", href: "/va/dashboard/crm" },
    { name: "Documents", href: "/va/dashboard/documents" },
    { name: "Service Agreements", href: "/va/dashboard/agreements" },
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
    <div className="flex min-h-screen bg-gray-50 text-black font-sans">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-black text-[#9d4edd] tracking-tighter uppercase">
            VA-OS
          </h2>
        </div>

        <nav className="flex-1 p-4 space-y-2 text-black">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-4 py-2 rounded-xl font-bold transition-all ${
                pathname === item.href
                  ? "bg-purple-50 text-[#9d4edd] shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-[#9d4edd]"
              }`}
            >
              <span className="text-sm uppercase tracking-tight">
                {item.name}
              </span>

              {/* UPDATED: Removed animate-bounce */}
              {item.name === "Inbox" && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-xs font-black text-gray-400 hover:text-red-600 transition-colors uppercase tracking-widest"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
