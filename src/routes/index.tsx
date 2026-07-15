import { createFileRoute } from "@tanstack/react-router";

import App from "../App";
import { ToastProvider } from "../components/Toast";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Momentum — Cozy Focus OS" },
      { name: "description", content: "A cozy focus OS for ADHD brains — tasks, calendar, focus timer, and habits." },
      { property: "og:title", content: "Momentum — Cozy Focus OS" },
      { property: "og:description", content: "A cozy focus OS for ADHD brains — tasks, calendar, focus timer, and habits." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
