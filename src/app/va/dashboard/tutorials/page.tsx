import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { tutorialTopics } from "./data";

export default function TutorialsPage() {
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

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {tutorialTopics.map((topic) => (
            <li key={topic.slug}>
              <Link
                href={`/va/dashboard/tutorials/${topic.slug}`}
                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400">
                  <PlayCircle size={20} />
                </span>
                <span className="text-sm font-semibold text-[#333333]">
                  {topic.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
