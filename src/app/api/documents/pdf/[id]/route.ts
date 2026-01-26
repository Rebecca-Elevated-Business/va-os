import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resolveBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

const getSupabaseStorageKey = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const hostname = new URL(url).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
};

const buildFilename = (title: string | null | undefined) => {
  const safeTitle = (title || "document")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${safeTitle || "document"}.pdf`;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Missing Supabase service role configuration.",
      },
      { status: 500 }
    );
  }

  const { id } = await params;
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 403 });
  }

  const { data: doc, error: docError } = await supabaseAdmin
    .from("client_documents")
    .select("id, title, client_id, clients(id, va_id, auth_user_id)")
    .eq("id", id)
    .single();

  const typedDoc = doc as
    | {
        id: string;
        title: string | null;
        client_id: string;
        clients: { id: string; va_id: string | null; auth_user_id: string | null } | null;
      }
    | null;

  if (docError) {
    return NextResponse.json(
      { error: docError.message || "Failed to load document." },
      { status: 500 }
    );
  }

  if (!typedDoc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const isClient = typedDoc.clients?.auth_user_id === authData.user.id;
  const isVaOwner = typedDoc.clients?.va_id === authData.user.id;

  if (!isClient && !isVaOwner) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const storageKey = getSupabaseStorageKey();
  if (!storageKey) {
    return NextResponse.json(
      { error: "Missing Supabase URL configuration." },
      { status: 500 }
    );
  }

  const baseUrl = resolveBaseUrl();
  const targetUrl = `${baseUrl}/documents/pdf/${typedDoc.id}?pdf=1`;

  let browser;
  try {
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 15;
    const session = {
      access_token: token,
      refresh_token: "",
      token_type: "bearer",
      expires_in: 60 * 15,
      expires_at: expiresAt,
      user: authData.user,
    };

    await page.evaluateOnNewDocument(
      (key: string, value: string) => {
        localStorage.setItem(key, value);
      },
      storageKey,
      JSON.stringify(session)
    );

    await page.goto(targetUrl, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-pdf-ready="true"]', { timeout: 15000 });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "24px",
        right: "24px",
        bottom: "24px",
        left: "24px",
      },
    });

    const response = new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildFilename(
          typedDoc.title
        )}"`,
        "Cache-Control": "no-store",
      },
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
