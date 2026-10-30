import { createFileRoute, redirect } from "@tanstack/react-router";

/** Keep /app as a stable entry point while making the agenda the clinic home. */
export const Route = createFileRoute("/_authenticated/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/agenda" });
  },
});
