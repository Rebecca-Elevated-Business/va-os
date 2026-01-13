"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OnboardVAPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // 1. Create the Auth User
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setMessage({ type: "error", text: authError.message });
      setLoading(false);
      return;
    }

    if (data.user) {
      // 2. Create the Profile Entry
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          full_name: fullName,
          role: "va",
          status: "active",
        },
      ]);

      if (profileError) {
        setMessage({
          type: "error",
          text: "Account created, but profile failed: " + profileError.message,
        });
      } else {
        setMessage({
          type: "success",
          text: `Success! VA ${fullName} has been onboarded.`,
        });
        // Clear form
        setEmail("");
        setPassword("");
        setFullName("");
      }
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-2xl font-bold mb-2 text-gray-900">VA Onboarding</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Create a new VA account. They can log in immediately once created.
        </p>

        <form onSubmit={handleOnboard} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              VA Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="va@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Temporary Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9d4edd] focus:border-transparent outline-none text-black transition-all"
              required
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-white font-bold bg-[#9d4edd] hover:bg-[#7b2cbf] transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? "Processing..." : "Create VA Account"}
          </button>
        </form>
      </div>
    </main>
  );
}
