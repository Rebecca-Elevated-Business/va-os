"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Circle, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { tutorialTopicsBySlug } from "../data";

type CompletionMap = Record<string, boolean>;
type UrlMap = Record<string, string>;

export default function TutorialTopicPage({
  params,
}: {
  params: { topic: string };
}) {
  const topic = tutorialTopicsBySlug.get(params.topic);
  const [userId, setUserId] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<UrlMap>({});
  const [completion, setCompletion] = useState<CompletionMap>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!topic) return;
    let isMounted = true;

    const loadTopicData = async () => {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (userError || !user) {
        setLoadError("Please sign in to view tutorials.");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: completionData, error: completionError } = await supabase
        .from("tutorial_video_completion")
        .select("video_id, is_completed")
        .eq("user_id", user.id)
        .eq("topic_slug", topic.slug);

      if (!isMounted) return;

      if (completionError) {
        setLoadError("Completion data unavailable right now.");
      } else if (completionData) {
        const nextCompletion: CompletionMap = {};
        completionData.forEach((item) => {
          nextCompletion[item.video_id] = item.is_completed;
        });
        setCompletion(nextCompletion);
      }

      const urlEntries = await Promise.all(
        topic.videos.map(async (video) => {
          if (!video.objectPath) {
            return [video.id, ""] as const;
          }
          const { data, error } = await supabase.storage
            .from("tutorial-videos")
            .createSignedUrl(video.objectPath, 60 * 60);
          if (error || !data?.signedUrl) {
            return [video.id, ""] as const;
          }
          return [video.id, data.signedUrl] as const;
        }),
      );

      if (!isMounted) return;
      const nextUrls: UrlMap = {};
      urlEntries.forEach(([videoId, url]) => {
        if (url) nextUrls[videoId] = url;
      });
      setVideoUrls(nextUrls);
      setLoading(false);
    };

    loadTopicData();

    return () => {
      isMounted = false;
    };
  }, [topic]);

  const toggleCompletion = async (videoId: string) => {
    if (!topic || !userId) return;
    const nextValue = !completion[videoId];
    setCompletion((prev) => ({ ...prev, [videoId]: nextValue }));

    const { error } = await supabase.from("tutorial_video_completion").upsert(
      {
        user_id: userId,
        topic_slug: topic.slug,
        video_id: videoId,
        is_completed: nextValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_slug,video_id" },
    );

    if (error) {
      setCompletion((prev) => ({ ...prev, [videoId]: !nextValue }));
    }
  };

  if (!topic) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in duration-500">
        <Link
          href="/va/dashboard/tutorials"
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Tutorials
        </Link>
        <h1 className="text-2xl font-semibold text-[#333333]">
          Topic not found
        </h1>
        <p className="text-sm text-gray-500">
          The tutorial topic you are looking for does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <Link
          href="/va/dashboard/tutorials"
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Tutorials
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-[#333333]">
          {topic.title}
        </h1>
        {topic.description && (
          <p className="text-sm text-gray-500">{topic.description}</p>
        )}
      </header>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <section className="space-y-6">
        {topic.videos.map((video) => {
          const isCompleted = completion[video.id] || false;
          const videoUrl = videoUrls[video.id];

          return (
            <article
              key={video.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#333333]">
                  {video.title}
                </h2>
                <button
                  type="button"
                  onClick={() => toggleCompletion(video.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
                >
                  {isCompleted ? (
                    <>
                      <CheckCircle size={14} className="text-emerald-500" />
                      Completed
                    </>
                  ) : (
                    <>
                      <Circle size={14} className="text-gray-400" />
                      Mark complete
                    </>
                  )}
                </button>
              </div>

              <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
                {video.objectPath ? (
                  videoUrl ? (
                    <video src={videoUrl} controls className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                      {loading ? "Loading video..." : "Video unavailable."}
                    </div>
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                    Video coming soon.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
