import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Bell, Bot, Boxes, ChevronDown, CircleGauge, ClipboardList, Factory, FileClock,
  GitBranch, Map, Menu, Package, PanelLeftClose, PanelLeftOpen, Search, Settings,
  ShoppingCart, Truck, UserRoundCog, Users, Warehouse, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const nav = [
  ["dashboard", "Dashboard", CircleGauge], ["sales-orders", "Sale Orders", ShoppingCart],
  ["purchase-orders", "Purchase Orders", Truck], ["manufacturing-orders", "Manufacturing Orders", Factory],
  ["bom", "Bills of Materials", GitBranch], ["products", "Products", Package],
  ["inventory-ledger", "Inventory Movement", Warehouse], ["audit-logs", "Audit Logs", FileClock],
  ["customers", "Customers", Users], ["vendors", "Vendors", Boxes],
  ["users", "Users & Roles", UserRoundCog], ["alerts", "Alerts", Bell],
  ["erpilot", "ERPilot AI", Bot], ["digital-twin", "Digital Twin", ClipboardList],
  ["supply-map", "Supply Chain Map", Map], ["manufacturing-plants", "Manufacturing Plants", Factory], ["settings", "Settings", Settings],
] as const;

const erpilotEnabled = String(import.meta.env.VITE_ENABLE_ERPILOT_AI ?? "true").toLowerCase() !== "false";

const permissions: Record<string, string[]> = {
  "Sales User": ["dashboard", "sales-orders", "products", "customers", "inventory-ledger", "alerts", "erpilot", "profile"],
  "Purchase User": ["dashboard", "purchase-orders", "products", "vendors", "inventory-ledger", "alerts", "erpilot", "profile"],
  "Manufacturing User": ["dashboard", "manufacturing-orders", "bom", "products", "inventory-ledger", "alerts", "erpilot", "digital-twin", "profile"],
  "Inventory Manager": ["dashboard", "products", "inventory-ledger", "audit-logs", "alerts", "erpilot", "profile"],
  "Business Owner": ["dashboard", "products", "sales-orders", "purchase-orders", "manufacturing-orders", "inventory-ledger", "audit-logs", "alerts", "erpilot", "digital-twin", "supply-map", "profile"],
};

export function canAccess(role: string | undefined, section: string) {
  if (!role || role === "Admin") return true;
  return permissions[role]?.includes(section) ?? false;
}

function AppLink({ path, children, className = "" }: { path: string; children: ReactNode; className?: string }) {
  if (path === "erpilot" || path === "digital-twin") {
    return <Link to={`/${path}`} className={className}>{children}</Link>;
  }
  return <Link to="/$" params={{ _splat: path }} className={className}>{children}</Link>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const current = (pathname.split("/")[1] || "dashboard").split("?")[0] || "dashboard";
  const showErpilotShortcut = erpilotEnabled && current !== "erpilot";

  useEffect(() => {
    let active = true;
    const check = () => api.health().then(() => active && setOnline(true)).catch(() => active && setOnline(false));
    check(); const timer = window.setInterval(check, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const signOut = async () => {
    await logout(); toast.success("Signed out securely"); navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {mobileOpen && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-foreground/35 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 lg:sticky ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "w-18" : "w-64"}`}>
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><GitBranch className="size-5" /></div>
          {!collapsed && <div className="min-w-0"><p className="font-semibold text-sidebar-accent-foreground">FlowForge ERP</p><p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/55">Shiv Furniture Works</p></div>}
          <Button variant="ghost" size="icon" className="ml-auto hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:inline-flex" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground lg:hidden" onClick={() => setMobileOpen(false)}><X /></Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.filter(([key]) => erpilotEnabled || !["erpilot", "digital-twin"].includes(key)).filter(([key]) => canAccess(user?.role, key)).map(([key, label, Icon]) => (
            <AppLink key={key} path={key} className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${current === key ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <Icon className="size-4 shrink-0" />{!collapsed && <span className="truncate">{label}</span>}
            </AppLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu /></Button>
          <div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Global search" placeholder="Search orders, products, stock movements…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:ring-2 focus:ring-ring" onKeyDown={(e) => { if (e.key === "Enter") toast.info("Open a module to search its live records"); }} /></div>
          <div className={`ml-auto flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${online ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}><span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />{online ? "API Connected" : online === false ? "Server Offline" : "Checking API"}</div>
          <Button variant="ghost" size="icon" aria-label="Alerts" asChild><AppLink path="alerts"><Bell /></AppLink></Button>
          <div className="relative">
            <Button variant="ghost" className="gap-2 px-2" onClick={() => setProfileOpen(!profileOpen)}><div className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{user?.name?.[0] || "U"}</div><ChevronDown className="size-3" /></Button>
            {profileOpen && <div className="absolute right-0 top-12 w-52 rounded-lg border border-border bg-popover p-2 shadow-xl"><p className="px-2 py-1 text-xs text-muted-foreground">{user?.email}</p><AppLink path="profile" className="block rounded-md px-2 py-2 text-sm hover:bg-accent">Profile</AppLink><button className="w-full rounded-md px-2 py-2 text-left text-sm text-destructive hover:bg-accent" onClick={signOut}>Logout</button></div>}
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
      {showErpilotShortcut && <AppLink path="erpilot" className="fixed bottom-6 right-6 z-30 grid size-13 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105" ><Bot className="size-6" /></AppLink>}
    </div>
  );
}
