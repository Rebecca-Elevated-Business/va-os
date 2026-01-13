"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ClientDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  return (
    <main className="p-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Client Dashboard</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100">
        <p className="text-gray-600">
          Welcome to your dashboard. Your shared documents and CRM data will
          appear here.
        </p>
      </div>
    </main>
  );
}
