"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SetupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get("email") || "";
  const clientId = searchParams.get("id") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Create the Auth User
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // 2. Update the Profile table with the new Auth ID
      // We overwrite the 'placeholder' CRM ID with the real Auth UUID

      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          role: "client",
          status: "active",
        },
      ]);

      if (profileError) {
        console.error("Profile creation failed:", profileError.message);
      }

      // 3. Link the CRM record to this new User ID
      await supabase
        .from("clients")
        .update({
          has_access: true,
          auth_user_id: data.user.id, // <--- THIS CREATES THE BRIDGE
        })
        .eq("id", clientId);

      router.push("/client/dashboard");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 text-black text-center">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-100 text-left">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Welcome to your Portal
        </h1>
        <p className="text-gray-500 text-sm mb-8 text-center">
          Please set a secure password for your account.
        </p>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="text"
              value={email}
              disabled
              className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Create Password
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#9d4edd] text-white font-bold rounded-lg hover:bg-[#7b2cbf] transition-all disabled:opacity-50"
          >
            {loading ? "Setting up account..." : "Complete Account Setup"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ClientSetupPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-black">Loading setup...</div>}
    >
      <SetupForm />
    </Suspense>
  );
}
