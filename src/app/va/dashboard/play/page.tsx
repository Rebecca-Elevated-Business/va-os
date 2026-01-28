"use client";

import { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Task Manager" },
  { id: "docs", label: "Documents & Workflows" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PlayPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="flex min-h-[60vh] flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">CRM Play</h1>
        <p className="text-sm text-muted-foreground">
          Experimental layout for the CRM client view. This page does not affect
          the live CRM.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border bg-background p-5">
        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border bg-muted/20 p-4">
              <h2 className="text-lg font-semibold">Client information</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Placeholder for client details, contact info, status, and key
                metadata.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <h2 className="text-lg font-semibold">Internal notes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Placeholder for internal notes, highlights, and quick edits.
              </p>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="rounded-lg border bg-muted/20 p-4">
            <h2 className="text-lg font-semibold">Task manager</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Placeholder for task list, filters, due dates, and quick actions.
            </p>
          </div>
        )}

        {activeTab === "docs" && (
          <div className="rounded-lg border bg-muted/20 p-4">
            <h2 className="text-lg font-semibold">Documents & workflows</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Placeholder for documents, proposals, workflows, and status.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
