import { Navigate, createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { AppShell, canAccess } from "@/components/app-shell";
import { DashboardPage, DigitalTwinPage, ERPilotPage, LedgerPage, RecordForm, ResourceList, SimpleApiPage } from "@/components/erp-pages";
import { StatePanel } from "@/components/erp-ui";
import { useAuth } from "@/lib/auth";
import { session } from "@/lib/api";

export const Route = createFileRoute("/$")({
  head: () => ({ meta: [{ title: "Workspace — FlowForge ERP" }, { name: "description", content: "Shiv Furniture Works demand-to-delivery operations." }] }),
  component: ProtectedWorkspace,
});

const resources = ["products", "customers", "vendors", "bom", "sales-orders", "purchase-orders", "manufacturing-orders"];
const simple = ["users", "alerts", "profile", "settings", "supply-map", "manufacturing-plants"];
const erpilotEnabled = String(import.meta.env.VITE_ENABLE_ERPILOT_AI ?? "true").toLowerCase() !== "false";

function ProtectedWorkspace() {
  const { _splat = "dashboard" } = Route.useParams();
  const { user, loading } = useAuth();
  if (loading) return <StatePanel type="loading" message="Verifying your secure session." />;
  if (!user || !session.getToken()) return <Navigate to="/login" replace />;
  const cleanSplat = decodeURIComponent(_splat || "dashboard").split("?")[0].split("#")[0].replace(/^\/+/, "");
  const [rawSection, id] = cleanSplat.split("/");
  const aliases: Record<string, string> = {
    customer: "customers",
    vendor: "vendors",
    boms: "bom",
    "stock-ledger": "inventory-ledger",
    "inventory": "inventory-ledger",
    "sales": "sales-orders",
    "purchase": "purchase-orders",
    "manufacturing": "manufacturing-orders",
  };
  const section = aliases[rawSection] || rawSection || "dashboard";
  if (!erpilotEnabled && ["erpilot", "digital-twin"].includes(section)) return <Navigate to="/$" params={{ _splat: "dashboard" }} replace />;
  if (!canAccess(user.role, section)) return <AppShell><div className="grid min-h-[70vh] place-items-center"><div className="max-w-md text-center"><ShieldAlert className="mx-auto size-10 text-destructive" /><h1 className="mt-4 text-xl font-bold">Access Restricted</h1><p className="mt-2 text-sm text-muted-foreground">Your current role does not have permission to open this module. Contact an administrator if your responsibilities have changed.</p></div></div></AppShell>;
  let page;
  if (section === "dashboard") page = <DashboardPage />;
  else if (section === "inventory-ledger") page = <LedgerPage />;
  else if (section === "audit-logs") page = <LedgerPage audit />;
  else if (section === "erpilot") page = <ERPilotPage />;
  else if (section === "digital-twin") page = <DigitalTwinPage />;
  else if (resources.includes(section)) page = id ? <RecordForm section={section} id={id} /> : <ResourceList section={section} />;
  else if (simple.includes(section)) page = <SimpleApiPage section={section} />;
  else return <Navigate to="/$" params={{ _splat: "dashboard" }} replace />;
  return <AppShell>{page}</AppShell>;
}
