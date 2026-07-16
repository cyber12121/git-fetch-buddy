import { createFileRoute } from "@tanstack/react-router";

import App from "../App";
import { ToastProvider } from "../components/Toast";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://git-friend-come-here.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://git-friend-come-here.lovable.app/" },
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
