import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/owner")({
  component: OwnerLayout,
});

function OwnerLayout() {
  return <Outlet />;
}
