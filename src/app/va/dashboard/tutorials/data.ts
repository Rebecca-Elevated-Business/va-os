export type TutorialVideo = {
  id: string;
  title: string;
  objectPath?: string;
  helper?: string;
};

export type TutorialTopic = {
  slug: string;
  title: string;
  description?: string;
  videos: TutorialVideo[];
};

export const tutorialTopics: TutorialTopic[] = [
  {
    slug: "overview",
    title: "Overview",
    description: "A short orientation to VA-OS.",
    videos: [
      {
        id: "overview",
        title: "Overview",
        objectPath: "Welcome Video.mp4",
      },
    ],
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    description: "Your daily home base and quick insights.",
    videos: [{ id: "dashboard", title: "Dashboard" }],
  },
  {
    slug: "task-centre",
    title: "Task Centre",
    description: "Plan, track, and complete tasks.",
    videos: [{ id: "task-centre", title: "Task Centre" }],
  },
  {
    slug: "time-tracking",
    title: "Time Tracking",
    description: "Log and manage time entries.",
    videos: [{ id: "time-tracking", title: "Time Tracking" }],
  },
  {
    slug: "time-reports",
    title: "Time Reports",
    description: "Generate reports for time worked.",
    videos: [{ id: "time-reports", title: "Time Reports" }],
  },
  {
    slug: "inbox",
    title: "Inbox",
    description: "Manage client requests and approvals.",
    videos: [{ id: "inbox", title: "Inbox" }],
  },
  {
    slug: "crm",
    title: "CRM",
    description: "Manage your clients and relationships.",
    videos: [
      { id: "adding-a-client", title: "Adding a client" },
      { id: "overview-of-features", title: "Overview of features" },
      { id: "creating-client-portal", title: "Creating client portal" },
      {
        id: "issuing-documents-and-adding-workflows",
        title: "Issuing documents and adding workflows",
      },
    ],
  },
  {
    slug: "documents",
    title: "Documents",
    description: "Create and send polished documents.",
    videos: [
      { id: "proposals", title: "Proposals" },
      { id: "booking-form", title: "Booking Form" },
      { id: "invoices", title: "Invoices" },
      { id: "sending-own-documents", title: "Sending own documents" },
    ],
  },
  {
    slug: "workflows",
    title: "Workflows",
    description: "Automate and guide client processes.",
    videos: [
      { id: "internal-guidance", title: "Internal Guidance" },
      { id: "client-workflow", title: "Client Workflow" },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    description: "Update preferences and account details.",
    videos: [{ id: "settings", title: "Settings" }],
  },
];

export const tutorialTopicsBySlug = new Map(
  tutorialTopics.map((topic) => [topic.slug, topic]),
);
