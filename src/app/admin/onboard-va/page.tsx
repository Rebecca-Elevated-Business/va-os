"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export default function OnboardVAPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = (profile as { role?: string | null } | null)?.role;
      if (profileError || !role || !ADMIN_ROLES.has(role)) {
        router.push("/admin/login");
        return;
      }

      setAuthorized(true);
    };

    checkAccess();
  }, [router]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // 1. Create the Auth User
    // We explicitly name the keys 'email' and 'password' to avoid 'Anonymous' errors
    const { data, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) {
      setMessage({ type: "error", text: authError.message });
      setLoading(false);
      return;
    }

    if (data.user) {
      const fullName = `${firstName} ${lastName}`.trim();
      // 2. Create the Profile Entry
      // We use the ID from the freshly created auth user
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName || null,
          role: "va",
          status: "active",
        },
      ]);

      if (profileError) {
        setMessage({
          type: "error",
          text:
            "Auth account created, but database profile failed: " +
            profileError.message,
        });
      } else {
        setMessage({
          type: "success",
          text: `Success! ${fullName || "The VA"} is now registered.`,
        });
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
      }
    }
    setLoading(false);
  };

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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 text-black">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-2xl font-bold mb-2">VA Onboarding</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Create professional VA accounts manually.
        </p>

        <form onSubmit={handleOnboard} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none text-black"
              required
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none text-black"
              required
            />
          </div>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none text-black"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#9d4edd] outline-none text-black"
            required
          />

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
            className="w-full py-3 rounded-lg text-white font-bold bg-[#9d4edd] hover:bg-[#7b2cbf] transition-colors disabled:opacity-50 shadow-md"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
      </div>
    </main>
  );
}
