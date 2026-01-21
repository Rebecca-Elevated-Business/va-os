"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function VAResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(Boolean(data.session));
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY" || session) {
          setHasSession(true);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!hasSession) {
      setMessage({
        type: "error",
        text: "Reset link is invalid or has expired.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
      return;
    }

    setMessage({
      type: "success",
      text: "Password updated. Redirecting to login...",
    });
    await supabase.auth.signOut();
    setTimeout(() => router.push("/va/login"), 1200);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fcfcfc] text-black">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-[#9d4edd] font-semibold text-sm">
            VA Operating System
          </p>
        </div>

        {hasSession === null && (
          <p className="text-sm text-gray-500">Verifying reset link...</p>
        )}

        {hasSession === false && (
          <div className="text-sm text-red-500 bg-red-50 p-3 rounded">
            Reset link is invalid or has expired. Please request a new one.
          </div>
        )}

        {hasSession && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black"
                required
              />
            </div>

            {message && (
              <p
                className={`text-sm p-2 rounded ${
                  message.type === "success"
                    ? "text-green-600 bg-green-50"
                    : "text-red-500 bg-red-50"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg text-white font-bold bg-[#9d4edd] hover:bg-[#7b2cbf] transition-all shadow-md disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
