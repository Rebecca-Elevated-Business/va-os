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
    videos: [
      {
        id: "welcome-video",
        title: "Welcome video",
        objectPath: "Welcome Video.mp4",
      },
      {
        id: "navigation",
        title: "Navigation",
      },
    ],
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    videos: [{ id: "dashboard", title: "Dashboard" }],
  },
  {
    slug: "task-centre",
    title: "Task Centre",
    videos: [{ id: "task-centre", title: "Task Centre" }],
  },
  {
    slug: "time-tracking",
    title: "Time Tracking",
    videos: [{ id: "time-tracking", title: "Time Tracking" }],
  },
  {
    slug: "time-reports",
    title: "Time Reports",
    videos: [{ id: "time-reports", title: "Time Reports" }],
  },
  {
    slug: "inbox",
    title: "Inbox",
    videos: [{ id: "inbox", title: "Inbox" }],
  },
  {
    slug: "crm",
    title: "CRM",
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
    videos: [
      { id: "internal-guidance", title: "Internal Guidance" },
      { id: "client-workflow", title: "Client Workflow" },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    videos: [{ id: "settings", title: "Settings" }],
  },
];

export const tutorialTopicsBySlug = new Map(
  tutorialTopics.map((topic) => [topic.slug, topic]),
);
