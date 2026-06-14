import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ERPilotPage } from "@/components/erp-pages";
import { StatePanel } from "@/components/erp-ui";
import { useAuth } from "@/lib/auth";
import { session } from "@/lib/api";
import { Navigate } from "@tanstack/react-router";

const erpilotEnabled = String(import.meta.env.VITE_ENABLE_ERPILOT_AI ?? "true").toLowerCase() !== "false";

export const Route = createFileRoute("/erpilot")({
  component: ERPilotRoute,
});

function ERPilotRoute() {
  const { user, loading } = useAuth();
  if (loading) return <StatePanel type="loading" message="Verifying your secure session." />;
  if (!user || !session.getToken()) return <Navigate to="/login" replace />;
  if (!erpilotEnabled) return <Navigate to="/$" params={{ _splat: "dashboard" }} replace />;
  return <AppShell><ERPilotPage /></AppShell>;
}
