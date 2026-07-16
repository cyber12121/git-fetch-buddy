import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import App from "../App";
import type { TabId } from "../components/app/ModuleRouter";

const TABS = ["today", "compiler", "todo", "taskmaster", "calendar", "weekly", "habits"] as const;
type Tab = (typeof TABS)[number];

/**
 * Per-tab head copy. Each surface gets its own title/description so shares,
 * browser tabs, and history are distinguishable — the old hash-based tabs
 * all inherited the root's "Momentum — Cozy Focus OS" metadata.
 */
const TAB_META: Record<Tab, { title: string; description: string }> = {
  today: {
    title: "Today — Momentum",
    description: "Your daily focus dashboard: quests, habits, and momentum for ADHD brains.",
  },
  compiler: {
    title: "Brain Dump — Momentum",
    description: "De-clutter messy thoughts into ordered, actionable quests with Sprig.",
  },
  todo: {
    title: "Quests — Momentum",
    description: "Manage your todo list with priorities, subtasks, voice input, and gentle nudges.",
  },
  taskmaster: {
    title: "Focus — Momentum",
    description: "Single-task focus timer with breathing breaks and cozy pacing sounds.",
  },
  calendar: {
    title: "Calendar — Momentum",
    description: "Month view of quests, manual events, and Google Calendar sync.",
  },
  weekly: {
    title: "Weekly Planner — Momentum",
    description: "Drag-and-drop weekly time blocks and someday tasks for the whole week.",
  },
  habits: {
    title: "Habits — Momentum",
    description: "Track streaks and daily habits with a cozy grid tracker built for ADHD brains.",
  },
};

const BASE_URL = "https://git-friend-come-here.lovable.app";

function isTab(v: string): v is Tab {
  return (TABS as readonly string[]).includes(v);
}

export const Route = createFileRoute("/_authenticated/$tab")({
  // Reject unknown tab segments at match time so `/gibberish` renders the
  // shared 404 instead of a blank App shell.
  beforeLoad: ({ params }) => {
    if (!isTab(params.tab)) throw notFound();
  },
  head: ({ params }) => {
    const tab = isTab(params.tab) ? params.tab : "today";
    const meta = TAB_META[tab];
    const url = `${BASE_URL}/${tab}`;
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { property: "og:title", content: meta.title },
        { property: "og:description", content: meta.description },
        { property: "og:url", content: url },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
        // The authenticated app itself is not something search should index —
        // the marketing surface (root) handles that.
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <main className="min-h-[60vh] flex items-center justify-center text-center p-8">
      <div className="max-w-sm">
        <div className="text-3xl mb-2" aria-hidden="true">🍄</div>
        <h1 className="text-lg font-bold text-ink mb-1">Unknown workspace</h1>
        <p className="text-sm text-ink-muted">
          That tab doesn't exist. Try Today, Quests, Focus, Calendar, Weekly, Habits, or Brain Dump.
        </p>
      </div>
    </main>
  ),
  component: TabPage,
});

function TabPage() {
  const { tab } = Route.useParams();
  const navigate = useNavigate();
  const activeTab = (isTab(tab) ? tab : "today") as TabId;
  return (
    <App
      activeTab={activeTab}
      onNavigate={(next) => {
        void navigate({ to: "/$tab", params: { tab: next } });
      }}
    />
  );
}
