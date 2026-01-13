"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function VADashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/va/login");
  };

  const navItems = [
    { name: "Overview", href: "/va/dashboard" },
    { name: "CRM", href: "/va/dashboard/crm" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-black">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-[#9d4edd]">VA-OS</h2>
        </div>

        <nav className="flex-1 p-4 space-y-2 text-black">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`block px-4 py-2 rounded-lg font-medium transition-colors ${
                pathname === item.href
                  ? "bg-purple-50 text-[#9d4edd]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-[#9d4edd]"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
