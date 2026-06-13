import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Inbox, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: () => void }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3">{back && <Button variant="outline" size="icon" onClick={back} aria-label="Back"><ArrowLeft /></Button>}<div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div></div><div className="flex flex-wrap gap-2">{actions}</div></div>;
}

export function StatusPill({ value }: { value?: string }) {
  const text = value || "Unknown"; const key = text.toLowerCase();
  const color = key.includes("cancel") || key.includes("late") || key.includes("blocked") || key.includes("inactive") ? "bg-rose-50 text-rose-700" : key.includes("done") || key.includes("deliver") || key.includes("receive") || key.includes("active") || key.includes("healthy") ? "bg-emerald-50 text-emerald-700" : key.includes("progress") || key.includes("confirm") ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>{text.replaceAll("_", " ")}</span>;
}

export function StatePanel({ type, message, retry }: { type: "loading" | "error" | "empty"; message?: string; retry?: () => void }) {
  const Icon = type === "loading" ? LoaderCircle : type === "error" ? AlertTriangle : Inbox;
  return <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-border bg-card"><div className="max-w-sm p-8 text-center"><Icon className={`mx-auto mb-3 size-8 ${type === "loading" ? "animate-spin text-primary" : type === "error" ? "text-destructive" : "text-muted-foreground"}`} /><h3 className="font-semibold">{type === "loading" ? "Loading live records" : type === "error" ? "Unable to load records" : "No records found"}</h3><p className="mt-1 text-sm text-muted-foreground">{message || (type === "empty" ? "Create a record or adjust your filters to get started." : "Please wait while the latest data is retrieved.")}</p>{retry && <Button variant="outline" className="mt-4" onClick={retry}><RefreshCw />Retry</Button>}</div></div>;
}

export function useApiData<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const reload = useCallback(() => { setLoading(true); setError(""); loader().then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, dependencies);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

export function Toolbar({ search, setSearch, children, onNew, newLabel }: { search: string; setSearch: (v: string) => void; children?: ReactNode; onNew?: () => void; newLabel?: string }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"><div className="relative min-w-72 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search live records..." className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:ring-2 focus:ring-ring" /></div>{children}{onNew && <Button className="shrink-0" onClick={onNew}><Plus />{newLabel || "New Record"}</Button>}</div>;
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{required && <span className="sr-only">required</span>}{children}</label>; }
export const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted";
export const textareaClass = "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring";

export function DataTable({ columns, rows, onRow, renderCell }: { columns: { key: string; label: string }[]; rows: Record<string, unknown>[]; onRow?: (row: Record<string, unknown>) => void; renderCell?: (key: string, value: unknown, row: Record<string, unknown>) => ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1080px] table-fixed text-left text-sm"><thead className="bg-muted/80"><tr>{columns.map(c => <th key={c.key} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className={`border-t border-border align-top ${index % 2 ? "bg-muted/20" : "bg-card"} ${onRow ? "cursor-pointer hover:bg-accent/45" : ""}`} onClick={() => onRow?.(row)}>{columns.map(c => <td key={c.key} className="px-4 py-4 leading-6 text-foreground"><div className="min-w-0 break-words">{renderCell ? renderCell(c.key, row[c.key], row) : String(row[c.key] ?? "-")}</div></td>)}</tr>)}</tbody></table></div></div>;
}

