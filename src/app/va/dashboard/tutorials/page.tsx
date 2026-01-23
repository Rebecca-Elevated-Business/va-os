"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TutorialsPage() {
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadWelcomeVideo = async () => {
      const { data, error } = await supabase.storage
        .from("tutorial-videos")
        .createSignedUrl("Welcome Video.mp4", 60 * 60);
      if (!isMounted) return;
      if (error || !data?.signedUrl) {
        setVideoError("Welcome video unavailable. Please try again later.");
        return;
      }
      setWelcomeVideoUrl(data.signedUrl);
    };

    loadWelcomeVideo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-[#333333]">
          Tutorials
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Training resources and walkthroughs to help you get the most out of
          VA-OS.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#333333]">
            Welcome video
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            A quick walkthrough for your first day in VA-OS.
          </p>
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
            {welcomeVideoUrl ? (
              <video src={welcomeVideoUrl} controls className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                {videoError || "Loading welcome video..."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#333333]">
            Getting Started
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Placeholder content for onboarding tutorials. Add a short video or
            checklist here.
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#333333]">
            Advanced Workflows
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Placeholder content for deeper training, SOPs, or guided examples.
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#333333]">Template Kit</h2>
          <p className="text-sm text-gray-500 mt-2">
            Placeholder for downloadable templates, scripts, and checklists.
          </p>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#333333]">
            Community Tips
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Placeholder for shared best practices or client-submitted tips.
          </p>
        </article>
      </section>
    </div>
  );
}
