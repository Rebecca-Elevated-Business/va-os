"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetMessage(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || profile?.role !== "client") {
      await supabase.auth.signOut();
      setError("Access denied. This portal is for Clients only.");
      setLoading(false);
      return;
    }

    router.push("/client/dashboard");
  };

  const handlePasswordReset = async () => {
    setResetMessage(null);
    if (!email) {
      setResetMessage("Enter your email address first.");
      return;
    }

    const origin = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${origin}/client/reset-password`,
      }
    );

    if (resetError) {
      setResetMessage(resetError.message);
      return;
    }

    setResetMessage("Password reset email sent. Check your inbox.");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fcfcfc]">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-lg border border-purple-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to your Client Portal
          </h1>
          <p className="text-[#9d4edd] font-semibold text-sm">
            Managed by your Virtual Assistant
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black"
              required
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
            className="w-full py-3 px-4 rounded-lg text-white font-bold bg-[#9d4edd] hover:bg-[#7b2cbf] transition-all shadow-md disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>
          <div className="text-left">
            <button
              type="button"
              onClick={handlePasswordReset}
              className="text-xs text-red-400 hover:underline underline-offset-2"
            >
              Forgot password?
            </button>
          </div>
          {resetMessage && (
            <p className="text-xs text-gray-500">{resetMessage}</p>
          )}
        </form>
      </div>
      <p className="mt-4 text-xs text-[#333333] text-center">
        Do you need a Virtual Assistant?{" "}
        <a
          href="https://elevatedbusiness.co.uk"
          target="_blank"
          rel="noreferrer"
          className="hover:underline underline-offset-2"
        >
          Click here
        </a>
      </p>
    </main>
  );
}
