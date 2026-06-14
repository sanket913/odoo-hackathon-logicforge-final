import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, GitBranch, LoaderCircle, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/erp-ui";
import { useAuth } from "@/lib/auth";

const roles = ["Sales User", "Purchase User", "Manufacturing User", "Inventory Manager", "Business Owner"];
const seededAccounts = [
  { email: "admin@flowforge.com", password: "Admin@123", name: "Aarav Mehta", role: "Admin" },
  { email: "sales@flowforge.com", password: "Admin@123", name: "Priya Shah", role: "Sales User" },
  { email: "purchase@flowforge.com", password: "Admin@123", name: "Rohit Verma", role: "Purchase User" },
  { email: "mfg@flowforge.com", password: "Admin@123", name: "Ishita Rao", role: "Manufacturing User" },
  { email: "inventory@flowforge.com", password: "Admin@123", name: "Karan Singh", role: "Inventory Manager" },
] as const;

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate(); const auth = useAuth(); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", address: "", password: "", confirmPassword: "", requestedRole: "Sales User" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && form.password !== form.confirmPassword) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      if (mode === "login") { await auth.login(form.email.trim(), form.password); toast.success("Welcome to FlowForge ERP"); navigate({ to: "/$", params: { _splat: "dashboard" }, replace: true }); }
      else { const signedIn = await auth.register(form); toast.success(signedIn ? "Account created" : "Account request submitted"); navigate(signedIn ? { to: "/$", params: { _splat: "dashboard" }, replace: true } : { to: "/login", replace: true }); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Authentication failed"); } finally { setBusy(false); }
  };
  return <main className="grid min-h-screen bg-background lg:grid-cols-[0.85fr_1.15fr]">
    <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><GitBranch /></div><div><p className="font-semibold text-sidebar-accent-foreground">FlowForge ERP</p><p className="text-xs text-sidebar-foreground/60">ERPilot AI</p></div></div>
      <div className="my-auto max-w-lg"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-primary">Demand-to-delivery orchestration</p><h1 className="mt-5 text-4xl font-bold leading-tight text-sidebar-accent-foreground">Every stock movement, connected and explained.</h1><p className="mt-5 text-base leading-7 text-sidebar-foreground/70">Run sales, procurement, production and inventory from one transaction system built for Shiv Furniture Works.</p></div>
      <div className="grid gap-3 text-sm"><p className="flex items-center gap-2"><ShieldCheck className="size-4 text-sidebar-primary" />Role-aware operational access</p><p className="flex items-center gap-2"><LockKeyhole className="size-4 text-sidebar-primary" />Secure, API-backed business records</p></div>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-9"><div className="mb-7"><h2 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create Business Account"}</h2><p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Sign in to continue managing operations." : "Request role-based access to FlowForge ERP."}</p></div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {mode === "signup" && <><Field label="Name" required><input required value={form.name} onChange={e => set("name", e.target.value)} className={inputClass} maxLength={100} /></Field><Field label="Mobile Number" required><input required value={form.mobile} onChange={e => set("mobile", e.target.value)} className={inputClass} maxLength={20} /></Field></>}
        <Field label="Email ID" required><input type="email" required value={form.email} onChange={e => set("email", e.target.value)} className={inputClass} maxLength={255} /></Field>
        {mode === "signup" && <Field label="Requested Role" required><select value={form.requestedRole} onChange={e => set("requestedRole", e.target.value)} className={inputClass}>{roles.map(r => <option key={r}>{r}</option>)}</select></Field>}
        {mode === "signup" && <div className="sm:col-span-2"><Field label="Address" required><input required value={form.address} onChange={e => set("address", e.target.value)} className={inputClass} maxLength={300} /></Field></div>}
        <Field label="Password" required><div className="relative"><input type={showPassword ? "text" : "password"} required minLength={8} value={form.password} onChange={e => set("password", e.target.value)} className={`${inputClass} pr-11`} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>
        {mode === "signup" && <Field label="Confirm Password" required><div className="relative"><input type={showConfirmPassword ? "text" : "password"} required minLength={8} value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} className={`${inputClass} pr-11`} /><button type="button" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>}
        <Button disabled={busy} size="lg" className="mt-2 sm:col-span-2">{busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{mode === "login" ? "Login" : "Create Account"}</Button>
      </form>
      {mode === "login" && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><UserCheck className="size-3.5" /> Seeded Accounts - Click to auto-fill</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {seededAccounts.map((acc) => (
              <button key={acc.email} type="button" onClick={() => { set("email", acc.email); set("password", acc.password); }} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{acc.name[0]}</div>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{acc.name}</p><p className="truncate text-xs text-muted-foreground">{acc.role}</p></div>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-5 text-center text-sm text-muted-foreground">{mode === "login" ? "Need an account?" : "Already have access?"} <Link to={mode === "login" ? "/signup" : "/login"} className="font-semibold text-primary hover:underline">{mode === "login" ? "Sign up" : "Login"}</Link></p>
    </div></section>
  </main>;
}
