"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ImpersonationContext = {
  sessionId: string;
  targetRole: string;
  targetEmail: string;
  startedAt: string;
};

type AdminSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export default function ImpersonationBanner() {
  const router = useRouter();
  const [context, setContext] = useState<ImpersonationContext | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedContext = localStorage.getItem("vaos_impersonation_context");
    const storedAdminSession = localStorage.getItem("vaos_admin_session");

    if (storedContext) {
      try {
        setContext(JSON.parse(storedContext));
      } catch {
        localStorage.removeItem("vaos_impersonation_context");
      }
    }

    if (storedAdminSession) {
      try {
        setAdminSession(JSON.parse(storedAdminSession));
      } catch {
        localStorage.removeItem("vaos_admin_session");
      }
    }
  }, []);

  const handleExit = async () => {
    if (!context || !adminSession) {
      setError("Unable to restore admin session.");
      return;
    }

    setBusy(true);
    setError(null);

    await fetch("/api/admin/impersonate/stop", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminSession.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: context.sessionId }),
    });

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });

    if (sessionError) {
      setError("Failed to restore admin session.");
      setBusy(false);
      return;
    }

    localStorage.removeItem("vaos_impersonation_context");
    localStorage.removeItem("vaos_admin_session");
    setContext(null);
    setAdminSession(null);
    setBusy(false);
    router.push("/admin");
  };

  if (!context) {
    return null;
  }

  return (
    <div className="w-full bg-[#fff3f3] border-b border-red-100 text-[#7a2b2b] text-sm px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <span className="font-semibold">Impersonating {context.targetRole}</span>{" "}
        <span className="text-xs text-[#a05a5a]">{context.targetEmail}</span>
      </div>
      <div className="flex items-center gap-4">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button
          onClick={handleExit}
          disabled={busy}
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#9d4edd] text-white hover:bg-[#7b2cbf] transition-colors disabled:opacity-60"
        >
          {busy ? "Exiting..." : "Exit impersonation"}
        </button>
      </div>
    </div>
  );
}
