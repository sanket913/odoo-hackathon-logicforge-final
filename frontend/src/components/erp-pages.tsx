import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, BadgeCheck, Bot, BriefcaseBusiness, Camera, Check, CheckCircle2, ClipboardCheck, Clock3, Eye, Factory, FileClock, GitBranch, Hourglass, LayoutGrid, List, Lock, Mail, MapPin, MessageSquare, Navigation, PackageCheck, Phone, Radio, RefreshCw, Save, Send, ShieldCheck, ShoppingCart, Sparkles, TimerReset, Trash2, Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiResource } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { DataTable, Field, PageHeader, StatePanel, StatusPill, Toolbar, inputClass, textareaClass, useApiData } from "@/components/erp-ui";

type Row = Record<string, unknown>;
type Config = { title: string; singular: string; description: string; resource: ApiResource; columns: { key: string; label: string }[]; filters?: string[] };

const configs: Record<string, Config> = {
  products: { title: "Products", singular: "Product", description: "Finished goods, components and their available stock.", resource: api.products, columns: [{key:"sku",label:"Reference / SKU"},{key:"name",label:"Product"},{key:"salesPrice",label:"Sales Price ₹"},{key:"costPrice",label:"Cost Price ₹"},{key:"onHandQty",label:"On Hand Qty"},{key:"availableQty",label:"Available Qty"},{key:"procurementType",label:"Procurement"},{key:"status",label:"Status"}] },
  customers: { title: "Customers", singular: "Customer", description: "Customer relationships and order activity.", resource: api.customers, columns: [{key:"name",label:"Customer Name"},{key:"company",label:"Company"},{key:"email",label:"Email"},{key:"phone",label:"Phone"},{key:"address",label:"Address"},{key:"totalOrders",label:"Total Orders"},{key:"status",label:"Status"}] },
  vendors: { title: "Vendors", singular: "Vendor", description: "Supplier performance, materials and lead times.", resource: api.vendors, columns: [{key:"name",label:"Vendor Name"},{key:"contactPerson",label:"Contact Person"},{key:"email",label:"Email"},{key:"phone",label:"Phone"},{key:"leadTimeDays",label:"Lead Time Days"},{key:"supplies",label:"Supplies"},{key:"reliability",label:"Reliability"},{key:"status",label:"Status"}] },
  bom: { title: "Bills of Materials", singular: "BoM", description: "Component recipes and work-center operations.", resource: api.bom, columns: [{key:"reference",label:"BoM Reference"},{key:"finishedProductName",label:"Finished Product"},{key:"quantity",label:"Quantity"},{key:"componentsCount",label:"Components Count"},{key:"operationsCount",label:"Operations Count"},{key:"status",label:"Status"}] },
  "sales-orders": { title: "Sale Orders", singular: "Sale Order", description: "Customer demand, stock reservations and deliveries.", resource: api.salesOrders, columns: [{key:"reference",label:"Reference"},{key:"date",label:"Date"},{key:"customerName",label:"Customer"},{key:"salespersonName",label:"Salesperson"},{key:"status",label:"Status"},{key:"total",label:"Total ₹"}] },
  "purchase-orders": { title: "Purchase Orders", singular: "Purchase Order", description: "Material replenishment and vendor receipts.", resource: api.purchaseOrders, columns: [{key:"reference",label:"Reference"},{key:"date",label:"Date"},{key:"vendorName",label:"Vendor"},{key:"purchasePersonName",label:"Purchase Person"},{key:"status",label:"Status"},{key:"total",label:"Total ₹"}] },
  "manufacturing-orders": { title: "Manufacturing Orders", singular: "Manufacturing Order", description: "Component consumption, work orders and finished production.", resource: api.manufacturingOrders, columns: [{key:"reference",label:"Reference"},{key:"scheduledDate",label:"Date"},{key:"finishedProductName",label:"Finished Product"},{key:"componentStatus",label:"Component Status"},{key:"quantity",label:"Quantity"},{key:"unit",label:"Unit"},{key:"status",label:"Status"}] },
};

const unwrapRows = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[];
  if (value && typeof value === "object") {
    const obj = value as Row; const candidates = [obj.items, obj.records, obj.results, obj.data];
    const found = candidates.find(Array.isArray); if (found) return found as Row[];
  }
  return [];
};

const currency = (value: unknown) => value === undefined || value === null ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateInputValue = (value: unknown, fallback = "") => String(value || fallback).slice(0, 10);

const formPayload = (section: string, form: Row) => {
  if (section === "customers") {
    return { name: form.name, company: form.company, email: form.email, phone: form.phone, address: form.address, status: form.status };
  }
  if (section === "vendors") {
    return { name: form.name, contactPerson: form.contactPerson, email: form.email, phone: form.phone, address: form.address, leadTimeDays: Number(form.leadTimeDays || 0), supplies: form.supplies, reliability: Number(form.reliability || 0), status: form.status };
  }
  if (section === "products") {
    return { name: form.name, sku: form.sku, salesPrice: Number(form.salesPrice || 0), costPrice: Number(form.costPrice || 0), onHand: Number(form.onHandQty ?? form.onHand ?? 0), reserved: Number(form.reservedQty ?? form.reserved ?? 0), procurementType: form.procurementType, vendorId: form.vendorId || undefined, bomId: form.bomId || undefined, active: String(form.status || "Active") === "Active" };
  }
  return form;
};

const isLateRow = (row: Row) => {
  const status = String(row.status ?? "").toLowerCase();
  if (["fully delivered", "delivered", "fully received", "received", "done", "cancelled"].some((done) => status.includes(done))) return false;
  const dateValue = row.expectedDate || row.scheduledDate || row.date || row.createdAt;
  if (!dateValue) return false;
  const due = new Date(String(dateValue));
  return Number.isFinite(due.getTime()) && due < new Date();
};

const statusMatches = (row: Row, selected: string) => {
  if (!selected) return true;
  if (selected.toLowerCase() === "late") return isLateRow(row);
  const normalize = (value: unknown) => String(value ?? "").toLowerCase().replaceAll("_", " ").replace(/^fully /, "").trim();
  return normalize(row.status) === normalize(selected);
};

const displayStatusFor = (row: Row, selected = "") => selected.toLowerCase() === "late" && isLateRow(row) ? "Late" : String(row.status ?? "");

function PaginationFooter({ page, setPage, rowsPerPage, setRowsPerPage, totalRows }: { page: number; setPage: (value: number | ((previous: number) => number)) => void; rowsPerPage: number; setRowsPerPage: (value: number) => void; totalRows: number }) {
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startRow = totalRows ? (safePage - 1) * rowsPerPage + 1 : 0;
  const endRow = Math.min(safePage * rowsPerPage, totalRows);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage, setPage]);
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 text-sm shadow-sm"><div className="text-muted-foreground">Showing <span className="font-medium text-foreground">{startRow}-{endRow}</span> of <span className="font-medium text-foreground">{totalRows}</span> records</div><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-muted-foreground">Rows per page<select className={inputClass + " h-10 w-28"} value={rowsPerPage} onChange={e=>{ setRowsPerPage(Number(e.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label><span className="font-medium">Page {safePage} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={safePage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</Button><Button variant="outline" size="sm" disabled={safePage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</Button></div></div></div>;
}

const pageSlice = (rows: Row[], page: number, rowsPerPage: number) => rows.slice((Math.min(page, Math.max(1, Math.ceil(rows.length / rowsPerPage))) - 1) * rowsPerPage, Math.min(page, Math.max(1, Math.ceil(rows.length / rowsPerPage))) * rowsPerPage);

export function ResourceList({ section }: { section: string }) {
  const config = configs[section]; const navigate = useNavigate(); const routeSearch = useRouterState({ select: (state) => state.location.search }) as Record<string, unknown>; const selectedStatus = String(routeSearch.status ?? ""); const selectedScope = String(routeSearch.scope ?? "");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(selectedStatus); const [view, setView] = useState<"list" | "kanban">("list"); const [page, setPage] = useState(1); const [rowsPerPage, setRowsPerPage] = useState(10);
  const { data, loading, error, reload } = useApiData(() => config.resource.list(), [section]);
  const rows = unwrapRows(data);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = Object.values(row).map((value) => String(value ?? "").toLowerCase()).join(" ");
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesStatus = statusMatches(row, status);
    return matchesSearch && matchesStatus;
  }), [rows, search, status]);
  const pageRows = pageSlice(filteredRows, page, rowsPerPage);
  useEffect(() => setStatus(selectedStatus), [selectedStatus, section]);
  useEffect(() => setPage(1), [section, search, status, rowsPerPage]);
  const open = (id: unknown) => navigate({ to: "/$", params: { _splat: `${section}/${id}` } });
  const remove = async (row: Row) => { if (!window.confirm(`Archive this ${config.singular.toLowerCase()}?`)) return; try { await config.resource.remove(String(row.id)); toast.success(`${config.singular} archived`); reload(); } catch(e) { toast.error(e instanceof Error ? e.message : "Action failed"); } };
  const orderStatusOptions = section === "sales-orders" ? ["Draft","Confirmed","Partially Delivered","Delivered","Late","Cancelled"] : section === "purchase-orders" ? ["Draft","Confirmed","Partially Received","Received","Late","Cancelled"] : section === "manufacturing-orders" ? ["Draft","Confirmed","In Progress","To Close","Done","Late","Cancelled"] : ["Draft","Confirmed","Active","Done","Cancelled"];
  return <><PageHeader title={config.title} description={status ? `${selectedScope === "my" ? "My" : "All"} records filtered by ${status}.` : config.description} /><Toolbar search={search} setSearch={setSearch} onNew={() => navigate({ to: "/$", params: { _splat: `${section}/new` } })} newLabel={`New ${config.singular}`}><select className={inputClass.replace("w-full", "") + " w-48 shrink-0"} value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{orderStatusOptions.map((option)=><option key={option}>{option}</option>)}</select>{section.includes("orders") && <div className="flex shrink-0 rounded-md border border-input p-0.5"><Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={()=>setView("list")}><List /></Button><Button variant={view === "kanban" ? "secondary" : "ghost"} size="icon" onClick={()=>setView("kanban")}><LayoutGrid /></Button></div>}</Toolbar>
    {loading ? <StatePanel type="loading" /> : error ? <StatePanel type="error" message={error} retry={reload} /> : !filteredRows.length ? <StatePanel type="empty" /> : view === "kanban" ? <Kanban rows={filteredRows} open={open} statusFilter={status} /> : <DataTable columns={[...config.columns, {key:"actions",label:"Actions"}]} rows={pageRows} onRow={(r)=>open(r.id)} renderCell={(key,value,row)=> key === "status" ? <StatusPill value={displayStatusFor(row, status)} /> : key === "actions" ? <div className="flex justify-center gap-1" onClick={e=>e.stopPropagation()}><Button variant="ghost" size="icon" onClick={()=>open(row.id)}><Eye /></Button><Button variant="ghost" size="icon" onClick={()=>remove(row)}><Trash2 className="text-destructive" /></Button></div> : key.toLowerCase().includes("price") || key === "total" ? currency(value) : String(value ?? "-")} />}
    {!loading && !error && Boolean(filteredRows.length) && view === "list" && <PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={filteredRows.length} />}</>;
}
function Kanban({ rows, open, statusFilter = "" }: { rows: Row[]; open: (id: unknown) => void; statusFilter?: string }) {
  const rowsWithDisplayStatus = rows.map((row) => ({ row, displayStatus: displayStatusFor(row, statusFilter) || "Draft" }));
  const statuses = [...new Set(rowsWithDisplayStatus.map((item) => item.displayStatus))];
  return <div className="grid gap-4 overflow-x-auto lg:grid-cols-3 xl:grid-cols-5">{statuses.map(status=><div key={status} className="min-w-60"><div className="mb-2 flex items-center justify-between"><StatusPill value={status}/><span className="text-xs text-muted-foreground">{rowsWithDisplayStatus.filter(item=>item.displayStatus===status).length}</span></div><div className="grid gap-2">{rowsWithDisplayStatus.filter(item=>item.displayStatus===status).map(({ row })=><button key={String(row.id)} onClick={()=>open(row.id)} className="rounded-lg border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"><p className="font-mono text-xs font-semibold text-primary">{String(row.reference || row.sku || row.id)}</p><p className="mt-3 font-semibold">{String(row.customerName || row.vendorName || row.finishedProductName || row.name || "Record")}</p><p className="mt-2 text-xs text-muted-foreground">{String(row.date || row.scheduledDate || "")}</p>{row.total !== undefined && <p className="mt-3 font-semibold">{currency(row.total)}</p>}</button>)}</div></div>)}</div>;
}

const defaultForm = { name:"", sku:"", reference:"", salesPrice:"", costPrice:"", onHandQty:"", reservedQty:"", procurementType:"Purchase", vendorId:"", bomId:"", status:"Active", company:"", email:"", phone:"", address:"", contactPerson:"", leadTimeDays:"", supplies:"", reliability:"", quantity:"", partnerId:"", assigneeId:"", scheduledDate:"", notes:"" };

export function RecordForm({ section, id }: { section: string; id?: string }) {
  if (section === "sales-orders") return <SalesOrderForm id={id} />;
  if (section === "purchase-orders") return <PurchaseOrderForm id={id} />;
  if (section === "manufacturing-orders") return <ManufacturingOrderForm id={id} />;
  if (section === "bom") return <BomForm id={id} />;
  const config = configs[section]; const navigate=useNavigate(); const isNew=!id || id==="new"; const [form,setForm]=useState<Row>(defaultForm); const [busy,setBusy]=useState(false);
  const { loading,error,reload }=useApiData(async()=>{ if(isNew) return null; const result=await config.resource.get<Row>(id); setForm(prev=>({...prev,...result})); return result; },[section,id]);
  const set=(k:string,v:unknown)=>setForm(p=>({...p,[k]:v})); const back=()=>navigate({to:"/$",params:{_splat:section}});
  const save=async(e?:FormEvent)=>{e?.preventDefault(); setBusy(true); try { const payload=formPayload(section, form); const result=isNew?await config.resource.create<Row>(payload):await config.resource.update<Row>(String(id),payload); toast.success(`${config.singular} saved`); const savedId=result?.id || id; if(savedId) navigate({to:"/$",params:{_splat:`${section}/${savedId}`},replace:true}); } catch(err){toast.error(err instanceof Error?err.message:"Save failed");} finally{setBusy(false);} };
  const action=async(name:string)=>{try{await config.resource.action(String(id),name);toast.success(`${name.replaceAll("-"," ")} completed`);reload();}catch(err){toast.error(err instanceof Error?err.message:"Action failed");}};
  if(loading&&!isNew)return <StatePanel type="loading"/>; if(error)return <StatePanel type="error" message={error} retry={reload}/>;
  const logs=()=>navigate({to:"/$",params:{_splat:`audit-logs?module=${encodeURIComponent(config.singular)}&recordId=${id}`}});
  const order=section.includes("orders"); const fields=section==="products"?["name","sku","salesPrice","costPrice","onHandQty","reservedQty","procurementType","vendorId","bomId","status"]:section==="customers"?["name","company","email","phone","address","status"]:section==="vendors"?["name","contactPerson","email","phone","address","leadTimeDays","supplies","reliability","status"]:section==="bom"?["reference","partnerId","quantity","notes","status"]:["reference","partnerId","scheduledDate","assigneeId","status","notes"];
  return <><PageHeader title={isNew?`New ${config.singular}`:String(form.reference||form.name||config.singular)} description={isNew?`Create a backend-backed ${config.singular.toLowerCase()} record.`:`Review and progress this ${config.singular.toLowerCase()}.`} back={back} actions={<>{!isNew&&<Button variant="outline" onClick={logs}><FileClock/>Logs</Button>}<Button onClick={()=>save()} disabled={busy}><Save/>{busy?"Saving…":"Save"}</Button>{!isNew&&order&&<><Button variant="outline" onClick={()=>action("confirm")}><Check/>Confirm</Button><Button onClick={()=>action(section==="sales-orders"?"deliver":section==="purchase-orders"?"receive":"start")}>{section==="sales-orders"?"Deliver":section==="purchase-orders"?"Receive":"Start"}</Button><Button variant="destructive" onClick={()=>action("cancel")}>Cancel</Button></>}</>} />
    <form onSubmit={save} className="grid gap-5"><section className="rounded-lg border border-border bg-card p-5"><h2 className="mb-5 font-semibold">General Information</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fields.map(key=><FormField key={key} field={key} value={form[key]} set={set} section={section} />)}</div></section>
    {(section==="bom"||order)&&<LineEditor title={section==="bom"?"Components":"Products"} fields={section==="bom"?["productId","quantity","units"]:["productId","orderedQuantity","completedQuantity","units","unitPrice"]} lines={(form.lines||form.components||[]) as Row[]} onChange={lines=>set(section==="bom"?"components":"lines",lines)} />}
    {section==="bom"&&<LineEditor title="Work Orders" fields={["operation","workCenter","expectedDuration"]} lines={(form.operations||[]) as Row[]} onChange={lines=>set("operations",lines)} />}
    {order&&<div className="flex justify-end rounded-lg border border-border bg-card p-5"><div className="text-right"><p className="text-sm text-muted-foreground">Total Amount</p><p className="text-2xl font-bold">{currency(form.total||0)}</p></div></div>}<button className="hidden" type="submit" /></form></>;
}

function FormField({field,value,set,section}:{field:string;value:unknown;set:(k:string,v:unknown)=>void;section:string}){
  const labels:Record<string,string>={name:section==="products"?"Product":section==="vendors"?"Vendor Name":"Name",sku:"SKU / Reference",reference:`${configs[section].singular} Reference`,salesPrice:"Sales Price ₹",costPrice:"Cost Price ₹",onHandQty:"On Hand Qty",reservedQty:"Reserved Qty",procurementType:"Procurement Type",vendorId:"Vendor",bomId:"Bill of Materials",status:"Status",company:"Company",email:"Email",phone:"Phone",address:"Address",contactPerson:"Contact Person",leadTimeDays:"Lead Time Days",supplies:"Supplies",reliability:"Reliability Score",quantity:"Quantity",partnerId:section==="sales-orders"?"Customer":section==="purchase-orders"?"Vendor":"Finished Product",assigneeId:"Assignee",scheduledDate:section==="purchase-orders"?"Order Date":"Schedule Date",notes:"Reference / Notes"};
  if(field==="bomId"&&section==="products"&&String((value??""))===""){} const numeric=["salesPrice","costPrice","onHandQty","reservedQty","leadTimeDays","reliability","quantity"].includes(field);
  if(["status","procurementType"].includes(field)){ const statusOptions = ["customers","vendors","products"].includes(section) ? ["Active","Archived"] : ["Draft","Confirmed","In Progress","Done","Cancelled"]; return <Field label={labels[field]}><select className={inputClass} value={String(value??"")} onChange={e=>set(field,e.target.value)}>{(field==="status"?statusOptions:["Purchase","Manufacturing"]).map(v=><option key={v}>{v}</option>)}</select></Field>; }
  return <Field label={labels[field]||field} required={["name","sku","reference","partnerId","quantity"].includes(field)}><input required={["name","sku","reference","partnerId","quantity"].includes(field)} type={numeric?"number":field.includes("Date")||field==="scheduledDate"?"date":field==="email"?"email":"text"} min={numeric?0:undefined} className={inputClass} value={String(value??"")} onChange={e=>set(field,e.target.value)} maxLength={numeric?undefined:300}/></Field>;
}

function BomForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"components" | "work">("components");
  const [form, setForm] = useState<Row>({ name: "", productId: "", quantity: 1, notes: "", status: "Active", components: [], operations: [] });
  const { data: bomsData } = useApiData(() => api.bom.list(), []);
  const { data: productsData } = useApiData(() => api.products.list(), []);
  const { loading, error, reload } = useApiData(async () => {
    if (isNew) return null;
    const result = await api.bom.get<Row>(String(id));
    setForm((prev) => ({ ...prev, ...result, name: result.name || result.reference || "", quantity: result.quantity || 1, components: (result.components as Row[]) || [], operations: (result.operations as Row[]) || [] }));
    return result;
  }, [id]);
  const products = unwrapRows(productsData);
  const components = ((form.components || []) as Row[]);
  const operations = ((form.operations || []) as Row[]);
  const nextReference = isNew ? `BOM-${String(unwrapRows(bomsData).length + 1).padStart(6, "0")}` : String(form.reference || form.name || "");
  const finishedProduct = products.find((p) => String(p.id) === String(form.productId));
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const addComponent = () => set("components", [...components, { productId: "", qty: "", units: "Units" }]);
  const addOperation = () => set("operations", [...operations, { name: "", workCenter: "", minutes: "" }]);
  const updateComponent = (index: number, key: string, value: unknown) => set("components", components.map((line, i) => i === index ? { ...line, [key]: value, units: "Units" } : line));
  const updateOperation = (index: number, key: string, value: unknown) => set("operations", operations.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const removeComponent = (index: number) => set("components", components.filter((_, i) => i !== index));
  const removeOperation = (index: number) => set("operations", operations.filter((_, i) => i !== index));
  const validate = () => {
    if (!form.productId) return "Finished Product is required";
    if (Number(form.quantity || 0) <= 0) return "Quantity must be greater than zero";
    if (!components.length) return "Add at least one component";
    if (components.some((line) => !line.productId || Number(line.qty ?? line.quantity ?? 0) <= 0)) return "Every component needs a product and quantity";
    if (!operations.length) return "Add at least one work order";
    if (operations.some((line) => !(line.name || line.operation) || !line.workCenter || Number(line.minutes ?? line.expectedDuration ?? 0) <= 0)) return "Every work order needs operation, work center and expected duration";
    return "";
  };
  const payload = () => ({
    name: String(form.name || nextReference),
    productId: form.productId,
    quantity: Number(form.quantity || 1),
    notes: form.notes || "",
    active: String(form.status || "Active") === "Active",
    components: components.map((line) => ({ productId: line.productId, qty: Number(line.qty ?? line.quantity ?? 0) })),
    operations: operations.map((line) => ({ name: line.name || line.operation, workCenter: line.workCenter, minutes: Number(line.minutes ?? line.expectedDuration ?? 0) })),
  });
  const save = async () => {
    const message = validate();
    if (message) { toast.error(message); return; }
    setBusy(true);
    try {
      const result = isNew ? await api.bom.create<Row>(payload()) : await api.bom.update<Row>(String(id), payload());
      toast.success("BoM saved");
      navigate({ to: "/$", params: { _splat: `bom/${result.id || id}` }, replace: true });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setBusy(false); }
  };
  const openLogs = () => navigate({ to: "/$", params: { _splat: "audit-logs" }, search: { module: "BoM", recordId: form.reference || form.name || id || nextReference } });
  if (loading && !isNew) return <StatePanel type="loading" />;
  if (error) return <StatePanel type="error" message={error} retry={reload} />;
  return <><div className="mb-5 rounded-lg border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="text-sm font-semibold text-muted-foreground">Bill of Materials</p><h1 className="mt-1 text-2xl font-bold">{isNew ? "New BoM" : nextReference}</h1></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => navigate({ to: "/$", params: { _splat: "bom" } })}>Back</Button><Button onClick={save} disabled={busy}><Save />{busy ? "Saving..." : "Save"}</Button><Button variant="outline" onClick={openLogs}><FileClock />Logs</Button></div></div><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="rounded-md border border-dashed border-border px-3 py-1.5 font-semibold">{nextReference || "BOM Auto"}</div><StatusPill value={String(form.status || "Active")} /></div></div>
    <div className="grid gap-5">
      <section className="rounded-lg border border-border bg-card p-5"><h2 className="mb-5 font-semibold">General Information</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="BoM Reference"><input disabled className={inputClass} value={nextReference} /></Field>
        <Field label="Finished Product" required><select required className={inputClass} value={String(form.productId || "")} onChange={(e) => set("productId", e.target.value)}><option value="">Select finished product</option>{products.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select></Field>
        <Field label="Quantity" required><input required type="number" min={1} className={inputClass} value={String(form.quantity || 1)} onChange={(e) => set("quantity", e.target.value)} /></Field>
        <Field label="Finished Product Preview"><input disabled className={inputClass} value={finishedProduct ? `${String(finishedProduct.name)} - ${String(finishedProduct.sku)}` : ""} /></Field>
        <Field label="Reference / Notes"><input className={inputClass} value={String(form.notes || "")} onChange={(e) => set("notes", e.target.value)} maxLength={300} /></Field>
        <Field label="Status"><select className={inputClass} value={String(form.status || "Active")} onChange={(e) => set("status", e.target.value)}><option>Active</option><option>Archived</option></select></Field>
      </div></section>
      <section className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Button type="button" variant={tab === "components" ? "secondary" : "outline"} onClick={() => setTab("components")}>Components</Button><Button type="button" variant={tab === "work" ? "secondary" : "outline"} onClick={() => setTab("work")}>Work Orders</Button></div>{tab === "components" ? <Button type="button" variant="outline" size="sm" onClick={addComponent}>Add a product</Button> : <Button type="button" variant="outline" size="sm" onClick={addOperation}>Add a line</Button>}</div>
        {tab === "components" ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">Components</th><th className="px-3 py-2">To Consume</th><th className="px-3 py-2">Units</th><th className="px-3 py-2"></th></tr></thead><tbody>{components.length ? components.map((line, index) => <tr key={index} className="border-b border-border align-top"><td className="px-3 py-3"><select required className={inputClass} value={String(line.productId || "")} onChange={(e) => updateComponent(index, "productId", e.target.value)}><option value="">Select component</option>{products.filter((p) => String(p.id) !== String(form.productId)).map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select></td><td className="px-3 py-3"><input required type="number" min={1} placeholder="Quantity" className={inputClass} value={String(line.qty ?? line.quantity ?? "")} onChange={(e) => updateComponent(index, "qty", e.target.value)} /></td><td className="px-3 py-3"><input disabled className={inputClass} value={String(line.units || "Units")} /></td><td className="px-3 py-3"><Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(index)}><Trash2 className="text-destructive" /></Button></td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Add products required to manufacture this finished product.</td></tr>}</tbody></table></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">Operations</th><th className="px-3 py-2">Work Center</th><th className="px-3 py-2">Expected Duration</th><th className="px-3 py-2"></th></tr></thead><tbody>{operations.length ? operations.map((line, index) => <tr key={index} className="border-b border-border align-top"><td className="px-3 py-3"><input required placeholder="Operation" className={inputClass} value={String(line.name || line.operation || "")} onChange={(e) => updateOperation(index, "name", e.target.value)} /></td><td className="px-3 py-3"><input required placeholder="Work Center" className={inputClass} value={String(line.workCenter || "")} onChange={(e) => updateOperation(index, "workCenter", e.target.value)} /></td><td className="px-3 py-3"><input required type="number" min={1} placeholder="Minutes" className={inputClass} value={String(line.minutes ?? line.expectedDuration ?? "")} onChange={(e) => updateOperation(index, "minutes", e.target.value)} /></td><td className="px-3 py-3"><Button type="button" variant="ghost" size="icon" onClick={() => removeOperation(index)}><Trash2 className="text-destructive" /></Button></td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Add operations that should become work orders on manufacturing orders.</td></tr>}</tbody></table></div>}
      </section>
    </div></>;
}

function SalesOrderForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [procurementActions, setProcurementActions] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({ customerId: "", date: today, salespersonName: "", status: "Draft", notes: "", lines: [] });
  const { data: salesOrdersData } = useApiData(() => api.salesOrders.list(), []);
  const { data: customersData } = useApiData(() => api.customers.list(), []);
  const { data: productsData } = useApiData(() => api.products.list(), []);
  const { data: usersData } = useApiData(() => api.users.list(), []);
  const { loading, error, reload } = useApiData(async () => {
    if (isNew) return null;
    const result = await api.salesOrders.get<Row>(String(id));
    const delivered = (result.deliveredQty || {}) as Row;
    setForm((prev) => ({ ...prev, ...result, salespersonName: result.salespersonName || result.createdBy || "", lines: ((result.lines as Row[]) || []).map((line) => {
      const product = unwrapRows(productsData).find((p) => String(p.id) === String(line.productId));
      return { ...line, deliveredQty: delivered[String(line.productId)] ?? 0, deliveryQty: Math.max(0, Number(line.qty || 0) - Number(delivered[String(line.productId)] || 0)), availability: Number(product?.availableQty ?? product?.freeToUse ?? 0) };
    }) }));
    return result;
  }, [id, productsData]);
  const customers = unwrapRows(customersData);
  const products = unwrapRows(productsData);
  const users = unwrapRows(usersData);
  const nextReference = isNew ? `SO-${1003 + unwrapRows(salesOrdersData).length}` : String(form.reference || form.number || "");
  const customer = customers.find((c) => String(c.id) === String(form.customerId));
  const lines = ((form.lines || []) as Row[]);
  const status = String(form.status || "Draft");
  const displayStatus = isLateRow(form) ? "Late" : status;
  const isReadonly = !isNew && !["Draft", ""].includes(status);
  const total = lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0), 0);
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateLine = (index: number, key: string, value: unknown) => set("lines", lines.map((line, i) => {
    if (i !== index) return line;
    const next = { ...line, [key]: value };
    if (key === "productId") {
      const product = products.find((p) => String(p.id) === String(value));
      next.unitPrice = Number(product?.salesPrice || 0);
      next.availability = Number(product?.availableQty ?? product?.freeToUse ?? 0);
      next.units = "Units";
    }
    return next;
  }));
  const addLine = () => set("lines", [...lines, { productId: "", availability: 0, qty: 1, deliveredQty: 0, deliveryQty: 1, units: "Units", unitPrice: 0 }]);
  const removeLine = (index: number) => set("lines", lines.filter((_, i) => i !== index));
  const validate = () => {
    if (!form.customerId) return "Customer is required";
    if (!form.date) return "Creation date is required";
    if (!form.salespersonName) return "Sales Person is required";
    if (!form.status) return "Status is required";
    if (!lines.length) return "Add at least one product line";
    if (lines.some((line) => !line.productId)) return "Product is required on every line";
    if (lines.some((line) => Number(line.qty || 0) <= 0)) return "Ordered quantity must be greater than zero on every line";
    if (lines.some((line) => Number(line.unitPrice || 0) <= 0)) return "Sales unit price must be greater than zero on every line";
    return "";
  };
  const payload = () => ({ customerId: form.customerId, date: form.date || today, createdBy: form.salespersonName, notes: form.notes || "", lines: lines.map((line) => ({ productId: line.productId, qty: Number(line.qty || 0), unitPrice: Number(line.unitPrice || 0) })) });
  const save = async () => {
    const message = validate();
    if (message) { toast.error(message); return null; }
    setBusy(true);
    try {
      const result = isNew ? await api.salesOrders.create<Row>(payload()) : await api.salesOrders.update<Row>(String(id), payload());
      toast.success("Sale Order saved");
      navigate({ to: "/$", params: { _splat: `sales-orders/${result.id || id}` }, replace: true });
      return result;
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); return null; }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    const message = validate();
    if (message) { toast.error(`Cannot confirm: ${message}`); return; }
    try {
      const target = isNew ? await save() : { id };
      if (!target?.id) return;
      const result = await api.salesOrders.action<Row>(String(target.id), "confirm");
      setProcurementActions((result.actions as Row[]) || []);
      toast.success("Sales order confirmed");
      reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Confirm failed"); }
  };
  const deliver = async () => {
    if (!deliveryMode) { setDeliveryMode(true); toast.info("Enter delivery quantities, then click Deliver again"); return; }
    const qtyMap = Object.fromEntries(lines.map((line) => [String(line.productId), Number(line.deliveryQty || 0)]));
    if (Object.values(qtyMap).every((qty) => Number(qty) <= 0)) { toast.error("Enter at least one delivery quantity"); return; }
    try { await api.salesOrders.action(String(id), "deliver", { qtyMap }); toast.success("Delivery updated"); setDeliveryMode(false); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delivery failed"); }
  };
  const cancel = async () => { try { await api.salesOrders.action(String(id), "cancel"); toast.success("Sales order cancelled"); reload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Cancel failed"); } };
  const openLogs = () => navigate({ to: "/$", params: { _splat: "audit-logs" }, search: { module: "SalesOrder", recordId: form.reference || form.number || id || nextReference } });
  const canConfirm = isNew || status === "Draft";
  const canDeliver = !isNew && ["Confirmed", "Partially Delivered", "Partially_Delivered"].includes(status);
  const canCancel = !isNew && !["Cancelled", "Fully Delivered", "Fully_Delivered"].includes(status);
  if (loading && !isNew) return <StatePanel type="loading" />;
  if (error) return <StatePanel type="error" message={error} retry={reload} />;
  return <><div className="mb-5 rounded-lg border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="text-sm font-semibold text-muted-foreground">Sales Order</p><h1 className="mt-1 text-2xl font-bold">{isNew ? "New Sale Order" : String(form.reference || form.number || "Sale Order")}</h1></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => navigate({ to: "/$", params: { _splat: "sales-orders" } })}>Back</Button><Button variant="outline" disabled={!canConfirm} onClick={confirm}><Check />Confirm</Button>{canDeliver && <Button onClick={deliver}>{deliveryMode ? "Post Delivery" : "Deliver"}</Button>}{canCancel && <Button variant="destructive" onClick={cancel}>Cancel</Button>}{!isReadonly && <Button onClick={save} disabled={busy}><Save />{busy ? "Saving..." : "Save"}</Button>}<Button variant="outline" onClick={openLogs}><FileClock />Logs</Button></div></div><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="rounded-md border border-dashed border-border px-3 py-1.5 font-semibold">{nextReference || "SO Auto"}</div><StatusPill value={displayStatus} /></div></div>
    <div className="grid gap-5">
      <section className="rounded-lg border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">General Information</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="SO Reference"><input disabled className={inputClass} value={nextReference} /></Field>
        <Field label="Customer" required><select required disabled={isReadonly} className={inputClass} value={String(form.customerId || "")} onChange={(e) => set("customerId", e.target.value)}><option value="">Select customer</option>{customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}</select></Field>
        <Field label="Creation Date" required><input required disabled={!isNew} type="date" className={inputClass} value={dateInputValue(form.date, today)} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Customer Address"><input disabled className={inputClass} value={String(customer?.address || "")} /></Field>
        <Field label="Sales Person" required><select required disabled={isReadonly} className={inputClass} value={String(form.salespersonName || "")} onChange={(e) => set("salespersonName", e.target.value)}><option value="">Select user</option>{users.map((u) => <option key={String(u.id)} value={String(u.name)}>{String(u.name)} - {String(u.role)}</option>)}</select></Field>
        <Field label="Reference / Notes"><input disabled={isReadonly} className={inputClass} value={String(form.notes || "")} onChange={(e) => set("notes", e.target.value)} maxLength={300} /></Field>
      </div></section>
      <section className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Products</h2>{!isReadonly && <Button type="button" variant="outline" size="sm" onClick={addLine}>Add a product</Button>}</div>{!lines.length ? <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Add at least one product line.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">Products</th><th className="px-3 py-2">Availability</th><th className="px-3 py-2">Ordered Quantity</th><th className="px-3 py-2">Delivered Quantity</th><th className="px-3 py-2">Units</th><th className="px-3 py-2">Sales Unit Price</th><th className="px-3 py-2">Total</th><th className="px-3 py-2"></th></tr></thead><tbody>{lines.map((line, index) => { const lineTotal = Number(line.qty || 0) * Number(line.unitPrice || 0); const shortage = Number(line.qty || 0) > Number(line.availability || 0); return <tr key={index} className="border-b border-border align-top"><td className="px-3 py-3"><select aria-label="Product" required disabled={isReadonly} className={inputClass} value={String(line.productId || "")} onChange={(e) => updateLine(index, "productId", e.target.value)}><option value="">Select product</option>{products.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select></td><td className="px-3 py-3"><div className={`flex h-10 items-center rounded-md border px-3 ${shortage ? "border-amber-300 bg-amber-50 text-amber-700" : "border-input bg-background"}`}>{String(line.availability ?? 0)}</div></td><td className="px-3 py-3"><input required disabled={isReadonly} aria-label="Ordered Quantity" type="number" min={1} placeholder="Qty" className={inputClass} value={String(line.qty ?? "")} onChange={(e) => updateLine(index, "qty", e.target.value)} /></td><td className="px-3 py-3">{deliveryMode ? <input aria-label="Deliver Quantity" type="number" min={0} max={Number(line.qty || 0) - Number(line.deliveredQty || 0)} className={inputClass} value={String(line.deliveryQty ?? "")} onChange={(e) => updateLine(index, "deliveryQty", e.target.value)} /> : <input disabled className={inputClass} value={String(line.deliveredQty ?? 0)} />}</td><td className="px-3 py-3"><input disabled className={inputClass} value={String(line.units || "Units")} /></td><td className="px-3 py-3"><input required disabled={isReadonly} aria-label="Sales Unit Price" type="number" min={1} className={inputClass} value={String(line.unitPrice ?? "")} onChange={(e) => updateLine(index, "unitPrice", e.target.value)} /></td><td className="px-3 py-3"><div className="flex h-10 items-center rounded-md border border-input bg-background px-3 font-semibold">INR {lineTotal.toLocaleString("en-IN")}</div></td><td className="px-3 py-3">{!isReadonly && <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}><Trash2 className="text-destructive" /></Button>}</td></tr> })}</tbody></table></div>}</section>
      {Boolean(procurementActions.length) && <section className="rounded-lg border border-border bg-card p-5"><h2 className="mb-4 font-semibold">Procurement Result</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{procurementActions.map((action, index) => <div key={index} className="rounded-md border border-border p-4"><p className="font-semibold">{String(action.productName)}</p><p className="mt-2 text-sm text-muted-foreground">Required Qty: {String(action.ordered)}</p><p className="text-sm text-muted-foreground">In Stock: {String(action.available)}</p><p className="text-sm text-muted-foreground">Shortage: {String(action.shortage)}</p><p className="mt-2 text-sm font-medium">{String(action.action)}</p></div>)}</div></section>}
      <section className="flex justify-end rounded-lg border border-border bg-card p-5"><div className="text-right"><p className="text-sm text-muted-foreground">Total Amount</p><p className="text-2xl font-bold">INR {total.toLocaleString("en-IN")}</p></div></section>
    </div></>;
}
function PurchaseOrderForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const [busy, setBusy] = useState(false);
  const [receiveMode, setReceiveMode] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Row>({ vendorId: "", date: today, expectedDate: today, responsiblePerson: "", status: "Draft", lines: [] });
  const { data: purchaseOrdersData } = useApiData(() => api.purchaseOrders.list(), []);
  const { data: vendorsData } = useApiData(() => api.vendors.list(), []);
  const { data: productsData } = useApiData(() => api.products.list(), []);
  const { data: usersData } = useApiData(() => api.users.list(), []);
  const { loading, error, reload } = useApiData(async () => {
    if (isNew) return null;
    const result = await api.purchaseOrders.get<Row>(String(id));
    const received = (result.receivedQty || {}) as Row;
    setForm((prev) => ({ ...prev, ...result, responsiblePerson: result.purchasePersonName || result.responsiblePerson || "", lines: ((result.lines as Row[]) || []).map((line) => {
      const receivedQty = Number(received[String(line.productId)] || 0);
      return { ...line, receivedQty, receiveQty: Math.max(0, Number(line.qty || 0) - receivedQty), units: "Units" };
    }) }));
    return result;
  }, [id, productsData]);
  const vendors = unwrapRows(vendorsData);
  const products = unwrapRows(productsData);
  const users = unwrapRows(usersData);
  const nextReference = isNew ? `PO-${3001 + unwrapRows(purchaseOrdersData).length}` : String(form.reference || form.number || "");
  const vendor = vendors.find((v) => String(v.id) === String(form.vendorId));
  const lines = ((form.lines || []) as Row[]);
  const status = String(form.status || "Draft");
  const displayStatus = isLateRow(form) ? "Late" : status;
  const receivedStatuses = ["Partially Received", "Partially_Received", "Fully Received", "Fully_Received", "Received"];
  const total = lines.reduce((sum, line) => {
    const quantity = receivedStatuses.includes(status) ? Number(line.receivedQty || 0) : Number(line.qty || 0);
    return sum + quantity * Number(line.unitPrice || 0);
  }, 0);
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateLine = (index: number, key: string, value: unknown) => set("lines", lines.map((line, i) => {
    if (i !== index) return line;
    const next = { ...line, [key]: value };
    if (key === "productId") {
      const product = products.find((p) => String(p.id) === String(value));
      next.unitPrice = Number(product?.costPrice || 0);
      next.units = "Units";
    }
    return next;
  }));
  const isReadonly = !isNew && status !== "Draft";
  const addLine = () => set("lines", [...lines, { productId: "", qty: "", receivedQty: 0, receiveQty: "", units: "Units", unitPrice: "" }]);
  const removeLine = (index: number) => set("lines", lines.filter((_, i) => i !== index));
  const validate = () => {
    if (!form.vendorId) return "Vendor is required";
    if (!form.date) return "Creation date is required";
    if (!form.responsiblePerson) return "Responsible Person is required";
    if (!form.status) return "Status is required";
    if (!lines.length) return "Add at least one product line";
    if (lines.some((line) => !line.productId)) return "Product is required on every line";
    if (lines.some((line) => Number(line.qty || 0) <= 0)) return "Ordered quantity must be greater than zero on every line";
    if (lines.some((line) => Number(line.unitPrice || 0) <= 0)) return "Cost unit price must be greater than zero on every line";
    return "";
  };
  const payload = () => ({
      vendorId: form.vendorId,
      date: form.date || today,
      expectedDate: form.expectedDate || form.date || today,
      responsiblePerson: form.responsiblePerson,
      lines: lines.map((line) => ({ productId: line.productId, qty: Number(line.qty || 0), unitPrice: Number(line.unitPrice || 0) })),
    });
  const save = async () => {
    const message = validate();
    if (message) { toast.error(message); return null; }
    setBusy(true);
    try {
      const result = isNew ? await api.purchaseOrders.create<Row>(payload()) : await api.purchaseOrders.update<Row>(String(id), payload());
      toast.success("Purchase Order saved");
      navigate({ to: "/$", params: { _splat: `purchase-orders/${result.id || id}` }, replace: true });
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    const message = validate();
    if (message) { toast.error(`Cannot confirm: ${message}`); return; }
    try {
      const target = isNew ? await save() : { id };
      if (!target?.id) return;
      await api.purchaseOrders.action(String(target.id), "confirm");
      toast.success("Purchase order confirmed");
      reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Confirm failed"); }
  };
  const receive = async () => {
    if (!receiveMode) { setReceiveMode(true); toast.info("Enter received quantities, then click Receive again"); return; }
    const qtyMap = Object.fromEntries(lines.map((line) => [String(line.productId), Math.min(Number(line.receiveQty || 0), Math.max(0, Number(line.qty || 0) - Number(line.receivedQty || 0)))]));
    if (Object.values(qtyMap).every((qty) => Number(qty) <= 0)) { toast.error("Enter at least one received quantity"); return; }
    try { await api.purchaseOrders.action(String(id), "receive", { qtyMap }); toast.success("Receipt posted"); setReceiveMode(false); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Receipt failed"); }
  };
  const cancel = async () => {
    try { await api.purchaseOrders.action(String(id), "cancel"); toast.success("Purchase order cancelled"); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Action failed"); }
  };
  const openLogs = () => navigate({ to: "/$", params: { _splat: "audit-logs" }, search: { module: "PurchaseOrder", recordId: form.reference || form.number || id || nextReference } });
  const canConfirm = isNew || status === "Draft";
  const canReceive = !isNew && ["Confirmed", "Partially Received", "Partially_Received"].includes(status);
  const canCancel = !isNew && !["Cancelled", "Fully Received", "Fully_Received", "Received"].includes(status);
  if (loading && !isNew) return <StatePanel type="loading" />;
  if (error) return <StatePanel type="error" message={error} retry={reload} />;
  return <><div className="mb-5 rounded-lg border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="text-sm font-semibold text-muted-foreground">Purchase Order</p><h1 className="mt-1 text-2xl font-bold">{isNew ? "New Purchase Order" : String(form.reference || form.number || "Purchase Order")}</h1></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => navigate({ to: "/$", params: { _splat: "purchase-orders" } })}>Back</Button><Button variant="outline" disabled={!canConfirm} onClick={confirm}><Check />Confirm</Button>{canReceive && <Button onClick={receive}>{receiveMode ? "Post Receipt" : "Receive"}</Button>}{canCancel && <Button variant="destructive" onClick={cancel}>Cancel</Button>}{!isReadonly && <Button onClick={save} disabled={busy}><Save />{busy ? "Saving..." : "Save"}</Button>}<Button variant="outline" onClick={openLogs}><FileClock />Logs</Button></div></div><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="rounded-md border border-dashed border-border px-3 py-1.5 font-semibold">{nextReference || "PO Auto"}</div><StatusPill value={displayStatus} /></div></div>
    <div className="grid gap-5">
      <section className="rounded-lg border border-border bg-card p-5"><h2 className="mb-5 font-semibold">General Information</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="PO Reference"><input disabled className={inputClass} value={nextReference} /></Field>
        <Field label="Vendor" required><select disabled={isReadonly} className={inputClass} value={String(form.vendorId || "")} onChange={(e) => set("vendorId", e.target.value)}><option value="">Select vendor</option>{vendors.map((v) => <option key={String(v.id)} value={String(v.id)}>{String(v.name)}</option>)}</select></Field>
        <Field label="Vendor Address"><input disabled className={inputClass} value={String(vendor?.address || "")} /></Field>
        <Field label="Creation Date" required><input required disabled={!isNew} type="date" className={inputClass} value={dateInputValue(form.date, today)} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Responsible Person" required><select required disabled={isReadonly} className={inputClass} value={String(form.responsiblePerson || "")} onChange={(e) => set("responsiblePerson", e.target.value)}><option value="">Select user</option>{users.map((u) => <option key={String(u.id)} value={String(u.name)}>{String(u.name)} - {String(u.role)}</option>)}</select></Field>
        <Field label="Status"><input disabled className={inputClass} value={isNew ? "Draft" : String(form.status || "Draft")} /></Field>
      </div></section>
      <section className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Products</h2>{!isReadonly && <Button type="button" variant="outline" size="sm" onClick={addLine}>Add a product</Button>}</div>{!lines.length ? <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Add at least one product line.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">Products</th><th className="px-3 py-2">Ordered Quantity</th><th className="px-3 py-2">Received Quantity</th><th className="px-3 py-2">Units</th><th className="px-3 py-2">Cost Unit Price</th><th className="px-3 py-2">Total</th><th className="px-3 py-2"></th></tr></thead><tbody>{lines.map((line, index) => { const qtyForTotal = receivedStatuses.includes(status) ? Number(line.receivedQty || 0) : Number(line.qty || 0); const lineTotal = qtyForTotal * Number(line.unitPrice || 0); const remaining = Math.max(0, Number(line.qty || 0) - Number(line.receivedQty || 0)); return <tr key={index} className="border-b border-border align-top"><td className="px-3 py-3"><select aria-label="Product" required disabled={isReadonly} className={inputClass} value={String(line.productId || "")} onChange={(e) => updateLine(index, "productId", e.target.value)}><option value="">Select product</option>{products.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select></td><td className="px-3 py-3"><input aria-label="Ordered Quantity" required disabled={isReadonly} placeholder="Ordered quantity" type="number" min={1} className={inputClass} value={String(line.qty ?? "")} onChange={(e) => updateLine(index, "qty", e.target.value)} /></td><td className="px-3 py-3">{receiveMode ? <input aria-label="Receive Quantity" placeholder={`Remaining ${remaining}`} type="number" min={0} max={remaining} className={inputClass} value={String(line.receiveQty ?? "")} onChange={(e) => updateLine(index, "receiveQty", e.target.value)} /> : <input aria-label="Received Quantity" type="number" min={0} className={inputClass} value={String(line.receivedQty ?? 0)} disabled />}</td><td className="px-3 py-3"><input disabled className={inputClass} value={String(line.units || "Units")} /></td><td className="px-3 py-3"><input aria-label="Cost Price" required disabled={isReadonly} placeholder="Cost price" type="number" min={1} className={inputClass} value={String(line.unitPrice ?? "")} onChange={(e) => updateLine(index, "unitPrice", e.target.value)} /></td><td className="px-3 py-3"><div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-semibold">INR {lineTotal.toLocaleString("en-IN")}</div></td><td className="px-3 py-3">{!isReadonly && <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}><Trash2 className="text-destructive" /></Button>}</td></tr>})}</tbody></table></div>}</section>
      <section className="flex justify-end rounded-lg border border-border bg-card p-5"><div className="text-right"><p className="text-sm text-muted-foreground">Total Amount</p><p className="text-2xl font-bold">INR {total.toLocaleString("en-IN")}</p></div></section>
    </div></>;
}

function ManufacturingOrderForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"components" | "work">("components");
  const [form, setForm] = useState<Row>({ productId: "", qty: 1, bomId: "", assignee: "", status: "Draft", scheduledDate: today, components: [], workOrders: [] });
  const { data: manufacturingData } = useApiData(() => api.manufacturingOrders.list(), []);
  const { data: productsData } = useApiData(() => api.products.list(), []);
  const { data: bomsData } = useApiData(() => api.bom.list(), []);
  const { data: usersData } = useApiData(() => api.users.list(), []);
  const { loading, error, reload } = useApiData(async () => {
    if (isNew) return null;
    const result = await api.manufacturingOrders.get<Row>(String(id));
    setForm((prev) => ({ ...prev, ...result, qty: result.qty || result.quantity || 1, assignee: result.assignee || result.assigneeName || "" }));
    return result;
  }, [id]);
  const products = unwrapRows(productsData);
  const boms = unwrapRows(bomsData);
  const users = unwrapRows(usersData);
  const nextReference = isNew ? `MO-${2001 + unwrapRows(manufacturingData).length}` : String(form.reference || form.number || "");
  const qty = Number(form.qty || form.quantity || 1);
  const status = String(form.status || "Draft");
  const selectedBom = boms.find((b) => String(b.id) === String(form.bomId));
  const matchingBoms = form.productId ? boms.filter((b) => String(b.productId) === String(form.productId)) : boms;
  const isDraft = status === "Draft";
  const isLocked = ["Done", "Cancelled"].includes(status);
  const headerLocked = !isNew && !isDraft;
  const openLogs = () => navigate({ to: "/$", params: { _splat: "audit-logs" }, search: { module: "ManufacturingOrder", recordId: form.reference || form.number || id || nextReference } });
  const canConfirm = isNew || isDraft;
  const canStart = !isNew && status === "Confirmed";
  const canProduce = !isNew && ["Confirmed", "In Progress", "In_Progress"].includes(status);
  const canCancel = !isNew && !isLocked;
  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const componentRows = ((form.components as Row[])?.length ? form.components as Row[] : ((selectedBom?.components as Row[]) || []).map((component) => {
    const product = products.find((p) => String(p.id) === String(component.productId));
    const availability = Number(product?.availableQty ?? product?.freeToUse ?? 0);
    const toConsume = Number(component.qty || 0) * qty;
    return { ...component, productName: product?.name || component.productName, availability, toConsume, consumedQty: status === "Done" ? toConsume : 0, units: "Units", componentStatus: availability >= toConsume ? "Available" : "Not Available" };
  }));
  const workRows = ((form.workOrders as Row[])?.length ? form.workOrders as Row[] : ((selectedBom?.operations as Row[]) || []).map((operation, index) => ({ id: `new-${index}`, name: operation.name, workCenter: operation.workCenter, minutes: Number(operation.minutes || 0) * qty, expectedDuration: Number(operation.minutes || 0) * qty, realDuration: 0, status: "Pending" })));
  const validate = () => {
    if (!form.productId) return "Finished product is required";
    if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be greater than zero";
    if (!form.scheduledDate) return "Schedule Date is required";
    if (!form.assignee) return "Assignee is required";
    if (!form.bomId) return "Bill of Materials is required";
    return "";
  };
  const payload = () => ({ productId: form.productId, qty, bomId: form.bomId, assignee: form.assignee, scheduledDate: form.scheduledDate || today });
  const save = async () => {
    const message = validate();
    if (message) { toast.error(message); return null; }
    setBusy(true);
    try {
      const result = isNew ? await api.manufacturingOrders.create<Row>(payload()) : await api.manufacturingOrders.update<Row>(String(id), payload());
      toast.success("Manufacturing Order saved");
      navigate({ to: "/$", params: { _splat: `manufacturing-orders/${result.id || id}` }, replace: true });
      return result;
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); return null; }
    finally { setBusy(false); }
  };
  const action = async (name: "confirm" | "start" | "produce" | "cancel") => {
    if (name === "confirm") {
      const message = validate();
      if (message) { toast.error(`Cannot confirm: ${message}`); return; }
    }
    try {
      const target = isNew ? await save() : { id };
      if (!target?.id) return;
      await api.manufacturingOrders.action(String(target.id), name);
      toast.success(`${name} completed`);
      reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Action failed"); }
  };
  if (loading && !isNew) return <StatePanel type="loading" />;
  if (error) return <StatePanel type="error" message={error} retry={reload} />;
  return <><div className="mb-5 rounded-lg border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="text-sm font-semibold text-muted-foreground">Manufacturing Order</p><h1 className="mt-1 text-2xl font-bold">{isNew ? "New Manufacturing Order" : nextReference}</h1></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" disabled={!canConfirm} onClick={() => action("confirm")}><Check />Confirm</Button>{canProduce && <Button onClick={() => action("produce")}><PackageCheck />Produce</Button>}{canStart && <Button variant="outline" onClick={() => action("start")}><TimerReset />Start</Button>}{canCancel && <Button variant="destructive" onClick={() => action("cancel")}>Cancel</Button>}<Button variant="outline" onClick={() => navigate({ to: "/$", params: { _splat: "manufacturing-orders" } })}>Back</Button>{!isLocked && isDraft && <Button onClick={save} disabled={busy}><Save />{busy ? "Saving..." : "Save"}</Button>}<Button variant="outline" onClick={openLogs}><FileClock />Logs</Button></div></div><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="rounded-md border border-dashed border-border px-3 py-1.5 font-semibold">{nextReference || "MO Auto"}</div><StatusPill value={status} /></div></div>
    <div className="grid gap-5">
      <section className="rounded-lg border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">General Information</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="MO Reference"><input disabled className={inputClass} value={nextReference} /></Field>
        <Field label="Finished Product" required><select required disabled={headerLocked || isLocked} className={inputClass} value={String(form.productId || "")} onChange={(e) => { set("productId", e.target.value); set("bomId", ""); set("components", []); set("workOrders", []); }}><option value="">Select finished product</option>{products.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select></Field>
        <Field label="Schedule Date" required><input required disabled={headerLocked || isLocked} type="date" className={inputClass} value={dateInputValue(form.scheduledDate, today)} onChange={(e) => set("scheduledDate", e.target.value)} /></Field>
        <Field label="Quantity" required><input required disabled={headerLocked || isLocked} type="number" min={1} className={inputClass} value={String(qty)} onChange={(e) => { set("qty", e.target.value); set("components", []); set("workOrders", []); }} /></Field>
        <Field label="Bill of Materials" required><select required disabled={headerLocked || isLocked || !form.productId} className={inputClass} value={String(form.bomId || "")} onChange={(e) => { set("bomId", e.target.value); set("components", []); set("workOrders", []); }}><option value="">Select BoM</option>{matchingBoms.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.name || b.reference)}</option>)}</select></Field>
        <Field label="Assignee" required><select required disabled={isLocked} className={inputClass} value={String(form.assignee || "")} onChange={(e) => set("assignee", e.target.value)}><option value="">Select user</option>{users.map((u) => <option key={String(u.id)} value={String(u.name)}>{String(u.name)} - {String(u.role)}</option>)}</select></Field>
      </div></section>
      <section className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex gap-2"><Button variant={tab === "components" ? "secondary" : "outline"} onClick={() => setTab("components")}>Components</Button><Button variant={tab === "work" ? "secondary" : "outline"} onClick={() => setTab("work")}>Work Orders</Button></div>
        {tab === "components" ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">Components</th><th className="px-3 py-2">Availability</th><th className="px-3 py-2">To Consume</th><th className="px-3 py-2">Units</th><th className="px-3 py-2">Consumed</th><th className="px-3 py-2">Units</th></tr></thead><tbody>{componentRows.length ? componentRows.map((row, index) => <tr key={index} className="border-b border-border"><td className="px-3 py-3 font-medium">{String(row.productName || row.productId)}</td><td className="px-3 py-3"><StatusPill value={String(row.componentStatus || "Available")} /></td><td className="px-3 py-3">{String(row.toConsume ?? 0)}</td><td className="px-3 py-3">Units</td><td className="px-3 py-3"><input disabled={isDraft || isLocked} type="number" min={0} className={inputClass + " max-w-32"} value={String(row.consumedQty ?? 0)} readOnly /></td><td className="px-3 py-3">Units</td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Select a BoM to load component lines.</td></tr>}</tbody></table></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2">Operation</th><th className="px-3 py-2">Work Center</th><th className="px-3 py-2">Expected Duration</th><th className="px-3 py-2">Real Duration</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{workRows.length ? workRows.map((row, index) => <tr key={String(row.id || index)} className="border-b border-border"><td className="px-3 py-3 font-medium">{String(row.name)}</td><td className="px-3 py-3">{String(row.workCenter)}</td><td className="px-3 py-3">{String(row.expectedDuration ?? row.minutes ?? 0)} min</td><td className="px-3 py-3"><input disabled={isDraft || isLocked} type="number" min={0} className={inputClass + " max-w-32"} value={String(row.realDuration ?? 0)} readOnly /></td><td className="px-3 py-3"><StatusPill value={String(row.status || "Pending")} /></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Select a BoM to load work orders.</td></tr>}</tbody></table></div>}
      </section>
    </div></>;
}

function LineEditor({title,fields,lines,onChange}:{title:string;fields:string[];lines:Row[];onChange:(v:Row[])=>void}){
  const add=()=>onChange([...lines,Object.fromEntries(fields.map(f=>[f,""]))]); const remove=(i:number)=>onChange(lines.filter((_,x)=>x!==i)); const update=(i:number,k:string,v:string)=>onChange(lines.map((line,x)=>x===i?{...line,[k]:v}:line));
  return <section className="rounded-lg border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><Button type="button" variant="outline" size="sm" onClick={add}>Add line</Button></div>{!lines.length?<div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Add at least one {title.toLowerCase()} line.</div>:<div className="grid gap-3">{lines.map((line,i)=><div key={i} className="grid gap-2 rounded-md bg-muted p-3 md:grid-cols-[repeat(5,minmax(0,1fr))_40px]">{fields.map(f=><input key={f} aria-label={f} placeholder={f.replace(/([A-Z])/g," $1")} type={f.toLowerCase().includes("quantity")||f.toLowerCase().includes("duration")||f.toLowerCase().includes("price")?"number":"text"} min={0} className={inputClass} value={String(line[f]??"")} onChange={e=>update(i,f,e.target.value)}/>)}<Button type="button" variant="ghost" size="icon" onClick={()=>remove(i)}><Trash2 className="text-destructive"/></Button></div>)}</div>}</section>;
}

const statusIcon = (status: string) => {
  const key = status.toLowerCase();
  if (key.includes("draft")) return FileClock;
  if (key.includes("confirm")) return CheckCircle2;
  if (key.includes("partial")) return Hourglass;
  if (key.includes("deliver") || key.includes("receive") || key.includes("done")) return PackageCheck;
  if (key.includes("progress")) return TimerReset;
  if (key.includes("late")) return AlertTriangle;
  return Activity;
};

const statusColor = (status: string) => {
  const key = status.toLowerCase();
  if (key.includes("late")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (key.includes("done") || key.includes("deliver") || key.includes("receive")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (key.includes("confirm") || key.includes("progress")) return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (key.includes("partial") || key.includes("draft") || key.includes("close")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-card text-primary";
};

export function DashboardPage(){
 const navigate=useNavigate();const {data,loading,error,reload}=useApiData(()=>api.dashboard.summary()); const d=(data||{}) as Row;
 if(loading)return <StatePanel type="loading"/>; if(error)return <StatePanel type="error" message={error} retry={reload}/>;
 const groups=[
  {key:"salesOrders",title:"Sale Orders",path:"sales-orders",Icon:ShoppingCart,accent:"text-violet-700 bg-violet-50 border-violet-200",statuses:["Draft","Confirmed","Partially Delivered","Delivered","Late"]},
  {key:"purchaseOrders",title:"Purchase Orders",path:"purchase-orders",Icon:Truck,accent:"text-sky-700 bg-sky-50 border-sky-200",statuses:["Draft","Confirmed","Partially Received","Received","Late"]},
  {key:"manufacturingOrders",title:"Manufacturing Orders",path:"manufacturing-orders",Icon:Factory,accent:"text-emerald-700 bg-emerald-50 border-emerald-200",statuses:["Draft","Confirmed","In Progress","To Close","Done","Late"]},
 ];
	 return <><PageHeader title="Operational Dashboard" description="Live demand, procurement, production and stock movement overview."/>
	  <div className="grid gap-5">{groups.map(g=>{const ModuleIcon=g.Icon;return <section key={g.key} className="rounded-lg border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className={`grid size-11 place-items-center rounded-lg border ${g.accent}`}><ModuleIcon className="size-5"/></div><div><h2 className="font-semibold">{g.title}</h2><p className="text-xs text-muted-foreground">Click a status to open filtered records</p></div></div><div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{g.statuses.reduce((sum,s)=>sum+Number(((d[g.key] as Row)?.[s] as number)??0),0)} total</div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{g.statuses.map(s=>{const Icon=statusIcon(s);const count=Number(((d[g.key] as Row)?.[s] as number)??0);return <button key={s} onClick={()=>navigate({to:"/$",params:{_splat:g.path},search:{status:s,scope:"all"}})} className={`group rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${statusColor(s)}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{s}</p><p className="mt-3 text-3xl font-bold text-foreground">{count}</p></div><div className="grid size-9 shrink-0 place-items-center rounded-md bg-white/70 text-current shadow-sm"><Icon className="size-4"/></div></div></button>})}</div></section>})}</div></>;
}

const auditActionKind = (action: string) => {
  const key = action.toUpperCase();
  if (key.includes("DELETE") || key.includes("CANCEL") || key.includes("REVOKE")) return "delete";
  if (key.includes("CREATE") || key.includes("AUTO")) return "create";
  return "update";
};
const normalizeAuditRow = (row: Row) => {
  const rawAction = String(row.action ?? "").trim();
  const action = !rawAction || rawAction === "undefined" ? "SYSTEM_EVENT" : rawAction;
  const module = String(row.module || row.entityType || row.recordType || "System");
  const recordId = String(row.recordId || row.entityId || "-");
  return { ...row, action, module, recordType: String(row.recordType || module), recordId, userName: String(row.userName || row.user || "System"), fieldChanged: String(row.fieldChanged || "Action"), oldValue: row.oldValue ?? "-", newValue: row.newValue ?? row.message ?? "-", createdAt: row.createdAt || row.timestamp };
};

function AuditLogsPage(){
 const [search,setSearch]=useState("");const [module,setModule]=useState("");const [user,setUser]=useState("");const [action,setAction]=useState("");const [recordId,setRecordId]=useState("");const [from,setFrom]=useState("");const [to,setTo]=useState("");const [page,setPage]=useState(1);const [rowsPerPage,setRowsPerPage]=useState(10);
 const {data,loading,error,reload}=useApiData(()=>api.audit.logs(),[]);
 useEffect(()=>{const timer=window.setInterval(reload,10000);return()=>window.clearInterval(timer)},[reload]);
 const rows=useMemo(()=>unwrapRows(data).map(normalizeAuditRow),[data]);
 const users=useMemo(()=>Array.from(new Set(rows.map(row=>String(row.userName)).filter(Boolean))).sort(),[rows]);
 const modules=useMemo(()=>Array.from(new Set(rows.map(row=>String(row.module)).filter(Boolean))).sort(),[rows]);
 const actions=useMemo(()=>Array.from(new Set(rows.map(row=>String(row.action)).filter(Boolean))).sort(),[rows]);
 const filteredRows=useMemo(()=>rows.filter(row=>{const haystack=[row.createdAt,row.userName,row.module,row.recordType,row.recordId,row.action,row.fieldChanged,row.oldValue,row.newValue,row.message].map(value=>String(value??"").toLowerCase()).join(" ");const created=row.createdAt?new Date(String(row.createdAt)):null;return(!search||haystack.includes(search.toLowerCase()))&&(!module||String(row.module)===module)&&(!user||String(row.userName)===user)&&(!action||String(row.action)===action)&&(!recordId||String(row.recordId).toLowerCase().includes(recordId.toLowerCase()))&&(!from||(created&&created>=new Date(from)))&&(!to||(created&&created<=new Date(`${to}T23:59:59`)))}),[rows,search,module,user,action,recordId,from,to]);
 const pageRows=pageSlice(filteredRows,page,rowsPerPage);useEffect(()=>setPage(1),[search,module,user,action,recordId,from,to,rowsPerPage]);
 const counts=useMemo(()=>({total:filteredRows.length,create:filteredRows.filter(row=>auditActionKind(String(row.action))==="create").length,update:filteredRows.filter(row=>auditActionKind(String(row.action))==="update").length,delete:filteredRows.filter(row=>auditActionKind(String(row.action))==="delete").length}),[filteredRows]);
 const maxCount=Math.max(counts.create,counts.update,counts.delete,1);
 const reset=()=>{setSearch("");setModule("");setUser("");setAction("");setRecordId("");setFrom("");setTo("")};
 const exportCsv=()=>{const headers=["Date & Time","User","Module","Record Type","Record ID","Action","Field Changed","Old Value","New Value"];const lines=filteredRows.map(row=>[row.createdAt,row.userName,row.module,row.recordType,row.recordId,row.action,row.fieldChanged,row.oldValue,row.newValue].map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(","));const blob=new Blob([[headers.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`flowforge-audit-logs-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url)};
 if(loading)return <StatePanel type="loading"/>;if(error)return <><PageHeader title="Audit Logs"/><StatePanel type="error" message={error} retry={reload}/></>;
 return <><div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><span>Administration</span><span>/</span><span className="font-semibold text-foreground">Audit Logs</span></div><h1 className="text-2xl font-bold">Audit Logs</h1><p className="mt-1 text-muted-foreground">System-wide traceability and compliance monitoring.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv}>Export CSV</Button><Button onClick={reload}><RefreshCw/>Refresh Logs</Button></div></div>
  <div className="mb-5 grid gap-4 md:grid-cols-4">{[["Total Logs",counts.total,"border-l-primary","bg-primary"],["Create Actions",counts.create,"border-l-emerald-500","bg-emerald-500"],["Update Actions",counts.update,"border-l-amber-500","bg-amber-500"],["Delete Actions",counts.delete,"border-l-rose-600","bg-rose-600"]].map(([label,count,border,bar])=><div key={String(label)} className={`rounded-xl border border-border border-l-4 ${String(border)} bg-card p-5 shadow-sm`}><p className="text-sm text-muted-foreground">{String(label)}</p><p className="mt-2 text-2xl font-bold">{Number(count).toLocaleString("en-IN")}</p>{String(label)==="Total Logs"?<p className="mt-4 text-sm font-semibold text-emerald-700">Live sync every 10s</p>:<div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${String(bar)}`} style={{width:`${Math.max(4,Math.round(Number(count)/maxCount*100))}%`}}/></div>}</div>)}</div>
  <section className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr_auto]"><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search<input className={inputClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search logs..." /></label><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date From<input className={inputClass} type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date To<input className={inputClass} type="date" value={to} onChange={e=>setTo(e.target.value)} /></label><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User<select className={inputClass} value={user} onChange={e=>setUser(e.target.value)}><option value="">All Users</option>{users.map(value=><option key={value}>{value}</option>)}</select></label><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module<select className={inputClass} value={module} onChange={e=>setModule(e.target.value)}><option value="">All Modules</option>{modules.map(value=><option key={value}>{value}</option>)}</select></label><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action<select className={inputClass} value={action} onChange={e=>setAction(e.target.value)}><option value="">All Actions</option>{actions.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><div className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><span>Record ID</span><div className="flex gap-2"><input className={inputClass+" min-w-0"} value={recordId} onChange={e=>setRecordId(e.target.value)} placeholder="ID..." /><Button type="button" variant="outline" onClick={reset}>Reset</Button></div></div></div></section>
  {!filteredRows.length?<StatePanel type="empty" message="No audit logs match these filters."/>:<section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-muted/70"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-5 py-4">Date & Time</th><th className="px-5 py-4">User</th><th className="px-5 py-4">Module</th><th className="px-5 py-4">Record Type</th><th className="px-5 py-4">Record ID</th><th className="px-5 py-4">Action</th><th className="px-5 py-4">Field</th><th className="px-5 py-4">Old Value</th><th className="px-5 py-4">New Value</th></tr></thead><tbody>{pageRows.map(row=><tr key={String(row.id)} className="border-t border-border align-middle hover:bg-muted/40"><td className="px-5 py-4 font-mono">{row.createdAt?new Date(String(row.createdAt)).toLocaleString():"-"}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{String(row.userName).slice(0,2).toUpperCase()}</span><span>{String(row.userName)}</span></div></td><td className="px-5 py-4">{String(row.module)}</td><td className="px-5 py-4">{String(row.recordType)}</td><td className="px-5 py-4 font-mono">{String(row.recordId)}</td><td className="px-5 py-4"><StatusPill value={String(row.action).replaceAll("_"," ")} /></td><td className="px-5 py-4 font-mono italic">{String(row.fieldChanged)}</td><td className="px-5 py-4">{String(row.oldValue??"-")}</td><td className="px-5 py-4">{String(row.newValue??"-")}</td></tr>)}</tbody></table></div><div className="border-t border-border"><PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={filteredRows.length}/></div></section>}
  <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-border py-3 text-xs uppercase tracking-[0.25em] text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500"/>System Online</span><span>Syncing: Just Now</span></div></>;
}

const flowTone = (tone: string) => tone === "incoming" ? { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", line: "bg-emerald-500", dot: "bg-emerald-500" } : tone === "outgoing" ? { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", line: "bg-orange-500", dot: "bg-orange-500" } : tone === "exception" ? { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-300", line: "bg-rose-500", dot: "bg-rose-500" } : tone === "production" ? { text: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-300", line: "bg-indigo-500", dot: "bg-indigo-500" } : { text: "text-primary", bg: "bg-primary/5", border: "border-primary/30", line: "bg-primary", dot: "bg-primary" };
function FlowMapPanel({map,summary,live}:{map:Row;summary:Row;live:string}){
 const edges=unwrapRows(map.edges);const apiNodes=unwrapRows(map.nodes);const nodeOrder=["Vendor","Raw Material","Production","Finished Goods","Customer"];const maxQty=Math.max(1,...edges.map(edge=>Number(edge.quantity||0)));const edgeByPair=(from:string,to:string)=>edges.find(edge=>String(edge.from)===from&&String(edge.to)===to);const nodeStats=(name:string)=>apiNodes.find(node=>String(node.name||node.id)===name)||{};const nodeDetail=(name:string,row:Row)=>name==="Vendor"?`${Number(row.outgoing||summary.incomingQty||0).toLocaleString("en-IN")} outbound`:name==="Raw Material"?`${Number(row.incoming||summary.incomingQty||0).toLocaleString("en-IN")} in / ${Number(row.outgoing||0).toLocaleString("en-IN")} to production`:name==="Production"?`${Number(row.incoming||0).toLocaleString("en-IN")} consumed / ${Number(row.outgoing||0).toLocaleString("en-IN")} produced`:name==="Finished Goods"?`${Number(row.incoming||0).toLocaleString("en-IN")} produced / ${Number(row.outgoing||summary.outgoingQty||0).toLocaleString("en-IN")} shipped`:`${Number(row.incoming||summary.outgoingQty||0).toLocaleString("en-IN")} delivered`;
 return <section className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="mb-8 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Interactive Flow Map</h2><p className="text-sm text-muted-foreground">Live logistics visualizer for Shiv Furniture Works</p></div><span className="flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-sm font-medium text-primary"><span className="size-2 rounded-full bg-primary flow-live-dot"/>{live==="Editing"?"Editing paused":live==="Paused"?"Polling paused":"Flow Active"}</span></div><div className="overflow-x-auto pb-2"><div className="grid min-w-[980px] grid-cols-[160px_96px_160px_96px_160px_96px_160px_96px_160px] items-center px-4 py-12">{nodeOrder.map((node,index)=>{const stats=nodeStats(node);const next=nodeOrder[index+1];const edge=next?edgeByPair(node,next):undefined;const tone=flowTone(String(edge?.tone||"transfer"));const width=Math.max(22,Math.round((Number(edge?.quantity||0)/maxQty)*92));return <><button key={node} className={`relative grid min-h-32 place-items-center rounded-xl border-2 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${Number(stats.movements||0)>0?"border-primary/30 bg-primary/5":"border-border bg-background"}`}><span className={`absolute -top-2 right-3 size-3 rounded-full ${Number(stats.movements||0)>0?"bg-emerald-500 flow-live-dot":"bg-muted"}`}/><p className="font-semibold uppercase tracking-wide">{node}</p><p className="mt-2 text-xs text-muted-foreground">{nodeDetail(node,stats)}</p><p className="mt-2 text-[11px] font-medium text-primary">{Number(stats.movements||0)} movements</p></button>{next&&<div key={`${node}-${next}`} className="relative h-16"><div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border"/>{edge&&<><div className={`absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full ${tone.line} flow-line`} style={{width:`${width}%`}}/><span className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full shadow ${tone.dot} flow-packet`}/><span className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-md border px-2 py-1 text-[11px] font-semibold ${tone.bg} ${tone.border} ${tone.text}`}>{Number(edge.quantity||0).toLocaleString("en-IN")}</span></>}</div>}</>})}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{edges.map(edge=>{const tone=flowTone(String(edge.tone||"transfer"));return <button key={String(edge.id)} className={`rounded-lg border p-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${tone.border} ${tone.bg}`}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{String(edge.from)} {" -> "} {String(edge.to)}</p><span className={`size-2 rounded-full ${tone.dot} flow-live-dot`}/></div><p className={`mt-1 ${tone.text}`}>{Number(edge.quantity||0).toLocaleString("en-IN")} qty / {String(edge.movements)} moves / {String(edge.uniqueProducts)} products</p><p className="mt-1 text-xs text-muted-foreground">Last movement {edge.latestAt?new Date(String(edge.latestAt)).toLocaleTimeString():"-"}</p></button>})}</div></section>;
}

function InventoryMovementPage(){
 const {user}=useAuth();const canManage=["Admin","Inventory Manager"].includes(String(user?.role));const [tab,setTab]=useState<"map"|"ledger"|"traceability"|"exceptions">("map");const [search,setSearch]=useState("");const [productId,setProductId]=useState("");const [movementType,setMovementType]=useState("");const [from,setFrom]=useState("");const [to,setTo]=useState("");const [page,setPage]=useState(1);const [rowsPerPage,setRowsPerPage]=useState(10);const [adjustOpen,setAdjustOpen]=useState(false);const [transferOpen,setTransferOpen]=useState(false);const [busy,setBusy]=useState(false);const [live,setLive]=useState<"Live"|"Paused"|"Editing">("Live");const operationOpen=adjustOpen||transferOpen||busy;
 const params={search,productId,movementType,from,to,page,rowsPerPage};const {data,loading,error,reload}=useApiData(()=>Promise.all([api.inventoryMovements.list(params),api.inventoryMovements.summary(params),api.inventoryMovements.map(params),api.inventoryMovements.traceability(params),api.inventoryMovements.exceptions(params),api.products.list()]).then(([ledger,summary,map,trace,exceptions,products])=>({ledger,summary,map,trace,exceptions,products})),[search,productId,movementType,from,to,page,rowsPerPage]);
 useEffect(()=>{const safeReload=()=>{if(operationOpen){setLive("Editing");return}setLive(document.visibilityState==="visible"?"Live":"Paused");if(document.visibilityState==="visible")reload()};const onFocus=()=>safeReload();window.addEventListener("focus",onFocus);const timer=window.setInterval(safeReload,12000);return()=>{window.removeEventListener("focus",onFocus);window.clearInterval(timer)}},[reload,operationOpen]);
 useEffect(()=>setPage(1),[search,productId,movementType,from,to,rowsPerPage]);
 if(loading)return <StatePanel type="loading"/>;if(error)return <StatePanel type="error" message={error} retry={reload}/>;
 const payload=(data||{}) as Row;const ledgerPayload=(payload.ledger||{}) as Row;const rows=unwrapRows(ledgerPayload.rows||payload.ledger);const totalRows=Number(ledgerPayload.total||rows.length);const products=unwrapRows(payload.products);const summary=(payload.summary||{}) as Row;const map=(payload.map||{}) as Row;const traceRows=unwrapRows(payload.trace);const exceptionRows=unwrapRows(payload.exceptions);const movementTypes=Array.from(new Set(rows.map(r=>String(r.movementType||r.type)).filter(Boolean))).sort();
 const submitAdjustment=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const body=Object.fromEntries(new FormData(event.currentTarget).entries());setBusy(true);try{await api.inventoryMovements.adjustment(body);toast.success("Stock adjustment posted");setAdjustOpen(false);reload()}catch(err){toast.error(err instanceof Error?err.message:"Adjustment failed")}finally{setBusy(false)}};
 const submitTransfer=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const body=Object.fromEntries(new FormData(event.currentTarget).entries());setBusy(true);try{await api.inventoryMovements.internalTransfer(body);toast.success("Internal transfer posted");setTransferOpen(false);reload()}catch(err){toast.error(err instanceof Error?err.message:"Transfer failed")}finally{setBusy(false)}};
 const exportCsv=()=>{const headers=["Date","Movement","Product","SKU","Type","Change","On Hand Before","On Hand After","Available Before","Available After","Reference","User","Status","Note"];const lines=rows.map(row=>[row.createdAt,row.movementNumber,row.productName,row.sku,row.movementType,row.quantityChange,row.onHandBefore,row.onHandAfter,row.availableBefore,row.availableAfter,row.referenceId,row.userName,row.status,row.note].map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(","));const blob=new Blob([[headers.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`inventory-movements-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)};
 const kpis=[["Total Movements",summary.totalMovements,"text-primary","Live ledger"],["Incoming Qty",summary.incomingQty,"text-emerald-700","Receipts and production"],["Outgoing Qty",summary.outgoingQty,"text-orange-700","Delivery and consumption"],["Reserved Qty",summary.reservedQty,"text-indigo-700","Committed demand"],["Internal Transfers",summary.internalTransfers,"text-foreground","Warehouse moves"],["Exceptions",summary.exceptions,"text-rose-700","Action required"]];
 return <><div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h1 className="text-2xl font-bold">Inventory Movement</h1></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="icon" onClick={reload}><RefreshCw/></Button><Button variant="outline" onClick={exportCsv}>Export CSV</Button>{canManage&&<Button variant="outline" onClick={()=>setTransferOpen(v=>!v)}>Create Internal Transfer</Button>}{canManage&&<Button onClick={()=>setAdjustOpen(v=>!v)}>Create Stock Adjustment</Button>}</div></div>
 {canManage&&(adjustOpen||transferOpen)&&<div className="mb-5 grid gap-4 lg:grid-cols-2">{adjustOpen&&<form onSubmit={submitAdjustment} className="rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="mb-3 font-semibold">Stock Adjustment</h2><div className="grid gap-3 sm:grid-cols-2"><select required name="productId" className={inputClass}><option value="">Product</option>{products.map(p=><option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select><select name="direction" className={inputClass}><option>Increase</option><option>Decrease</option></select><input required name="quantity" type="number" min={1} className={inputClass} placeholder="Quantity"/><select required name="reason" className={inputClass}><option value="">Reason</option><option>Physical count correction</option><option>Damaged stock</option><option>Lost stock</option><option>Opening stock</option><option>Data correction</option><option>Other</option></select><input required name="note" className={inputClass+" sm:col-span-2"} placeholder="Supporting note"/></div><Button className="mt-3" disabled={busy}>Post Adjustment</Button></form>}{transferOpen&&<form onSubmit={submitTransfer} className="rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="mb-3 font-semibold">Internal Transfer</h2><div className="grid gap-3 sm:grid-cols-2"><select required name="productId" className={inputClass}><option value="">Product</option>{products.map(p=><option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select><input required name="quantity" type="number" min={1} className={inputClass} placeholder="Quantity"/><input required name="sourceLocation" className={inputClass} placeholder="Source location"/><input required name="destinationLocation" className={inputClass} placeholder="Destination location"/><input name="note" className={inputClass+" sm:col-span-2"} placeholder="Note"/></div><Button className="mt-3" disabled={busy}>Post Transfer</Button></form>}</div>}
 <div className="mb-5 flex flex-wrap gap-2 border-b border-border">{[["map","Movement Map"],["ledger","Stock Ledger"],["traceability","Traceability"],["exceptions","Exceptions"]].map(([key,label])=><button key={key} onClick={()=>setTab(key as any)} className={`border-b-2 px-3 py-3 text-sm font-semibold uppercase tracking-wider ${tab===key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}<span className="ml-auto self-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{live}</span></div>
 <div className="mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">{kpis.map(([label,value,color,detail])=><div key={String(label)} className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">{String(label)}</p><p className={`mt-2 text-2xl font-bold ${String(color)}`}>{Number(value||0).toLocaleString("en-IN")}</p><p className="mt-3 text-xs text-muted-foreground">{String(detail)}</p></div>)}</div>
 <section className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input className={inputClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search movements, lots or products..."/><input type="date" className={inputClass} value={from} onChange={e=>setFrom(e.target.value)}/><input type="date" className={inputClass} value={to} onChange={e=>setTo(e.target.value)}/><select className={inputClass} value={productId} onChange={e=>setProductId(e.target.value)}><option value="">All Products</option>{products.map(p=><option key={String(p.id)} value={String(p.id)}>{String(p.name)} - {String(p.sku)}</option>)}</select><select className={inputClass} value={movementType} onChange={e=>setMovementType(e.target.value)}><option value="">All Types</option>{movementTypes.map(type=><option key={type}>{type}</option>)}</select></div></section>
 {tab==="map"&&<FlowMapPanel map={map} summary={summary} live={live}/>}
 {tab==="ledger"&&<><DataTable columns={[{key:"createdAt",label:"Date & Time"},{key:"movementNumber",label:"Movement ID"},{key:"productName",label:"Product"},{key:"sku",label:"SKU"},{key:"movementType",label:"Movement Type"},{key:"quantityChange",label:"Qty Change"},{key:"onHandBefore",label:"On Hand Before"},{key:"onHandAfter",label:"On Hand After"},{key:"availableBefore",label:"Available Before"},{key:"availableAfter",label:"Available After"},{key:"referenceType",label:"Reference Type"},{key:"referenceId",label:"Reference ID"},{key:"userName",label:"User"},{key:"status",label:"Status"},{key:"note",label:"Note"}]} rows={rows} renderCell={(k,v)=>k==="movementType"||k==="status"?<StatusPill value={String(v)}/>:k==="quantityChange"?<span className={`font-mono font-semibold ${Number(v)>=0?"text-emerald-700":"text-rose-700"}`}>{Number(v)>0?"+":""}{String(v)}</span>:String(v??"-")}/><PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={totalRows}/></>}
 {tab==="traceability"&&<section className="rounded-xl border border-border bg-card p-4 shadow-sm">{!traceRows.length?<StatePanel type="empty" message="No traceability records match these filters."/>:<div className="grid gap-3">{traceRows.map(row=><button key={String(row.id)} className="rounded-lg border border-border p-4 text-left hover:border-primary"><p className="font-semibold">{String(row.path)}</p><p className="mt-1 text-sm text-muted-foreground">{String(row.referenceType)} {String(row.referenceId)} / {String(row.occurredAt)}</p></button>)}</div>}</section>}
 {tab==="exceptions"&&<>{!exceptionRows.length?<StatePanel type="empty" message="No inventory exceptions detected."/>:<DataTable columns={[{key:"severity",label:"Severity"},{key:"detectedAt",label:"Detection Time"},{key:"product",label:"Product"},{key:"problem",label:"Problem"},{key:"expected",label:"Expected"},{key:"actual",label:"Actual"},{key:"reference",label:"Reference"},{key:"assignedUser",label:"Assigned User"},{key:"status",label:"Status"}]} rows={exceptionRows} renderCell={(k,v)=>k==="severity"||k==="status"?<StatusPill value={String(v)}/>:String(v??"-")}/>}</>}
 <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-border py-3 text-xs uppercase tracking-[0.25em] text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500"/>DB Sync: Optimal</span><span>Backend source of truth</span></div></>;
}

export function LedgerPage({audit=false}:{audit?:boolean}){
 if(audit)return <AuditLogsPage/>;
 return <InventoryMovementPage/>;
 const [search,setSearch]=useState(""); const [page,setPage]=useState(1); const [rowsPerPage,setRowsPerPage]=useState(10); const {data,loading,error,reload}=useApiData(()=>audit?api.audit.logs({search}):api.stock.stockMoves({search}),[search]); const rows=unwrapRows(data); const pageRows=pageSlice(rows,page,rowsPerPage);
 useEffect(()=>setPage(1),[search,audit,rowsPerPage]);
 const cols=audit?[{key:"createdAt",label:"Date & Time"},{key:"userName",label:"User"},{key:"module",label:"Module"},{key:"recordType",label:"Record Type"},{key:"recordId",label:"Record ID"},{key:"action",label:"Action"},{key:"fieldChanged",label:"Field Changed"},{key:"oldValue",label:"Old Value"},{key:"newValue",label:"New Value"}]:[{key:"createdAt",label:"Date & Time"},{key:"productName",label:"Product"},{key:"movementType",label:"Movement Type"},{key:"quantityChange",label:"Quantity Change"},{key:"beforeQty",label:"Before Qty"},{key:"afterQty",label:"After Qty"},{key:"referenceType",label:"Reference Type"},{key:"referenceId",label:"Reference ID"},{key:"userName",label:"User"},{key:"note",label:"Note"}];
 return <><PageHeader title={audit?"Audit Logs":"Stock Ledger"} description={audit?"Trace every important business action and field change.":"Every reservation, receipt, consumption and production movement."}/><Toolbar search={search} setSearch={setSearch}/>{loading?<StatePanel type="loading"/>:error?<StatePanel type="error" message={error} retry={reload}/>:!rows.length?<StatePanel type="empty"/>:<><DataTable columns={cols} rows={pageRows} renderCell={(k,v)=>k==="action"?<StatusPill value={String(v)}/>:k==="quantityChange"?<span className={`font-mono font-semibold ${Number(v)>=0?"text-emerald-700":"text-rose-700"}`}>{Number(v)>0?"+":""}{String(v)}</span>:String(v??"—")}/><PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={rows.length}/></>}</>;
}

export function ERPilotPage(){
 const [question,setQuestion]=useState("");
 const [messages,setMessages]=useState<Array<{id:string;role:"assistant"|"user";text:string;meta?:Row}>>([{id:"welcome",role:"assistant",text:"Hi, I am ERPilot. Ask me about orders, stock, production, vendors, alerts, or why a business flow is blocked."}]);
 const [busy,setBusy]=useState(false);
 const chatEndRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth",block:"end"});},[messages,busy]);
 const replyText=(data:Row)=>String(data.answer||data.message||data.summary||data.recommendation||"Analysis complete.");
 const askQuestion=async(nextQuestion=question)=>{const text=nextQuestion.trim();if(!text||busy)return;const userMessage={id:`u-${Date.now()}`,role:"user" as const,text};const history=[...messages,userMessage].slice(-10).map(({role,text})=>({role,content:text}));setMessages(prev=>[...prev,userMessage]);setQuestion("");setBusy(true);try{const data=await api.erpilot.chat({message:text,question:text,conversation:history}) as Row;setMessages(prev=>[...prev,{id:`a-${Date.now()}`,role:"assistant",text:replyText(data),meta:data}]);}catch(err){const errorText=err instanceof Error?err.message:"ERPilot is unavailable";setMessages(prev=>[...prev,{id:`a-${Date.now()}`,role:"assistant",text:errorText,meta:{risk:"High"}}]);toast.error(errorText);}finally{setBusy(false)}};
 const ask=async(e:FormEvent)=>{e.preventDefault();askQuestion()};
 const prompts=["Can I fulfill the latest sales order?","What should I purchase next?","Which product is low stock?","Why is this order delayed?"];
 const actions=["Order Feasibility","What-If Simulator","Business Health","Root Cause Analysis","Vendor Recommendation","Bottleneck Detection"];
 return <><PageHeader title="ERPilot AI" description="Decision intelligence grounded in current ERP transactions."/><div className="grid gap-5 xl:grid-cols-[1fr_320px]"><section className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border p-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles/></div><div><h2 className="font-semibold">Ask ERPilot</h2><p className="text-xs text-muted-foreground">Two-way assistant using live business records</p></div></div></div><div className="h-[56vh] min-h-[430px] space-y-4 overflow-y-auto bg-muted/20 p-5">{messages.map(message=><div key={message.id} className={`flex ${message.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role==="user"?"rounded-br-sm bg-primary text-primary-foreground":"rounded-bl-sm border border-border bg-card text-card-foreground"}`}><div className="flex items-start gap-2"><span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${message.role==="user"?"bg-primary-foreground/15":"bg-primary/10 text-primary"}`}>{message.role==="user"?"You":<Bot className="size-4"/>}</span><div className="min-w-0"><p className="whitespace-pre-wrap leading-6">{message.text}</p>{message.role==="assistant"&&message.meta&&<div className="mt-3 flex flex-wrap items-center gap-2">{(message.meta.riskLevel||message.meta.risk)&&<StatusPill value={String(message.meta.riskLevel||message.meta.risk)}/>}</div>}{message.role==="assistant"&&Array.isArray(message.meta?.recommendations)&&Boolean((message.meta.recommendations as unknown[]).length)&&<ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{(message.meta.recommendations as unknown[]).slice(0,3).map((item,index)=><li key={index}>{typeof item==="string"?item:JSON.stringify(item)}</li>)}</ul>}</div></div></div></div>)}{busy&&<div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm shadow-sm"><span className="flex items-center gap-2 text-muted-foreground"><Activity className="size-4 animate-spin"/>ERPilot is thinking...</span></div></div>}<div ref={chatEndRef}/></div><div className="border-t border-border p-4"><div className="mb-3 flex flex-wrap gap-2">{prompts.map(q=><button type="button" key={q} disabled={busy} onClick={()=>askQuestion(q)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60">{q}</button>)}</div><form onSubmit={ask} className="flex gap-2"><input className={inputClass} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} placeholder="Message ERPilot..."/><Button disabled={busy||!question.trim()}>{busy?<Activity className="animate-spin"/>:<Send/>}</Button></form></div></section><aside className="grid content-start gap-3">{actions.map(x=><button type="button" key={x} disabled={busy} onClick={()=>askQuestion(x)} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary disabled:cursor-wait disabled:opacity-60"><MessageSquare className="size-4 text-primary"/><span className="text-sm font-semibold">{x}</span></button>)}</aside></div></>;
}

function LegacyERPilotPage(){
 const [question,setQuestion]=useState("");const [answer,setAnswer]=useState<Row|null>(null);const [busy,setBusy]=useState(false);
 const askQuestion=async(nextQuestion=question)=>{const text=nextQuestion.trim();if(!text)return;setQuestion(text);setBusy(true);try{setAnswer(await api.erpilot.chat({message:text,conversation:[]} ) as Row);}catch(err){toast.error(err instanceof Error?err.message:"ERPilot is unavailable");}finally{setBusy(false)}};
 const ask=async(e:FormEvent)=>{e.preventDefault();askQuestion()};
  return <><PageHeader title="ERPilot AI" description="Decision intelligence grounded in current ERP transactions."/><div className="grid gap-5 xl:grid-cols-[1fr_320px]"><section className="rounded-lg border border-border bg-card"><div className="border-b border-border p-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles/></div><div><h2 className="font-semibold">Ask ERPilot</h2><p className="text-xs text-muted-foreground">Answers use live business records</p></div></div></div><div className="min-h-96 p-5">{!answer?<div className="grid h-80 place-items-center text-center"><div><Bot className="mx-auto size-10 text-primary"/><h3 className="mt-4 font-semibold">What should we decide next?</h3><div className="mt-4 flex flex-wrap justify-center gap-2">{["Can I fulfill the latest sales order?","What should I purchase next?","Which product is low stock?","Why is this order delayed?"].map(q=><button key={q} onClick={()=>setQuestion(q)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">{q}</button>)}</div></div></div>:<div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Answer</p><p className="mt-2 leading-7">{String(answer.answer||answer.message||"Analysis complete.")}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Level</p><div className="mt-2"><StatusPill value={String(answer.riskLevel||answer.risk||"Healthy")}/></div></div>{Boolean(answer.recommendations)&&<div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommendations</p><p className="mt-2 text-sm">{Array.isArray(answer.recommendations)?answer.recommendations.join(" • "):String(answer.recommendations)}</p></div>}</div>}</div><form onSubmit={ask} className="flex gap-2 border-t border-border p-4"><input className={inputClass} value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} placeholder="Ask about demand, stock, vendors or delays…"/><Button disabled={busy||!question.trim()}>{busy?<Activity className="animate-spin"/>:<Send/>}</Button></form></section><aside className="grid content-start gap-3">{["Order Feasibility","What-If Simulator","Business Health","Root Cause Analysis","Vendor Recommendation","Bottleneck Detection"].map(x=><button key={x} onClick={()=>setQuestion(x)} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary"><MessageSquare className="size-4 text-primary"/><span className="text-sm font-semibold">{x}</span></button>)}</aside></div></>;
}

export function DigitalTwinPage(){
  const navigate=useNavigate();const {data,loading,error,reload}=useApiData(()=>api.erpilot.digitalTwin());
  useEffect(()=>{const timer=window.setInterval(reload,5000);return()=>window.clearInterval(timer)},[reload]);
  if(loading)return <StatePanel type="loading"/>;if(error)return <StatePanel type="error" message={error} retry={reload}/>;
  const payload=(data||{}) as Row;const nodes=unwrapRows(payload.nodes||data);const metrics=(payload.metrics||{}) as Row;
  const iconFor=(node:Row)=>{const id=String(node.id||node.node||"").toLowerCase();if(id.includes("customer"))return <ShoppingCart/>;if(id.includes("procurement"))return <ClipboardCheck/>;if(id.includes("raw"))return <PackageCheck/>;if(id.includes("manufacturing"))return <Factory/>;if(id.includes("finished"))return <CheckCircle2/>;if(id.includes("delivery"))return <Truck/>;return <GitBranch/>};
  const gridClass="relative grid gap-6 p-7 md:grid-cols-3 md:gap-x-24 md:gap-y-28";
  const updatedAt=payload.updatedAt?new Date(String(payload.updatedAt)).toLocaleTimeString():"now";
  return <><div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Digital Twin: Shiv Furniture Works</h1><p className="mt-2 flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-emerald-500"/><span>Live Feed Sync: Active ({String(payload.latencyMs??400)}ms latency) · Updated {updatedAt}</span></p></div><div className="flex w-full max-w-sm divide-x divide-border rounded-lg border border-border bg-card p-4 shadow-sm"><div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Efficiency</p><p className="text-2xl font-bold text-primary">{String(metrics.efficiency??0)}%</p></div><div className="flex-1 pl-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Throughput</p><p className="text-2xl font-bold text-primary">{String(metrics.throughput??0)}/hr</p></div></div></div>{!nodes.length?<StatePanel type="empty" message="No active business flow yet. Create a sales order to begin."/>:<section className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm" style={{backgroundImage:"radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",backgroundSize:"24px 24px"}}><div className="pointer-events-none absolute left-[13%] right-[13%] top-[35%] hidden border-t-2 border-dashed border-primary/20 md:block"/><div className="pointer-events-none absolute left-[13%] right-[13%] bottom-[35%] hidden border-t-2 border-dashed border-primary/20 md:block"/><div className={gridClass}>{nodes.map((n,i)=><button key={String(n.id??i)} onClick={()=>navigate({to:"/$",params:{_splat:String(n.path||"dashboard").replace(/^\//,"")}})} className={`relative min-h-48 rounded-xl border-2 bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${String(n.status)==="Warning"?"border-amber-400":String(n.status)==="Active"?"border-primary border-dashed":"border-primary"}`}><div className="flex items-start justify-between gap-4"><div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-6">{iconFor(n)}</div><StatusPill value={String(n.status||"Healthy")}/></div><p className="mt-7 text-3xl font-bold">{String(n.count??0)}</p><h2 className="mt-1 font-semibold tracking-wide">{String(n.node||n.name||"Business Flow")}</h2><div className="my-3 border-t border-border"/><p className="text-sm text-muted-foreground">{String(n.reason||"Live ERP signal")}</p><p className="mt-2 text-sm font-medium">{String(n.detail||"Open module")}</p></button>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/85 px-7 py-4"><div className="flex gap-2"><Button variant="outline" size="icon" onClick={reload} title="Refresh live twin"><Activity/></Button><Button variant="outline" size="icon" onClick={()=>navigate({to:"/$",params:{_splat:"alerts"}})} title="Open alerts"><AlertTriangle/></Button></div><div className="flex flex-wrap gap-4 rounded-lg border border-border bg-background px-4 py-3 text-sm"><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-emerald-500"/>Healthy</span><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-amber-500"/>Warning</span><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-primary"/>Active</span></div></div></section>}</>;
}

function AdminUsersPage(){
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [busyId, setBusyId] = useState("");
  const { data, loading, error, reload } = useApiData(() => api.users.list(), []);
  const rows = unwrapRows(data);
  const pageRows = pageSlice(rows, page, rowsPerPage);
  const roleOptions = ["Admin", "Sales User", "Purchase User", "Manufacturing User", "Inventory Manager", "Business Owner"];
  const statusOptions = ["Active", "Inactive", "Pending", "Rejected"];
  const isSelf = (row: Row) => String(row.id || "") === String(user?.id || "") || String(row.email || "") === String(user?.email || "");
  const changeRole = async (row: Row, role: string) => {
    setBusyId(String(row.id));
    try { await api.users.changeRole(String(row.id), role); toast.success("User role updated"); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Role update failed"); }
    finally { setBusyId(""); }
  };
  const changeStatus = async (row: Row, status: string) => {
    setBusyId(String(row.id));
    try { await api.users.changeStatus(String(row.id), status); toast.success(status === "Inactive" ? "User blocked" : "User status updated"); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Status update failed"); }
    finally { setBusyId(""); }
  };
  const removeUser = async (row: Row) => {
    if (!window.confirm(`Delete ${String(row.email)}? This cannot be undone.`)) return;
    setBusyId(String(row.id));
    try { await api.users.remove(String(row.id)); toast.success("User deleted"); reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
    finally { setBusyId(""); }
  };
  if (user?.role !== "Admin") return <><PageHeader title="Users & Roles" /><StatePanel type="error" message="Only admins can manage users and roles." /></>;
  if (loading) return <StatePanel type="loading" />;
  if (error) return <><PageHeader title="Users & Roles" /><StatePanel type="error" message={error} retry={reload} /></>;
  return <><PageHeader title="Users & Roles" description="Admin-only authorization, blocking, and user removal." />{!rows.length ? <StatePanel type="empty" /> : <><DataTable columns={[{key:"name",label:"Name"},{key:"email",label:"Email"},{key:"role",label:"Role"},{key:"status",label:"Status"},{key:"lastLogin",label:"Last Login"},{key:"actions",label:"Actions"}]} rows={pageRows} renderCell={(key,value,row)=>{const disabled=busyId===String(row.id)||isSelf(row);if(key==="role")return <select aria-label="Role" disabled={disabled} className={inputClass+" min-w-44"} value={String(value||"Sales User")} onChange={event=>changeRole(row,event.target.value)}>{roleOptions.map(role=><option key={role}>{role}</option>)}</select>;if(key==="status")return <select aria-label="Status" disabled={disabled} className={inputClass+" min-w-32"} value={String(value||"Active")} onChange={event=>changeStatus(row,event.target.value)}>{statusOptions.map(status=><option key={status}>{status}</option>)}</select>;if(key==="lastLogin")return value?<span title={String(value)}>{new Date(String(value)).toLocaleString()}</span>:<span className="text-muted-foreground">Never logged in</span>;if(key==="actions")return <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={disabled} onClick={()=>changeStatus(row,String(row.status)==="Active"?"Inactive":"Active")}>{String(row.status)==="Active"?"Block":"Unblock"}</Button><Button variant="destructive" size="sm" disabled={disabled} onClick={()=>removeUser(row)}>Delete</Button>{isSelf(row)&&<span className="self-center text-xs text-muted-foreground">Current admin</span>}</div>;return String(value??"-")}}/><PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={rows.length}/></>}</>;
}

function AlertsPage(){
  const navigate=useNavigate();const [page,setPage]=useState(1);const [rowsPerPage,setRowsPerPage]=useState(10);const [severity,setSeverity]=useState("");const [status,setStatus]=useState("");const [busyId,setBusyId]=useState("");const {data,loading,error,reload}=useApiData(()=>api.alerts.list(),[]);const rows=unwrapRows(data);
  useEffect(()=>{const timer=window.setInterval(reload,30000);return()=>window.clearInterval(timer)},[reload]);
  const filteredRows=useMemo(()=>rows.filter(row=>(!severity||String(row.severity)===severity)&&(!status||String(row.status)===status)),[rows,severity,status]);
  const pageRows=pageSlice(filteredRows,page,rowsPerPage);useEffect(()=>setPage(1),[severity,status,rowsPerPage]);
  const counts={total:rows.length,unread:rows.filter(row=>!row.read).length,critical:rows.filter(row=>String(row.severity)==="Critical").length,warning:rows.filter(row=>String(row.severity)==="Warning").length};
  const markRead=async(row:Row)=>{setBusyId(String(row.id));try{await api.alerts.markRead(String(row.id));toast.success("Alert marked read");reload()}catch(err){toast.error(err instanceof Error?err.message:"Could not update alert")}finally{setBusyId("")}};
  const openRecord=(row:Row)=>{const link=String(row.actionLink||"");if(link.startsWith("/"))navigate({to:"/$",params:{_splat:link.slice(1)}})};
  if(loading)return <StatePanel type="loading"/>;if(error)return <><PageHeader title="Alerts"/><StatePanel type="error" message={error} retry={reload}/></>;
  return <><PageHeader title="Alerts" description="Live operational risks, blockers, and recommended actions." actions={<Button variant="outline" onClick={reload}>Refresh</Button>}/><div className="mb-4 grid gap-3 md:grid-cols-4">{[["Total",counts.total],["Unread",counts.unread],["Critical",counts.critical],["Warning",counts.warning]].map(([label,count])=><div key={String(label)} className="rounded-lg border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{String(label)}</p><p className="mt-2 text-2xl font-bold">{String(count)}</p></div>)}</div><div className="mb-4 rounded-lg border border-border bg-card p-3"><div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl"><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Severity<select className={inputClass} value={severity} onChange={e=>setSeverity(e.target.value)}><option value="">All severities</option><option>Critical</option><option>Warning</option><option>Info</option></select></label><label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status<select className={inputClass} value={status} onChange={e=>setStatus(e.target.value)}><option value="">All status</option><option>Unread</option><option>Read</option></select></label></div></div>{!filteredRows.length?<StatePanel type="empty" message="No active alerts match these filters."/>:<><DataTable columns={[{key:"severity",label:"Severity"},{key:"alertType",label:"Alert Type"},{key:"title",label:"Title"},{key:"message",label:"Message"},{key:"relatedRecord",label:"Related Record"},{key:"createdAt",label:"Created At"},{key:"status",label:"Status"},{key:"actions",label:"Actions"}]} rows={pageRows} renderCell={(key,value,row)=>{if(key==="severity"||key==="status")return <StatusPill value={String(value)}/>;if(key==="createdAt")return String(value?new Date(String(value)).toLocaleString():"-");if(key==="actions")return <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!row.actionLink} onClick={()=>openRecord(row)}>Open</Button><Button size="sm" disabled={Boolean(row.read)||busyId===String(row.id)} onClick={()=>markRead(row)}>Mark read</Button></div>;return String(value??"-")}}/><PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={filteredRows.length}/></>}</>;
}

const defaultPlant={id:"default-plant",name:"Shiv Furniture Works",code:"MFG",lat:18.5204,lng:73.8567,city:"Pune",address:"Pune Industrial Area, Pune, Maharashtra, India",capacity:0,status:"Active"};
const supplyCityCoords:Record<string,{lat:number;lng:number}>={ahmedabad:{lat:23.0225,lng:72.5714},delhi:{lat:28.7041,lng:77.1025},surat:{lat:21.1702,lng:72.8311},jaipur:{lat:26.9124,lng:75.7873},vadodara:{lat:22.3072,lng:73.1812},mumbai:{lat:19.076,lng:72.8777},pune:{lat:18.5204,lng:73.8567},nashik:{lat:19.9975,lng:73.7898},bengaluru:{lat:12.9716,lng:77.5946},bhopal:{lat:23.2599,lng:77.4126},hyderabad:{lat:17.385,lng:78.4867},gurugram:{lat:28.4595,lng:77.0266}};
const cityCoordFor=(row:Row)=>{const text=`${String(row.city||"")} ${String(row.address||"")}`.toLowerCase();const key=Object.keys(supplyCityCoords).find(city=>text.includes(city));return key?supplyCityCoords[key]:null};
const displayPlantLocation=(plant:Row,index=0)=>{const lat=Number(plant.lat);const lng=Number(plant.lng);const cityCoord=cityCoordFor(plant);const isDefaultPune=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat-defaultPlant.lat)<0.001&&Math.abs(lng-defaultPlant.lng)<0.001;const loc=cityCoord&&(!Number.isFinite(lat)||!Number.isFinite(lng)||isDefaultPune)?cityCoord:{lat:Number.isFinite(lat)?lat:Number(defaultPlant.lat),lng:Number.isFinite(lng)?lng:Number(defaultPlant.lng)};return {lat:loc.lat+(index%3)*0.08,lng:loc.lng+(index%3)*0.08}};
const vendorLocation=(vendor:Row, plant:Row)=>{const address=String(vendor.address||"").toLowerCase();const key=Object.keys(supplyCityCoords).find(city=>address.includes(city));return key?supplyCityCoords[key]:{lat:Number(plant.lat||defaultPlant.lat)+(Number(String(vendor.id||"").length)%7)*0.4,lng:Number(plant.lng||defaultPlant.lng)+(Number(vendor.leadTimeDays||1)%9)*0.55}};
function SupplyMapCanvas({vendors,plants,selectedId,setSelectedId}:{vendors:Row[];plants:Row[];selectedId:string;setSelectedId:(id:string)=>void}){
  const mapRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!mapRef.current||typeof window==="undefined")return;let map:any;let cancelled=false;(async()=>{if(!document.querySelector("link[data-leaflet-css]")){const link=document.createElement("link");link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.setAttribute("data-leaflet-css","true");document.head.appendChild(link)}const L=await import("leaflet");if(cancelled||!mapRef.current)return;map=L.map(mapRef.current,{zoomControl:true,scrollWheelZoom:true,preferCanvas:true}).setView([22.4,76.6],5);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors"}).addTo(map);const activePlants=(plants.length?plants:[defaultPlant]).filter(p=>String(p.status||"Active")==="Active").map((p,index)=>{const loc=displayPlantLocation(p,index);return {...p,lat:loc.lat,lng:loc.lng}});const primaryPlant=activePlants.find(p=>String(p.name||"").toLowerCase().includes("shiv"))||activePlants[0]||defaultPlant;const bounds=activePlants.map(p=>[Number(p.lat),Number(p.lng)]);const plantIcon=(p:Row)=>L.divIcon({className:"",iconSize:[54,54],iconAnchor:[27,27],html:`<div style="width:54px;height:54px;border-radius:16px;background:#4f46e5;color:white;display:grid;place-items:center;font-weight:800;font-size:12px;border:4px solid white;box-shadow:0 14px 30px rgba(79,70,229,.35)">${String(p.code||"MFG").slice(0,4)}</div>`});activePlants.forEach(p=>{const marker=L.marker([Number(p.lat),Number(p.lng)],{icon:plantIcon(p),zIndexOffset:1000}).addTo(map);marker.bindTooltip(`<div class="map-hover-card"><strong>${String(p.name)}</strong><span>Manufacturing plant</span><span>${String(p.address)}</span><span><b>Capacity:</b> ${String(p.capacity||0)} units/day</span><span><b>Coordinates:</b> ${String(p.lat)}, ${String(p.lng)}</span></div>`,{direction:"top",offset:[0,-28],opacity:1,sticky:true,className:"supply-map-tooltip"})});vendors.forEach((vendor)=>{const loc=vendorLocation(vendor, primaryPlant);bounds.push([loc.lat,loc.lng]);const vendorId=String(vendor.id||"");const warning=Number(vendor.leadTimeDays||0)>6||String(vendor.status)!=="Active";const color=warning?"#f59e0b":"#10b981";const line=L.polyline([[loc.lat,loc.lng],[Number(primaryPlant.lat),Number(primaryPlant.lng)]],{color,weight:2,opacity:.6,dashArray:warning?"8 8":"4 8"}).addTo(map);const marker=L.circleMarker([loc.lat,loc.lng],{radius:9,color,fillColor:color,fillOpacity:.9,weight:3}).addTo(map);const tooltip=`<div class="map-hover-card"><strong>${String(vendor.name||"Supplier")}</strong><span>${String(vendor.address||"Location not set")}</span><span><b>Materials:</b> ${String(vendor.supplies||"-")}</span><span><b>Lead time:</b> ${String(vendor.leadTimeDays||"-")} days</span><span><b>Route to:</b> ${String(primaryPlant.name||"Manufacturing plant")}</span></div>`;marker.bindTooltip(tooltip,{direction:"top",offset:[0,-14],opacity:1,sticky:true,className:"supply-map-tooltip"});marker.on("mouseover",()=>{setSelectedId(vendorId);marker.setStyle({radius:13,weight:5});line.setStyle({weight:4,opacity:.9});marker.openTooltip()});marker.on("mouseout",()=>{marker.setStyle({radius:9,weight:3});line.setStyle({weight:2,opacity:.6})});marker.on("click",()=>{setSelectedId(vendorId);marker.openTooltip()})});if(bounds.length>1)map.fitBounds(bounds as any,{padding:[35,35]})})();return()=>{cancelled=true;if(map)map.remove()}},[vendors,plants,setSelectedId]);return <div ref={mapRef} className="h-[520px] min-h-[420px] w-full rounded-xl border border-border bg-muted [&_.supply-map-tooltip]:!rounded-lg [&_.supply-map-tooltip]:!border-border [&_.supply-map-tooltip]:!bg-card [&_.supply-map-tooltip]:!p-0 [&_.supply-map-tooltip]:!text-foreground [&_.supply-map-tooltip]:!shadow-xl [&_.map-hover-card]:grid [&_.map-hover-card]:gap-1 [&_.map-hover-card]:p-3 [&_.map-hover-card]:text-xs [&_.map-hover-card_strong]:text-sm [&_.map-hover-card_span]:block"/>;
}

function SupplyChainMapPage(){
  const [selectedId,setSelectedId]=useState("");const {data,loading,error,reload}=useApiData(()=>Promise.all([api.vendors.list(),api.purchaseOrders.list(),api.manufacturingPlants.list()]).then(([vendors,purchaseOrders,plants])=>({vendors,purchaseOrders,plants})),[]);
  useEffect(()=>{const timer=window.setInterval(reload,10000);return()=>window.clearInterval(timer)},[reload]);
  if(loading)return <StatePanel type="loading"/>;if(error)return <><PageHeader title="Supply Chain Map"/><StatePanel type="error" message={error} retry={reload}/></>;
  const payload=(data||{}) as Row;const vendors=unwrapRows(payload.vendors);const purchaseOrders=unwrapRows(payload.purchaseOrders);const plants=unwrapRows(payload.plants);const activeVendors=vendors.filter(v=>String(v.status)==="Active");const riskyVendors=vendors.filter(v=>Number(v.leadTimeDays||0)>6||String(v.status)!=="Active");const selected=vendors.find(v=>String(v.id)===selectedId)||vendors[0];const openPo=purchaseOrders.filter(p=>!["Fully Received","Fully_Received","Cancelled"].includes(String(p.status)));
  const columns=[{key:"name",label:"Supplier"},{key:"address",label:"Location"},{key:"supplies",label:"Materials"},{key:"leadTimeDays",label:"Lead Time Days"},{key:"status",label:"Status"}];
  return <><PageHeader title="Supply Chain Map" description="Live vendor routes, lead-time risk, and material supply visibility." actions={<Button variant="outline" onClick={reload}><RefreshCw/>Refresh</Button>}/><div className="mb-4 grid gap-3 md:grid-cols-4">{[["Suppliers",vendors.length],["Plants",plants.length||1],["Open POs",openPo.length],["Lead-time risks",riskyVendors.length]].map(([label,count])=><div key={String(label)} className="rounded-lg border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{String(label)}</p><p className="mt-2 text-2xl font-bold">{String(count)}</p></div>)}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">OpenStreetMap Live Supplier Network</h2><p className="text-sm text-muted-foreground">Routes refresh every 10 seconds from vendor, plant, and purchase-order data.</p></div><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"><Radio className="size-4"/>Live tracking</div></div><SupplyMapCanvas vendors={vendors} plants={plants} selectedId={String(selected?.id||"")} setSelectedId={setSelectedId}/><div className="mt-3 flex flex-wrap gap-4 text-sm"><span className="flex items-center gap-2"><span className="size-3 rounded-full bg-emerald-500"/>Normal supplier route</span><span className="flex items-center gap-2"><span className="size-3 rounded-full bg-amber-500"/>Long lead time / inactive</span><span className="flex items-center gap-2"><span className="size-3 rounded-full bg-indigo-600"/>Manufacturing plant</span></div></section><aside className="grid content-start gap-4"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><MapPin/></div><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected Supplier</p><h3 className="mt-1 text-lg font-bold">{String(selected?.name||"No supplier")}</h3></div></div><div className="mt-5 space-y-3 text-sm"><p><span className="text-muted-foreground">Location:</span> {String(selected?.address||"-")}</p><p><span className="text-muted-foreground">Materials:</span> {String(selected?.supplies||"-")}</p><p><span className="text-muted-foreground">Lead time:</span> {String(selected?.leadTimeDays||"-")} days</p><StatusPill value={String(selected?.status||"Unknown")}/></div></div><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><Factory className="size-5 text-primary"/><h3 className="font-semibold">Manufacturing Plants</h3></div><div className="mt-4 space-y-2">{(plants.length?plants:[defaultPlant]).map(p=><div key={String(p.id)} className="rounded-lg border border-border bg-background p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{String(p.name)}</span><StatusPill value={String(p.status||"Active")}/></div><p className="mt-1 text-xs text-muted-foreground">{String(p.address)}</p></div>)}</div></div><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><Navigation className="size-5 text-primary"/><h3 className="font-semibold">Supplier Routes</h3></div><div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">{vendors.map(v=><button key={String(v.id)} onClick={()=>setSelectedId(String(v.id))} className={`w-full rounded-lg border p-3 text-left text-sm transition hover:border-primary ${String(v.id)===String(selected?.id)?"border-primary bg-primary/5":"border-border bg-background"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{String(v.name)}</span><StatusPill value={Number(v.leadTimeDays||0)>6?"Warning":String(v.status||"Active")}/></div><p className="mt-1 text-xs text-muted-foreground">{String(v.address||"-")}</p></button>)}</div></div></aside></div><div className="mt-4 rounded-xl border border-border bg-card p-3"><DataTable columns={columns} rows={vendors} renderCell={(k,v)=>k==="status"?<StatusPill value={String(v)}/>:String(v??"-")}/></div></>;
}

const blankPlant={name:"",code:"MFG",address:"",city:"",lat:"18.5204",lng:"73.8567",capacity:"0",status:"Active",notes:""};
function ManufacturingPlantsPage(){
  const {user}=useAuth();const {data,loading,error,reload}=useApiData(()=>api.manufacturingPlants.list(),[]);const [form,setForm]=useState<Row>(blankPlant);const [busy,setBusy]=useState(false);const rows=unwrapRows(data);
  useEffect(()=>{const timer=window.setInterval(reload,10000);return()=>window.clearInterval(timer)},[reload]);
  if(user?.role!=="Admin")return <><PageHeader title="Manufacturing Plants"/><StatePanel type="error" message="Only admins can manage manufacturing plants."/></>;
  if(loading)return <StatePanel type="loading"/>;if(error)return <><PageHeader title="Manufacturing Plants"/><StatePanel type="error" message={error} retry={reload}/></>;
  const set=(key:string,value:string)=>setForm(prev=>({...prev,[key]:value}));
  const edit=(row:Row)=>setForm({...row,lat:String(row.lat??""),lng:String(row.lng??""),capacity:String(row.capacity??0)});
  const payload=()=>{const body={name:String(form.name||"").trim(),code:String(form.code||"MFG").trim().toUpperCase(),address:String(form.address||"").trim(),city:String(form.city||"").trim(),lat:Number(form.lat),lng:Number(form.lng),capacity:Number(form.capacity||0),status:String(form.status||"Active"),notes:String(form.notes||"")};const derived=displayPlantLocation(body);const defaultCoords=Math.abs(Number(body.lat)-defaultPlant.lat)<0.001&&Math.abs(Number(body.lng)-defaultPlant.lng)<0.001;if(defaultCoords&&cityCoordFor(body)){body.lat=derived.lat;body.lng=derived.lng}return body};
  const save=async()=>{const body=payload();if(!body.name||!body.code||!body.address||!body.city||!Number.isFinite(body.lat)||!Number.isFinite(body.lng)){toast.error("Name, code, address, city, latitude and longitude are required");return}setBusy(true);try{if(form.id)await api.manufacturingPlants.update(String(form.id),body);else await api.manufacturingPlants.create(body);toast.success(form.id?"Plant updated":"Plant created");setForm(blankPlant);reload()}catch(err){toast.error(err instanceof Error?err.message:"Could not save plant")}finally{setBusy(false)}};
  const remove=async(row:Row)=>{if(!confirm(`Delete ${String(row.name)}?`))return;setBusy(true);try{await api.manufacturingPlants.remove(String(row.id));toast.success("Plant deleted");if(String(form.id)===String(row.id))setForm(blankPlant);reload()}catch(err){toast.error(err instanceof Error?err.message:"Could not delete plant")}finally{setBusy(false)}};
  const toggle=async(row:Row)=>{setBusy(true);try{await api.manufacturingPlants.update(String(row.id),{...row,status:String(row.status)==="Active"?"Inactive":"Active"});toast.success("Plant status updated");reload()}catch(err){toast.error(err instanceof Error?err.message:"Could not update status")}finally{setBusy(false)}};
  return <><PageHeader title="Manufacturing Plants" description="Admin-only plant master data reflected live in supply chain maps." actions={<Button variant="outline" onClick={()=>setForm(blankPlant)}>New Plant</Button>}/><div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]"><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><h2 className="font-semibold">{form.id?"Edit Plant":"New Plant"}</h2><div className="mt-4 grid gap-4"><Field label="Plant Name" required><input className={inputClass} value={String(form.name||"")} onChange={e=>set("name",e.target.value)} placeholder="Shiv Furniture Works"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Code" required><input className={inputClass} value={String(form.code||"")} onChange={e=>set("code",e.target.value)} placeholder="MFG"/></Field><Field label="Status"><select className={inputClass} value={String(form.status||"Active")} onChange={e=>set("status",e.target.value)}><option>Active</option><option>Inactive</option></select></Field></div><Field label="Address" required><input className={inputClass} value={String(form.address||"")} onChange={e=>set("address",e.target.value)} placeholder="Pune Industrial Area, Pune"/></Field><div className="grid gap-4 sm:grid-cols-3"><Field label="City" required><input className={inputClass} value={String(form.city||"")} onChange={e=>set("city",e.target.value)} placeholder="Pune"/></Field><Field label="Latitude" required><input className={inputClass} value={String(form.lat||"")} onChange={e=>set("lat",e.target.value)} placeholder="18.5204"/></Field><Field label="Longitude" required><input className={inputClass} value={String(form.lng||"")} onChange={e=>set("lng",e.target.value)} placeholder="73.8567"/></Field></div><Field label="Capacity / Day"><input className={inputClass} value={String(form.capacity||"")} onChange={e=>set("capacity",e.target.value)} placeholder="120"/></Field><Field label="Notes"><textarea className={textareaClass} value={String(form.notes||"")} onChange={e=>set("notes",e.target.value)} placeholder="Plant capabilities, lines, shifts"/></Field><Button onClick={save} disabled={busy}><Save/>Save Plant</Button></div></section><section className="rounded-xl border border-border bg-card p-3 shadow-sm">{!rows.length?<StatePanel type="empty" message="No manufacturing plants yet. Create one to show it on the Supply Chain Map."/>:<DataTable columns={[{key:"name",label:"Plant"},{key:"code",label:"Code"},{key:"city",label:"City"},{key:"capacity",label:"Capacity / Day"},{key:"status",label:"Status"},{key:"actions",label:"Actions"}]} rows={rows} renderCell={(key,value,row)=>{if(key==="status")return <StatusPill value={String(value)}/>;if(key==="actions")return <div className="inline-flex min-w-max items-center gap-2 rounded-md border border-border bg-background p-1 shadow-sm"><Button variant="outline" size="sm" className="h-8 px-3" onClick={()=>edit(row)}>Edit</Button><Button variant="outline" size="sm" className="h-8 px-3" onClick={()=>toggle(row)}>{String(row.status)==="Active"?"Deactivate":"Activate"}</Button><Button variant="destructive" size="icon" className="size-8" aria-label="Delete plant" onClick={()=>remove(row)}><Trash2 className="size-4"/></Button></div>;return String(value??"-")}}/>}</section></div></>;
}

export function SimpleApiPage({section}:{section:string}){
  if(section==="users") return <AdminUsersPage/>;
  if(section==="alerts") return <AlertsPage/>;
  if(section==="supply-map") return <SupplyChainMapPage/>;
  if(section==="manufacturing-plants") return <ManufacturingPlantsPage/>;
  if(section==="profile"||section==="settings") return <UserSettingsPage/>;
  const titles:Record<string,string>={alerts:"Alerts","supply-map":"Supply Chain Map",users:"Users & Roles",profile:"Profile",settings:"Settings"};
  const loaders:Record<string,()=>Promise<unknown>>={alerts:()=>api.alerts.list(),users:()=>api.users.list(),profile:()=>api.profile.get(),settings:()=>api.settings.get(),"supply-map":()=>api.vendors.list()};
  const [page,setPage]=useState(1);const [rowsPerPage,setRowsPerPage]=useState(10);const {data,loading,error,reload}=useApiData(loaders[section]);const rows=unwrapRows(data);const pageRows=pageSlice(rows,page,rowsPerPage);useEffect(()=>setPage(1),[section,rowsPerPage]);
  if(loading)return <StatePanel type="loading"/>;if(error)return <><PageHeader title={titles[section]}/><StatePanel type="error" message={error} retry={reload}/></>;if(section==="profile"||section==="settings")return <EditableObject title={titles[section]} value={(data||{}) as Row} save={section==="profile"?api.profile.update:api.settings.update}/>;
  const columns=section==="alerts"?[{key:"severity",label:"Severity"},{key:"alertType",label:"Alert Type"},{key:"message",label:"Message"},{key:"relatedRecord",label:"Related Record"},{key:"createdAt",label:"Created At"},{key:"status",label:"Status"}]:[{key:"name",label:"Supplier"},{key:"address",label:"Location"},{key:"supplies",label:"Materials"},{key:"leadTimeDays",label:"Lead Time Days"},{key:"status",label:"Status"}];
  return <><PageHeader title={titles[section]} description={section==="alerts"?"Operational risks and recommended actions.":"Vendor and material supply visibility."}/>{!rows.length?<StatePanel type="empty"/>:<><DataTable columns={columns} rows={pageRows} renderCell={(k,v)=>k==="status"||k==="severity"?<StatusPill value={String(v)}/>:String(v??"-")}/><PaginationFooter page={page} setPage={setPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} totalRows={rows.length}/></>}</>;
}

function UserSettingsPage(){
  const navigate=useNavigate();const auth=useAuth();const {data,loading,error,reload}=useApiData(()=>api.profile.get(),[]);const [form,setForm]=useState<Row>({});const [busy,setBusy]=useState(false);
  useEffect(()=>{if(data)setForm(data as Row)},[data]);useEffect(()=>{const timer=window.setInterval(reload,15000);return()=>window.clearInterval(timer)},[reload]);
  if(loading)return <StatePanel type="loading"/>;if(error)return <><PageHeader title="User Settings"/><StatePanel type="error" message={error} retry={reload}/></>;
  const profile=(data||{}) as Row;const role=String(form.role||profile.role||auth.user?.role||"User");const name=String(form.name||profile.name||auth.user?.name||"FlowForge User");const email=String(profile.email||auth.user?.email||"");const employeeCode=String(form.employeeCode||profile.employeeCode||`FF-${String(profile.id||auth.user?.id||"9821").slice(-4).toUpperCase()}`);const lastLogin=profile.lastLogin?new Date(String(profile.lastLogin)) : null;const activeSince=profile.createdAt?new Date(String(profile.createdAt)).toLocaleDateString("en-IN",{month:"long",year:"numeric"}):"Current session";const approvalRate=role==="Admin"?"99.2":role==="Business Owner"?"98.4":"94.8";const clearance=role==="Admin"?"Level 4 (Admin)":role==="Business Owner"?"Level 3 (Senior)":"Level 2 (Operator)";
  const update=(key:string,value:string)=>setForm(prev=>({...prev,[key]:value}));
  const save=async()=>{setBusy(true);try{const saved=await api.profile.update(form) as Row;setForm(saved);const token=localStorage.getItem("flowforge_token");if(token){localStorage.setItem("flowforge_user",JSON.stringify(saved));auth.setUser(saved)}toast.success("Profile saved");reload()}catch(err){toast.error(err instanceof Error?err.message:"Save failed")}finally{setBusy(false)}};
  return <><div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-5"><div><h1 className="text-3xl font-bold text-primary">User Settings</h1></div></div><div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]"><aside className="rounded-xl border border-border bg-card p-8 shadow-sm"><div className="grid justify-items-center text-center"><div className="relative grid size-48 place-items-center rounded-full border-8 border-primary/10 bg-gradient-to-br from-primary/20 to-muted text-primary shadow-lg"><UserRound className="size-24"/><button type="button" className="absolute bottom-4 right-4 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg" title="User icon"><Camera className="size-5"/></button></div><h2 className="mt-8 text-2xl font-bold">{name}</h2><p className="mt-1 text-muted-foreground">{role}</p></div></aside><section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6"><h2 className="text-2xl font-bold">Personal Information</h2><span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">Employee ID: {employeeCode}</span></div><div className="grid gap-5 p-6 md:grid-cols-2"><Field label="Full Name" required><input className={inputClass} value={name} onChange={e=>update("name",e.target.value)} /></Field><Field label="Position / Role"><div className="relative"><BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input className={inputClass+" pl-10"} value={role} disabled /></div></Field><Field label="Email Address"><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input className={inputClass+" pl-10"} value={email} disabled /></div></Field><Field label="Mobile Number"><div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input className={inputClass+" pl-10"} value={String(form.mobileNumber||"")} onChange={e=>update("mobileNumber",e.target.value)} placeholder="+91 98765 43210"/></div></Field><div className="md:col-span-2"><Field label="Business Address"><textarea className={textareaClass+" min-h-24"} value={String(form.address||"")} onChange={e=>update("address",e.target.value)} placeholder="Factory, office, or branch address"/></Field></div><div className="border-t border-border pt-6 md:col-span-2"><p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Security Clearance Status</p><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"><div className="grid grid-cols-4 gap-3">{[0,1,2,3].map(i=><span key={i} className={`h-2 rounded-full ${i<(role==="Admin"?4:role==="Business Owner"?3:2)?"bg-primary":"bg-muted"}`}/>)}</div><div className="flex items-center gap-2 font-semibold text-primary"><ShieldCheck className="size-4"/>{clearance}</div></div></div></div><div className="flex justify-end gap-3 border-t border-border bg-muted/40 p-6"><Button variant="ghost" onClick={()=>setForm(profile)}>Cancel</Button><Button onClick={save} disabled={busy}><Save/>Save Changes</Button></div></section></div><div className="mt-5 grid gap-5 md:grid-cols-3"><div className="rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-primary/10"><p className="text-sm font-semibold uppercase tracking-wider">Active Since</p><p className="mt-4 text-2xl font-bold">{activeSince}</p><p className="mt-4 flex items-center gap-2 text-sm text-primary"><BadgeCheck className="size-4"/>{role.includes("Admin")?"Admin Tier":"Senior Tier"}</p></div><div className="rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-primary/10"><p className="text-sm font-semibold uppercase tracking-wider">Last Activity</p><p className="mt-4 text-2xl font-bold">{lastLogin?lastLogin.toLocaleString():"Current session"}</p><p className="mt-4 text-sm text-muted-foreground">From: FlowForge ERP workspace</p></div><div className="rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-primary/10"><p className="text-sm font-semibold uppercase tracking-wider">Approval Rate</p><div className="mt-4 flex items-end gap-4"><p className="text-2xl font-bold">{approvalRate}%</p><div className="flex items-end gap-1">{[4,7,10,14,17].map((h,i)=><span key={h} className={`w-4 rounded-sm ${i===4?"bg-primary":"bg-primary/30"}`} style={{height:h+8}}/>)}</div></div></div></div></>;
}

function EditableObject({title,value,save}:{title:string;value:Row;save:(v:unknown)=>Promise<unknown>}){const navigate=useNavigate();const [form,setForm]=useState(value);const [busy,setBusy]=useState(false);const keys=title==="Profile"?["name","email","mobile","address","role"]:["companyName","currency","procurementDefault","notifications","preferences"];const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{await save(form);toast.success(`${title} saved`)}catch(err){toast.error(err instanceof Error?err.message:"Save failed")}finally{setBusy(false)}};return <><PageHeader title={title} back={()=>navigate({to:"/$",params:{_splat:"dashboard"}})} actions={<Button onClick={()=>document.getElementById("editable-submit")?.click()} disabled={busy}><Save/>Save {title}</Button>}/><form onSubmit={submit} className="max-w-4xl rounded-lg border border-border bg-card p-6"><div className="grid gap-4 md:grid-cols-2">{keys.map(k=><Field key={k} label={k.replace(/([A-Z])/g," $1").replace(/^./,x=>x.toUpperCase())}><input disabled={k==="email"||k==="role"||k==="currency"} value={String(form[k]??(k==="currency"?"INR ₹":""))} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className={inputClass}/></Field>)}</div><button id="editable-submit" className="hidden"/></form></>}









