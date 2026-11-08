import { createFileRoute, redirect } from "@tanstack/react-router";

// Sign-in now lives on the public landing page's login card.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => { throw redirect({ to: "/", hash: "login" }); },
});
