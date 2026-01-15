"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function VADashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/va/login");
  };

  return (
    <main className="p-10 text-black">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">VA Dashboard</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-[#9d4edd] border border-gray-300 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4">Welcome to VA-OS</h2>
        <p className="text-gray-600">
          Select <strong>Task Centre</strong> from the sidebar to manage your
          workload.
        </p>
      </div>
    </main>
  );
}
