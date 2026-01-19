import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

type SupportPayload = {
  requestType: string;
  message: string;
};

const SUPPORT_OPTIONS = new Set([
  "support_request",
  "report_bug",
  "request_feature",
]);
const MAX_LENGTH = 280;

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("Authorization") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: SupportPayload;
  try {
    payload = (await request.json()) as SupportPayload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestType = payload.requestType?.trim();
  const message = payload.message?.trim();
  if (!requestType || !SUPPORT_OPTIONS.has(requestType)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid category" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!message || message.length < 10 || message.length > MAX_LENGTH) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid message" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: insertError } = await supabase
    .from("va_support_requests")
    .insert([
      {
        va_id: userData.user.id,
        request_type: requestType,
        message,
        full_name: userData.user.user_metadata?.full_name || null,
        email: userData.user.email || null,
      },
    ]);

  if (insertError) {
    return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const toEmail = Deno.env.get("SUPPORT_EMAIL_TO") || "";
  const fromEmail = Deno.env.get("SUPPORT_EMAIL_FROM") || "";
  const provider = (Deno.env.get("EMAIL_PROVIDER") || "resend").toLowerCase();

  if (!toEmail || !fromEmail) {
    return new Response(
      JSON.stringify({ ok: true, warning: "Email not configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const subject = `VA-OS ${requestType.replace("_", " ")} from ${
    userData.user.email || "VA"
  }`;
  const bodyText = [
    `Type: ${requestType}`,
    `From: ${userData.user.email || "unknown"}`,
    `Name: ${userData.user.user_metadata?.full_name || "unknown"}`,
    "",
    message,
  ].join("\n");

  let emailError: string | null = null;

  if (provider === "postmark") {
    const token = Deno.env.get("POSTMARK_SERVER_TOKEN") || "";
    if (!token) {
      emailError = "Missing Postmark token";
    } else {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: toEmail,
          ReplyTo: userData.user.email || undefined,
          Subject: subject,
          TextBody: bodyText,
        }),
      });
      if (!response.ok) {
        emailError = `Postmark error: ${response.status}`;
      }
    }
  } else {
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!resendKey) {
      emailError = "Missing Resend API key";
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: toEmail,
          reply_to: userData.user.email || undefined,
          subject,
          text: bodyText,
        }),
      });
      if (!response.ok) {
        emailError = `Resend error: ${response.status}`;
      }
    }
  }

  if (emailError) {
    return new Response(JSON.stringify({ ok: true, warning: emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
