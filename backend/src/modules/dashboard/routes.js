import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { ok } from "../../utils/response.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res) => {
  const [products, salesOrders, purchaseOrders, manufacturingOrders, stockMoves, auditLogs, alerts] = await Promise.all([
    prisma.product.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.salesOrder.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.manufacturingOrder.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.stockMove.findMany({ take: 8, orderBy: { date: "desc" } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { timestamp: "desc" } }),
    prisma.alert.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
  ]);
  const inventoryValue = products.reduce((sum, p) => sum + p.onHand * p.costPrice, 0);
  const lowStockCount = products.filter((p) => p.onHand - p.reserved <= p.reorderLevel).length;
  const salesCounters = buildCounters(salesOrders, "date", ["Draft", "Confirmed", "Partially_Delivered", "Fully_Delivered"]);
  const purchaseCounters = buildCounters(purchaseOrders, "expectedDate", ["Draft", "Confirmed", "Partially_Received", "Fully_Received"]);
  const manufacturingCounters = buildCounters(manufacturingOrders, "createdAt", ["Draft", "Confirmed", "In_Progress", "Done"]);
  ok(res, {
    updatedAt: new Date().toISOString(),
    products,
    salesOrderRecords: salesOrders,
    purchaseOrderRecords: purchaseOrders,
    manufacturingOrderRecords: manufacturingOrders,
    stockMoves,
    auditLogs,
    alerts,
    counters: { salesOrders: salesCounters, purchaseOrders: purchaseCounters, manufacturingOrders: manufacturingCounters },
    totals: { products: products.length, salesOrders: salesOrders.length, purchaseOrders: purchaseOrders.length, manufacturingOrders: manufacturingOrders.length, stockMoves: stockMoves.length, auditLogs: auditLogs.length, alerts: alerts.length },
    salesOrders: salesCounters.all,
    purchaseOrders: purchaseCounters.all,
    manufacturingOrders: manufacturingCounters.all,
    kpis: { inventoryValue, lowStockCount, openSalesOrders: salesOrders.filter((o) => !["Fully_Delivered", "Cancelled"].includes(o.status)).length, activeManufacturingOrders: manufacturingOrders.filter((o) => ["Confirmed", "In_Progress"].includes(o.status)).length, unreadAlerts: alerts.filter((a) => !a.read).length },
  });
});

dashboardRouter.get("/filter", async (req, res) => {
  const module = String(req.query.module || "");
  const status = String(req.query.status || "");
  const model = module === "sales" ? "salesOrder" : module === "purchase" ? "purchaseOrder" : module === "manufacturing" ? "manufacturingOrder" : null;
  if (!model) return ok(res, []);
  const statusAliases = { Delivered: "Fully_Delivered", Received: "Fully_Received", "Partially Delivered": "Partially_Delivered", "Partially Received": "Partially_Received", "In Progress": "In_Progress" };
  const where = status && status !== "Late" ? { status: statusAliases[status] || status.replaceAll(" ", "_") } : {};
  const records = await prisma[model].findMany({ where, orderBy: { createdAt: "desc" } });
  ok(res, records);
});

function buildCounters(records, dateField, doneStatuses) {
  const now = new Date();
  const counts = {};
  const labels = {
    Fully_Delivered: "Delivered",
    Fully_Received: "Received",
    Partially_Delivered: "Partially Delivered",
    Partially_Received: "Partially Received",
    In_Progress: "In Progress",
  };
  for (const status of doneStatuses) counts[labels[status] || status.replaceAll("_", " ")] = records.filter((r) => r.status === status).length;
  if (!Object.prototype.hasOwnProperty.call(counts, "To Close")) counts["To Close"] = 0;
  counts.Late = records.filter((r) => {
    const due = r[dateField] ? new Date(r[dateField]) : null;
    return due && due < now && !["Fully_Delivered", "Fully_Received", "Done", "Cancelled"].includes(r.status);
  }).length;
  return { all: counts, my: counts };
}
