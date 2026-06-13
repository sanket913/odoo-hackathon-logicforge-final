import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Boxes, Factory, FileClock, GitBranch, Package, ShoppingCart, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowForge ERP — Demand to Delivery" },
      { name: "description", content: "Inventory-led ERP and AI decision support for Shiv Furniture Works." },
      { property: "og:title", content: "FlowForge ERP + ERPilot AI" },
      { property: "og:description", content: "From demand to delivery — every stock movement explained." },
    ],
  }),
  component: Index,
});

function Index() {
  const modules = [["Products", Package], ["Sales Orders", ShoppingCart], ["Purchase Orders", Truck], ["Manufacturing Orders", Factory], ["Bills of Materials", Boxes], ["Stock Ledger", Warehouse], ["Audit Logs", FileClock], ["ERPilot AI", Bot]] as const;
  return (
    <main className="min-h-screen bg-background">
      <nav className="mx-auto flex h-18 max-w-7xl items-center px-5 sm:px-8"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><GitBranch /></div><div><p className="font-semibold">FlowForge ERP</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">ERPilot AI</p></div></div><div className="ml-auto flex gap-2"><Button variant="ghost" asChild><Link to="/login">Login</Link></Button><Button asChild><Link to="/signup">Create Account</Link></Button></div></nav>
      <section className="border-y border-border bg-card"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-28"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Shiv Furniture Works</p><h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">From demand to delivery — every stock movement explained.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">FlowForge ERP runs every sales, purchase, production and inventory transaction. ERPilot AI turns those movements into confident operational decisions.</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" asChild><Link to="/login">Open workspace <ArrowRight /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/signup">Request access</Link></Button></div></div><div className="relative"><div className="rounded-2xl border border-border bg-background p-5 shadow-xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Operational flow</p><h2 className="mt-1 font-semibold">Demand-to-delivery control</h2></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Live API</span></div><div className="grid grid-cols-2 gap-3">{modules.slice(0,6).map(([name, Icon], i) => <div key={name} className="rounded-lg border border-border bg-card p-4"><Icon className={`size-5 ${i === 3 ? "text-primary" : "text-muted-foreground"}`} /><p className="mt-5 text-sm font-semibold">{name}</p><div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${38 + i * 9}%` }} /></div></div>)}</div></div></div></div></section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">One connected lifecycle</p><h2 className="mt-2 text-2xl font-bold">Built around inventory truth</h2></div><div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">{modules.map(([name, Icon]) => <div key={name} className="bg-card p-6"><Icon className="size-5 text-primary" /><h3 className="mt-8 font-semibold">{name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Connected records, clear status and traceable movement history.</p></div>)}</div></section>
    </main>
  );
}
