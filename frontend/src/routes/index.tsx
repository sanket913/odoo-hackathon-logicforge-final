import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Boxes, BrainCircuit, ClipboardCheck, Factory, GitBranch, History, Layers3, Package, PackageCheck, ShoppingBasket, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowForge ERP | Demand to Delivery Orchestration" },
      { name: "description", content: "Database-backed Mini ERP for furniture manufacturers with inventory, manufacturing, audit logs and ERPilot AI." },
      { property: "og:title", content: "FlowForge ERP" },
      { property: "og:description", content: "Run sales, purchase, manufacturing and inventory from one connected ERP workflow." },
    ],
  }),
  component: LandingPage,
});

const moduleCards = [
  ["Products", "Master catalogue for variants, raw timber, and finished furniture items.", Package],
  ["Sales Orders", "Multi-channel demand capture with automated stock availability checks.", ShoppingBasket],
  ["Purchase Orders", "Procurement automation for wood, fabric, hardware, and vendor receipts.", Truck],
  ["Manufacturing", "MTO and MTS workflow orchestration from wood cutting to final polish.", Factory],
  ["Bills of Materials", "Precise component lists for every table, chair, and wardrobe SKU.", Boxes],
  ["Stock Ledger", "Real-time valuation and quantity tracking across all warehouse bins.", Warehouse],
  ["Audit Logs", "Immutable records of every user action and automated system update.", History],
  ["ERPilot AI", "Decision intelligence for stock shortages and delivery timeline risks.", Bot],
] as const;

const flowNodes = [
  ["Demand", 19, 24, ShoppingBasket],
  ["Stock", 81, 24, Warehouse],
  ["Procure", 81, 76, Truck],
  ["Manuf.", 19, 76, Factory],
  ["Delivery", 50, 15, ClipboardCheck],
  ["Ledger", 50, 85, History],
] as const;

function LandingPage() {
  return (
    <main className="min-h-screen scroll-smooth bg-[#faf8ff] text-[#131b2e]">
      <style>{`
        .landing-flow-line { stroke-dasharray: 8; animation: landingDash 20s linear infinite; }
        .landing-pulse { animation: landingPulse 2s infinite ease-in-out; }
        @keyframes landingDash { to { stroke-dashoffset: -1000; } }
        @keyframes landingPulse { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }
      `}</style>

      <nav className="sticky top-0 z-50 border-b border-[#c7c4d7] bg-[#faf8ff]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-[#4648d4] text-white"><GitBranch className="size-5" /></span>
              <span className="text-xl font-bold text-[#4648d4]">FlowForge ERP</span>
            </Link>
            <div className="hidden items-center gap-6 md:flex">
              <a className="text-sm font-medium text-[#464554] transition hover:text-[#4648d4]" href="#modules">Modules</a>
              <a className="text-sm font-medium text-[#464554] transition hover:text-[#4648d4]" href="#inventory">Inventory Engine</a>
              <a className="text-sm font-medium text-[#464554] transition hover:text-[#4648d4]" href="#erpilot">ERPilot AI</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Login</Link></Button>
            <Button asChild className="bg-[#4648d4] text-white hover:bg-[#3b3db9]"><Link to="/signup">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pb-12 pt-16 lg:pb-14 lg:pt-24">
        <div className="absolute inset-0 -z-10 opacity-60" style={{ background: "radial-gradient(45% 45% at 50% 50%, #e1e0ff 0%, #faf8ff 100%)" }} />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e1e0ff] px-3 py-1 text-[#07006c]">
              <Layers3 className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.05em]">From demand to delivery - every stock movement explained.</span>
            </div>
            <div>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Run Sales, Purchase, Manufacturing and Inventory from one connected <span className="text-[#4648d4]">ERP workflow.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#464554] sm:text-lg">
                A database-backed Mini ERP for furniture manufacturers that connects customer orders, procurement, BoM-based manufacturing, stock ledger, audit logs and ERPilot AI decision support.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild className="bg-[#4648d4] px-8 py-6 text-base font-semibold text-white shadow-xl shadow-[#4648d4]/20 hover:bg-[#3b3db9]"><Link to="/login">Login to Workspace <ArrowRight className="size-5" /></Link></Button>
              <Button size="lg" variant="outline" asChild className="border-[#c7c4d7] bg-white/70 px-8 py-6 text-base font-semibold text-[#131b2e] backdrop-blur hover:bg-white"><Link to="/signup">Create Account</Link></Button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white/75 p-4 shadow-[0_30px_90px_rgba(70,72,212,0.18)] backdrop-blur-xl sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(96,99,238,0.16),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.82),rgba(234,237,255,0.58))]" />
            <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#c0c1ff]/45 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-[#d0bcff]/45 blur-3xl" />
            <div className="relative mb-4 flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#464554]">Live orchestration map</p>
                <p className="mt-1 text-sm font-semibold text-[#131b2e]">Demand-to-delivery flow</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" />Active</span>
            </div>
            <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-[#e1e0ff] bg-[#fbfaff]/80 shadow-inner">
              <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(70,72,212,0.12) 1px, transparent 0)", backgroundSize: "26px 26px" }} />
              <svg className="relative h-full w-full" viewBox="0 0 500 500" aria-label="Connected ERP workflow visual">
                <defs>
                  <linearGradient id="landingLineGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#4648d4" />
                    <stop offset="100%" stopColor="#6b38d4" />
                  </linearGradient>
                  <filter id="landingNodeShadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#283044" floodOpacity="0.18" />
                  </filter>
                </defs>
                {flowNodes.map(([label, x, y]) => (
                  <line key={label} className="landing-flow-line" x1="250" y1="250" x2={x * 5} y2={y * 5} stroke="url(#landingLineGradient)" strokeWidth="2" />
                ))}
                <circle cx="250" cy="250" r="68" fill="#e1e0ff" opacity="0.55" />
                <circle cx="250" cy="250" r="52" fill="white" filter="url(#landingNodeShadow)" />
                <circle cx="250" cy="250" r="33" fill="#4648d4" opacity="0.08" />
                <text x="250" y="244" textAnchor="middle" fill="#4648d4" fontSize="14" fontWeight="800">ERPilot AI</text>
                <text x="250" y="267" textAnchor="middle" fill="#464554" fontSize="10">Brain</text>
                {flowNodes.map(([label, x, y]) => (
                  <g key={label} transform={`translate(${x * 5}, ${y * 5})`}>
                    <circle r="42" fill="#ffffff" filter="url(#landingNodeShadow)" />
                    <circle r="28" fill="#f2f3ff" />
                    <text dy="5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#131b2e">{label}</text>
                  </g>
                ))}
              </svg>
              {flowNodes.map(([label, x, y, Icon]) => (
                <div key={`${label}-icon`} className="pointer-events-none absolute grid size-8 -translate-x-1/2 -translate-y-14 place-items-center rounded-full border border-[#e1e0ff] bg-white text-[#4648d4] shadow-md" style={{ left: `${x}%`, top: `${y}%` }}>
                  <Icon className="size-4" />
                </div>
              ))}
              <div className="landing-pulse absolute left-[31%] top-[31%] size-4 rounded-full bg-[#4648d4] shadow-[0_0_26px_rgba(70,72,212,0.8)] blur-sm" />
              <div className="landing-pulse absolute bottom-[28%] right-[29%] size-4 rounded-full bg-[#6b38d4] shadow-[0_0_26px_rgba(107,56,212,0.85)] blur-sm" style={{ animationDelay: "1s" }} />
              <div className="absolute left-5 top-5 rounded-full border border-[#c7c4d7] bg-white/85 px-3 py-1 text-xs font-semibold text-[#464554] shadow-sm">+42.8k stock</div>
              <div className="absolute bottom-5 right-5 rounded-full border border-[#c7c4d7] bg-white/85 px-3 py-1 text-xs font-semibold text-[#464554] shadow-sm">99.2% traceability</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#e1e0ff]/70 bg-[#faf8ff] pb-20 pt-12" id="modules">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Integrated Manufacturing Engine</h2>
            <p className="mt-3 text-sm text-[#464554]">Standardized modules purpose-built for high-volume furniture production.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {moduleCards.map(([title, description, Icon], index) => (
              <a key={title} href={index === moduleCards.length - 1 ? "#erpilot" : "#inventory"} className={`group rounded-xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl ${index === moduleCards.length - 1 ? "border-[#6b38d4]/30 bg-[#8455ef]/10" : "border-[#c7c4d7]"}`}>
                <span className={`grid size-12 place-items-center rounded-lg transition ${index === moduleCards.length - 1 ? "bg-[#6b38d4]/15 text-[#6b38d4] group-hover:bg-[#6b38d4] group-hover:text-white" : "bg-[#6063ee]/15 text-[#4648d4] group-hover:bg-[#4648d4] group-hover:text-white"}`}><Icon className="size-5" /></span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#464554]">{description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#f2f3ff] py-20" id="inventory">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold tracking-tight">The Inventory <br />Movement Engine</h2>
            <div className="mt-10 space-y-7">
              {[["Sales Reservation", "Orders instantly reserve stock or trigger manufacturing requests for MTO items."], ["Procurement Sync", "Purchase receipts increase warehouse ledger values upon QC acceptance."], ["Production Consumption", "Manufacturing consumes components and produces finished goods with traceable stock moves."]].map(([title, text], index) => (
                <div key={title} className="flex gap-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#4648d4] font-bold text-white">{index + 1}</span>
                  <div><h3 className="font-semibold text-[#4648d4]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#464554]">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#c7c4d7] bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[#464554]">Live stock movement</p><h3 className="mt-1 text-xl font-semibold">Demand to Delivery Map</h3></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live API</span>
            </div>
            <div className="space-y-4">
              {["Vendor", "Raw Material", "Production", "Finished Goods", "Customer"].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-[#e1e0ff] text-[#4648d4]"><PackageCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm font-semibold"><span>{step}</span><span className="font-mono text-[#4648d4]">{index === 0 ? "+42.8k" : index === 4 ? "31.2k out" : "Active"}</span></div>
                    <div className="mt-2 h-2 rounded-full bg-[#eaedff]"><div className="h-full rounded-full bg-[#4648d4]" style={{ width: `${46 + index * 10}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#faf8ff] py-20" id="erpilot">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e9ddff] px-3 py-1 text-sm font-semibold text-[#23005c]"><BrainCircuit className="size-4" /> ERPilot AI</div>
            <h2 className="mt-5 text-4xl font-bold tracking-tight">Decision intelligence grounded in live ERP records.</h2>
            <p className="mt-4 text-base leading-8 text-[#464554]">Ask feasibility questions, detect bottlenecks, validate purchase needs, and explain why orders are delayed using the same records your teams work on every day.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="bg-[#4648d4] text-white hover:bg-[#3b3db9]"><Link to="/login">Open ERPilot</Link></Button>
              <Button variant="outline" asChild><Link to="/signup">Request Access</Link></Button>
            </div>
          </div>
          <div className="rounded-2xl border border-[#c7c4d7] bg-white p-5 shadow-xl">
            <div className="rounded-xl bg-[#f2f3ff] p-5">
              <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#4648d4] text-white"><Bot className="size-5" /></span><div><p className="font-semibold">Ask ERPilot</p><p className="text-xs text-[#464554]">Two-way assistant using live business records</p></div></div>
              <div className="space-y-3">
                <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-white p-4 text-sm shadow-sm">Can we fulfill the latest Dining Table order?</div>
                <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-sm bg-[#dcf8c6] p-4 text-sm shadow-sm">Check stock, procurement and production load.</div>
                <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-white p-4 text-sm shadow-sm">Risk is High. Review low-stock components and pending purchase receipts before confirmation.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#111827] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-[#6063ee] text-white"><GitBranch className="size-5" /></span>
              <div><p className="text-lg font-bold">FlowForge ERP</p><p className="text-xs uppercase tracking-[0.18em] text-white/45">Shiv Furniture Works</p></div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">
              Demand-to-delivery ERP for sales, procurement, manufacturing, inventory movement, audit traceability and ERPilot AI decision support.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Live stock ledger", "Role-aware access", "AI operations"].map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">{item}</span>)}
            </div>
          </div>
          <FooterColumn title="Product" links={[["Modules", "#modules"], ["Inventory Engine", "#inventory"], ["ERPilot AI", "#erpilot"], ["Demand Flow", "#modules"]]} />
          <FooterColumn title="Operations" links={[["Products", "#modules"], ["Sales Orders", "#modules"], ["Purchase Orders", "#modules"], ["Manufacturing", "#modules"]]} />
          <FooterColumn title="Governance" links={[["Audit Logs", "#modules"], ["Traceability", "#inventory"], ["Business Health", "#erpilot"], ["Access Control", "#erpilot"]]} />
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-white/50 sm:px-8 md:flex-row md:items-center md:justify-between">
            <p>© 2026 FlowForge ERP. Built for connected furniture manufacturing operations.</p>
            <div className="flex flex-wrap gap-4"><a href="#modules" className="hover:text-white">System Modules</a><a href="#inventory" className="hover:text-white">Inventory Movement</a><a href="#erpilot" className="hover:text-white">ERPilot AI</a></div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/45">{title}</h3>
      <div className="mt-4 grid gap-3">
        {links.map(([label, href]) => (
          <a key={label} href={href} className="text-sm text-white/72 transition hover:text-white">{label}</a>
        ))}
      </div>
    </div>
  );
}
