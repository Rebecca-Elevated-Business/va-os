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

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
