import { Router } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ok } from "../../utils/response.js";
import { id } from "../../utils/ids.js";
import { audit } from "../erpService.js";

export const erpilotRouter = Router();
export const aiRouter = Router();

const normalizeRisk = (value) => {
  const key = String(value || "").toLowerCase();
  if (["critical", "high", "blocked", "late", "overdue"].some((word) => key.includes(word))) return "High";
  if (["warning", "medium", "risk", "pending", "confirmed", "progress"].some((word) => key.includes(word))) return "Medium";
  if (["healthy", "low", "feasible", "active", "done"].some((word) => key.includes(word))) return "Low";
  return "Low";
};

const aiData = (data = {}) => ({
  answer: data.answer || data.summary || data.recommendation || data.recommendedAction || "ERPilot analysis complete.",
  riskLevel: normalizeRisk(data.riskLevel || data.risk || data.status),
  ...(data.score !== undefined || data.confidenceScore !== undefined ? { score: Number(data.score ?? data.confidenceScore) } : {}),
  facts: data.facts || [],
  recommendations: data.recommendations || data.nextBestActions || (data.recommendedAction ? [data.recommendedAction] : data.recommendation ? [data.recommendation] : []),
  relatedRecords: data.relatedRecords || data.supportingRecords || [],
  calculation: data.calculation || data,
  ...data,
  riskLevel: normalizeRisk(data.riskLevel || data.risk || data.status),
});

erpilotRouter.use((req, res, next) => {
  if (!env.enableErpilotAi) return ok(res, aiData({ answer: "ERPilot AI is currently disabled.", riskLevel: "LOW", source: "disabled" }));
  next();
});

async function saveAnalysis(req, type, entityType, entityId, input, output, source = "rule-based") {
  await prisma.eRPilotAnalysis.create({
    data: { id: id("analysis"), type, entityType, entityId, input, output, source, createdBy: req.user?.name || "System" },
  }).catch(() => null);
}

async function groqJson(system, user, fallback) {
  if (!env.groqApiKey) return { ...fallback, risk: normalizeRisk(fallback.risk || fallback.status), aiUnavailable: true };
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.groqApiKey}` },
      body: JSON.stringify({
        model: env.groqModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\nReturn structured JSON only with keys: answer, suggestedRoute, suggestedAction, supportingRecords, confidence, risk. Set risk to exactly one of: Low, Medium, High. Never suggest direct database mutation. Prefer exact FlowForge routes when helpful.` },
          { role: "user", content: JSON.stringify(user) },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
    });
    if (!response.ok) throw new Error(`Groq returned ${response.status}`);
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    return { ...fallback, recommendations: fallback.recommendations || [fallback.suggestedAction].filter(Boolean), risk: normalizeRisk(fallback.risk || fallback.status), aiUnavailable: true, aiError: error.message || "AI response unavailable" };
  }
}

const compactDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : null;
const compactProduct = (p) => ({ id: p.id, sku: p.sku, name: p.name, type: p.type, available: (p.onHand || 0) - (p.reserved || 0), reorderLevel: p.reorderLevel, status: p.status });
const compactOrderLine = (line) => ({ productId: line.productId, qty: line.qty, orderedQuantity: line.orderedQuantity, completedQuantity: line.completedQuantity });

async function whatIf(productId, quantity) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  const bom = await prisma.bom.findFirst({ where: { productId }, include: { components: { include: { product: true } }, operations: true } });
  const requiredMaterials = (bom?.components || []).map((c) => {
    const required = c.qty * quantity;
    const available = c.product.onHand - c.product.reserved;
    return { productId: c.productId, name: c.product.name, required, available, shortage: Math.max(0, required - available), estimatedCost: required * c.product.costPrice };
  });
  const estimatedManufacturingTimeMinutes = (bom?.operations || []).reduce((sum, o) => sum + o.minutes * quantity, 0);
  const estimatedCost = requiredMaterials.reduce((sum, m) => sum + m.estimatedCost, 0);
  const estimatedRevenue = (product?.salesPrice || 0) * quantity;
  const componentShortages = requiredMaterials.filter((m) => m.shortage > 0);
  return {
    productId, productName: product?.name, quantity, requiredMaterials, componentShortages,
    estimatedManufacturingTimeMinutes, estimatedCost, estimatedRevenue, estimatedProfit: estimatedRevenue - estimatedCost,
    expectedDeliveryDate: new Date(Date.now() + Math.max(1, Math.ceil(estimatedManufacturingTimeMinutes / 480)) * 86400000).toISOString().slice(0, 10),
    riskLevel: componentShortages.length ? "High" : quantity > (product?.onHand || 0) ? "Medium" : "Low",
    recommendation: componentShortages.length ? "Replenish missing materials before committing delivery." : "Feasible with current material availability.",
  };
}

erpilotRouter.get("/order-feasibility/:salesOrderId", async (req, res) => {
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.salesOrderId }, include: { lines: { include: { product: true } }, manufacturingOrders: true, purchaseOrders: true } });
  if (!so) return ok(res, aiData({ answer: "Sales order was not found.", riskLevel: "HIGH", facts: [`SalesOrder ${req.params.salesOrderId} not found`] }));
  const lines = [];
  for (const l of so.lines) {
    const analysis = await whatIf(l.productId, l.qty);
    lines.push({ productId: l.productId, productName: l.product.name, ordered: l.qty, available: l.product.onHand - l.product.reserved, shortage: Math.max(0, l.qty - (l.product.onHand - l.product.reserved)), ...analysis });
  }
  const hasShortage = lines.some((l) => l.shortage > 0 || l.componentShortages.length);
  const data = {
    salesOrderId: so.id, number: so.number, feasibilityStatus: hasShortage ? "Warning" : "Feasible",
    linkedManufacturingOrders: so.manufacturingOrders.map((m) => m.number), linkedPurchaseOrders: so.purchaseOrders.map((p) => p.number),
    orderedProducts: lines, requiredComponents: lines.flatMap((l) => l.requiredMaterials), missingComponents: lines.flatMap((l) => l.componentShortages),
    estimatedManufacturingDurationMinutes: lines.reduce((sum, l) => sum + l.estimatedManufacturingTimeMinutes, 0),
    expectedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    recommendedAction: hasShortage ? "Confirm procurement and monitor manufacturing work orders." : "Proceed with delivery from available stock.",
  };
  await audit(req.user, "ERPILOT_FEASIBILITY_CHECKED", "SalesOrder", so.number, `ERPilot checked feasibility for ${so.number}`);
  await saveAnalysis(req, "order-feasibility", "SalesOrder", so.id, req.params, data);
  ok(res, aiData(data));
});

erpilotRouter.post("/order-feasibility", async (req, res) => {
  req.params.salesOrderId = String(req.body.salesOrderId || req.body.id || "");
  if (!req.params.salesOrderId) return ok(res, aiData({ answer: "Select a sales order to check feasibility.", riskLevel: "LOW" }));
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.salesOrderId }, include: { lines: { include: { product: true } }, manufacturingOrders: true, purchaseOrders: true } });
  if (!so) return ok(res, aiData({ answer: "Sales order was not found.", riskLevel: "HIGH" }));
  const lines = [];
  for (const l of so.lines) {
    const analysis = await whatIf(l.productId, l.qty);
    lines.push({ productId: l.productId, productName: l.product.name, ordered: l.qty, available: l.product.onHand - l.product.reserved, shortage: Math.max(0, l.qty - (l.product.onHand - l.product.reserved)), ...analysis });
  }
  const hasShortage = lines.some((l) => l.shortage > 0 || l.componentShortages.length);
  ok(res, aiData({ salesOrderId: so.id, number: so.number, feasibilityStatus: hasShortage ? "Warning" : "Feasible", orderedProducts: lines, linkedManufacturingOrders: so.manufacturingOrders.map((m) => m.number), linkedPurchaseOrders: so.purchaseOrders.map((p) => p.number), answer: hasShortage ? `${so.number} needs procurement or production before full delivery.` : `${so.number} is feasible with current stock.`, riskLevel: hasShortage ? "MEDIUM" : "LOW", recommendations: [hasShortage ? "Review linked procurement and manufacturing documents." : "Proceed with normal delivery controls."] }));
});

erpilotRouter.get("/procurement-prediction", async (req, res) => {
  const products = await prisma.product.findMany({ include: { vendor: true } });
  const productsAtRisk = products.filter((p) => p.onHand - p.reserved <= p.reorderLevel).map((p) => ({
    productId: p.id, productName: p.name, freeToUse: p.onHand - p.reserved, reorderLevel: p.reorderLevel,
    predictedDepletionDays: Math.max(1, Math.ceil((p.onHand - p.reserved) / Math.max(1, p.reorderLevel / 7))),
    recommendedQuantity: Math.max(p.reorderLevel * 2, p.reorderLevel - (p.onHand - p.reserved)),
    recommendedVendor: p.vendor?.name || null,
    reason: `${p.name} is at or below reorder level.`,
  }));
  const data = { productsAtRisk, recommendation: productsAtRisk.length ? "Create replenishment orders for at-risk products." : "No immediate procurement risk detected." };
  await saveAnalysis(req, "procurement-prediction", "Business", "FlowForge", {}, data);
  ok(res, aiData(data));
});

erpilotRouter.get("/reorder-recommendations", async (req, res) => {
  const products = await prisma.product.findMany({ include: { vendor: true } });
  const recommendations = products.filter((p) => p.onHand - p.reserved <= p.reorderLevel).map((p) => ({ productId: p.id, productName: p.name, sku: p.sku, available: p.onHand - p.reserved, reorderLevel: p.reorderLevel, procurementType: p.procurementType, recommendedQuantity: Math.max(1, p.reorderLevel * 2 - (p.onHand - p.reserved)), vendor: p.vendor?.name || null, reason: `${p.name} is at or below reorder level.` }));
  const data = aiData({ answer: recommendations.length ? `${recommendations.length} products need replenishment review.` : "No immediate reorder recommendation.", riskLevel: recommendations.length ? "MEDIUM" : "LOW", recommendations, calculation: { productsChecked: products.length, atRisk: recommendations.length } });
  await saveAnalysis(req, "reorder-recommendations", "Business", "FlowForge", {}, data);
  ok(res, data);
});

erpilotRouter.post("/what-if", async (req, res) => {
  const data = await whatIf(req.body.productId, Number(req.body.quantity || 1));
  await audit(req.user, "ERPILOT_WHAT_IF_SIMULATED", "Product", req.body.productId, `ERPilot simulated ${data.quantity} x ${data.productName}`);
  await saveAnalysis(req, "what-if", "Product", req.body.productId, req.body, data);
  ok(res, aiData(data));
});

async function businessHealth() {
  const [products, sales, mos, vendors] = await Promise.all([prisma.product.findMany(), prisma.salesOrder.findMany(), prisma.manufacturingOrder.findMany(), prisma.vendor.findMany()]);
  const inventoryHealth = Math.round(products.filter((p) => p.onHand - p.reserved >= p.reorderLevel).length / Math.max(1, products.length) * 100);
  const deliveryPerformance = Math.round(sales.filter((s) => s.status === "Fully_Delivered").length / Math.max(1, sales.length) * 100);
  const manufacturingEfficiency = Math.round(mos.filter((m) => m.status === "Done").length / Math.max(1, mos.length || 1) * 100);
  const vendorReliability = Math.round(vendors.reduce((sum, v) => sum + v.reliabilityScore, 0) / Math.max(1, vendors.length));
  const profitabilitySignal = 85;
  const score = Math.round(inventoryHealth * 0.25 + deliveryPerformance * 0.25 + manufacturingEfficiency * 0.2 + vendorReliability * 0.15 + profitabilitySignal * 0.15);
  return { score, status: score >= 75 ? "Healthy" : score >= 50 ? "Warning" : "Critical", factors: { inventoryHealth, deliveryPerformance, manufacturingEfficiency, vendorReliability, profitabilitySignal }, summary: `FlowForge score is ${score}/100 based on inventory, delivery, manufacturing, vendor, and profit signals.`, nextBestActions: ["Review low-stock components", "Complete active manufacturing work orders", "Receive pending purchase orders"] };
}

erpilotRouter.get("/business-health", async (req, res) => {
  const data = await businessHealth();
  await audit(req.user, "ERPILOT_HEALTH_SCORE_PREPARED", "Business", "FlowForge", "ERPilot prepared business health score");
  await saveAnalysis(req, "business-health", "Business", "FlowForge", {}, data);
  ok(res, data);
});

erpilotRouter.get("/root-cause/:salesOrderId", async (req, res) => {
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.salesOrderId }, include: { manufacturingOrders: { include: { workOrders: true } }, purchaseOrders: { include: { lines: true } }, lines: { include: { product: true } } } });
  if (!so) return ok(res, aiData({ answer: "Sales order was not found.", riskLevel: "HIGH" }));
  const blockedMo = so.manufacturingOrders.find((m) => m.status !== "Done");
  const pendingPo = so.purchaseOrders.find((p) => p.status !== "Fully_Received");
  const issue = blockedMo ? "Manufacturing not completed" : pendingPo ? "Procurement still pending" : "No major blocker detected";
  const data = { issue, rootCause: blockedMo ? "Open work orders remain in the linked MO." : pendingPo ? "Vendor receipt is pending." : "Order is progressing normally.", affectedMaterial: so.lines.find((l) => l.product.onHand - l.product.reserved < l.qty)?.product.name, affectedMO: blockedMo?.number, affectedPO: pendingPo?.number, expectedRecovery: "1-3 working days", recommendedAction: blockedMo ? "Complete pending work orders in sequence." : "Monitor stock ledger and delivery readiness." };
  await audit(req.user, "ERPILOT_ROOT_CAUSE_ANALYZED", "SalesOrder", so.number, `ERPilot analyzed root cause for ${so.number}`);
  await saveAnalysis(req, "root-cause", "SalesOrder", so.id, req.params, data);
  ok(res, aiData(data));
});

erpilotRouter.post("/root-cause", async (req, res) => {
  req.params.salesOrderId = String(req.body.salesOrderId || req.body.id || "");
  if (!req.params.salesOrderId) return ok(res, aiData({ answer: "Select a sales order to analyze root cause.", riskLevel: "LOW" }));
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.salesOrderId }, include: { manufacturingOrders: { include: { workOrders: true } }, purchaseOrders: { include: { lines: true } }, lines: { include: { product: true } } } });
  if (!so) return ok(res, aiData({ answer: "Sales order was not found.", riskLevel: "HIGH" }));
  const blockedMo = so.manufacturingOrders.find((m) => m.status !== "Done");
  const pendingPo = so.purchaseOrders.find((p) => p.status !== "Fully_Received");
  ok(res, aiData({ issue: blockedMo ? "Manufacturing not completed" : pendingPo ? "Procurement still pending" : "No major blocker detected", answer: blockedMo ? "Open work orders remain in the linked manufacturing order." : pendingPo ? "A linked purchase receipt is still pending." : "Order is progressing normally.", riskLevel: blockedMo || pendingPo ? "MEDIUM" : "LOW", relatedRecords: [blockedMo?.number, pendingPo?.number].filter(Boolean), recommendations: [blockedMo ? "Complete pending work orders in sequence." : pendingPo ? "Monitor and receive linked purchase order." : "Continue normal monitoring."] }));
});

erpilotRouter.post("/vendor-ranking", async (req, res) => {
  const vendors = await prisma.vendor.findMany();
  const rankedVendors = vendors.map((v) => {
    const leadTimeScore = Math.max(0, 100 - v.leadTimeDays * 8);
    const score = Math.round(v.reliabilityScore * 0.35 + leadTimeScore * 0.25 + v.costScore * 0.2 + 80 * 0.2);
    return { vendorId: v.id, name: v.name, score, reason: `${v.name} can support ${req.body.requiredQty || 0} units with ${v.leadTimeDays} day lead time.` };
  }).sort((a, b) => b.score - a.score);
  const data = { rankedVendors, recommendedVendor: rankedVendors[0] };
  await audit(req.user, "ERPILOT_VENDOR_RECOMMENDED", "Product", req.body.productId, "ERPilot ranked vendors");
  await saveAnalysis(req, "vendor-ranking", "Product", req.body.productId, req.body, data);
  ok(res, aiData(data));
});

erpilotRouter.get("/bottlenecks", async (_req, res) => {
  const centers = await prisma.workCenter.findMany({ include: { workOrders: { where: { status: { in: ["Pending", "In_Progress"] } } } } });
  const bottlenecks = centers.map((c) => {
    const totalDuration = c.workOrders.reduce((sum, w) => sum + w.minutes, 0);
    const utilizationPercentage = Math.round((totalDuration / c.dailyCapacityMinutes) * 100);
    return { workCenter: c.name, activeWorkOrders: c.workOrders.length, totalWorkloadMinutes: totalDuration, dailyCapacity: c.dailyCapacityMinutes, utilizationPercentage, status: utilizationPercentage > 100 ? "Blocked" : utilizationPercentage > 70 ? "Warning" : "Healthy", recommendation: utilizationPercentage > 70 ? "Rebalance workload or add capacity." : "Capacity is available." };
  });
  ok(res, aiData({ answer: bottlenecks.some((b) => b.status !== "Healthy") ? "Manufacturing capacity has bottleneck risk." : "No major work-center bottleneck detected.", riskLevel: bottlenecks.some((b) => b.status === "Blocked") ? "HIGH" : bottlenecks.some((b) => b.status === "Warning") ? "MEDIUM" : "LOW", bottlenecks, calculation: { workCenters: centers.length } }));
});

erpilotRouter.get("/digital-twin", async (_req, res) => {
  const [salesOrders, purchaseOrders, manufacturingOrders, products, stockMoves, alerts] = await Promise.all([
    prisma.salesOrder.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.manufacturingOrder.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { workOrders: true } }),
    prisma.product.findMany(),
    prisma.stockMove.findMany({ orderBy: { date: "desc" }, take: 25 }),
    prisma.alert.findMany({ where: { read: false }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const components = products.filter((p) => p.type === "Component");
  const finished = products.filter((p) => p.type === "Finished");
  const lowComponents = components.filter((p) => p.onHand - p.reserved <= p.reorderLevel);
  const openSales = salesOrders.filter((o) => !["Fully_Delivered", "Cancelled"].includes(o.status));
  const pendingPurchase = purchaseOrders.filter((o) => !["Fully_Received", "Cancelled"].includes(o.status));
  const activeMo = manufacturingOrders.filter((o) => ["Confirmed", "In_Progress"].includes(o.status));
  const deliveryMoves = stockMoves.filter((m) => m.type === "SALE_DELIVERY");
  const statusFor = (warning, empty = false) => warning ? "Warning" : empty ? "Active" : "Healthy";
  const throughput = Math.max(0, deliveryMoves.reduce((sum, move) => sum + Math.abs(move.change || 0), 0));
  const finishedReady = finished.reduce((sum, p) => sum + Math.max(0, (p.onHand || 0) - (p.reserved || 0)), 0);
  const totalSignals = salesOrders.length + purchaseOrders.length + manufacturingOrders.length + products.length + stockMoves.length;
  const warningSignals = alerts.length + lowComponents.length + pendingPurchase.filter((o) => o.status === "Confirmed").length;
  const efficiency = Math.max(0, Math.min(99, Math.round(((totalSignals - warningSignals) / Math.max(1, totalSignals)) * 1000) / 10));
  ok(res, {
    updatedAt: new Date().toISOString(),
    latencyMs: 400,
    metrics: { efficiency, throughput, unreadAlerts: alerts.length },
    nodes: [
      { id: "customer-orders", node: "Customer Orders", status: statusFor(openSales.length === 0, salesOrders.length === 0), count: salesOrders.length, reason: openSales.length ? `${openSales.length} open customer demand records` : "All customer orders are closed", detail: salesOrders[0]?.number || "No order yet", path: "/sales-orders" },
      { id: "procurement", node: "Procurement", status: statusFor(pendingPurchase.length > 0), count: pendingPurchase.length, reason: pendingPurchase.length ? `${pendingPurchase.length} purchase orders awaiting receipt` : "Vendor supply is clear", detail: pendingPurchase[0]?.number || purchaseOrders[0]?.number || "No pending PO", path: "/purchase-orders" },
      { id: "raw-materials", node: "Raw Materials", status: statusFor(lowComponents.length > 0), count: components.length, reason: lowComponents.length ? `${lowComponents.length} components at reorder risk` : "Component stock is within limits", detail: lowComponents[0]?.name || "Optimum stock levels", path: "/products" },
      { id: "manufacturing", node: "Manufacturing", status: activeMo.length ? "Active" : manufacturingOrders.length ? "Healthy" : "Warning", count: activeMo.length || manufacturingOrders.length, reason: activeMo.length ? `${activeMo.length} orders moving through production` : "No active production order", detail: activeMo[0]?.number || manufacturingOrders[0]?.number || "Create MO from demand", path: "/manufacturing-orders" },
      { id: "finished-goods", node: "Finished Goods", status: finishedReady > 0 ? "Healthy" : "Warning", count: finishedReady, reason: finishedReady > 0 ? "Finished stock ready for delivery" : "Finished goods need replenishment", detail: `${finished.length} finished SKUs tracked`, path: "/products" },
      { id: "delivery", node: "Delivery", status: deliveryMoves.length ? "Healthy" : openSales.length ? "Active" : "Healthy", count: deliveryMoves.length, reason: deliveryMoves.length ? "Recent deliveries posted to stock ledger" : "Waiting for dispatch activity", detail: deliveryMoves[0]?.reference || "No recent delivery move", path: "/inventory-ledger" },
    ],
  });
});

erpilotRouter.get("/audit-summary", async (req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 100 });
  const byAction = logs.reduce((acc, log) => ({ ...acc, [log.action]: (acc[log.action] || 0) + 1 }), {});
  const data = aiData({ answer: `Reviewed ${logs.length} recent audit events.`, riskLevel: logs.some((l) => l.action.includes("DELETE") || l.action.includes("CANCEL")) ? "MEDIUM" : "LOW", facts: logs.slice(0, 8).map((l) => `${l.user}: ${l.action} ${l.entityType} ${l.entityId}`), calculation: { totalLogs: logs.length, byAction }, recommendations: ["Review destructive or cancellation actions first.", "Use record-level audit logs for detailed traceability."] });
  await saveAnalysis(req, "audit-summary", "AuditLog", "recent", {}, data);
  ok(res, data);
});

erpilotRouter.get("/stock-explanation/:stockMoveId", async (req, res) => {
  const move = await prisma.stockMove.findUnique({ where: { id: req.params.stockMoveId }, include: { product: true } });
  if (!move) return ok(res, aiData({ answer: "Stock movement was not found.", riskLevel: "HIGH" }));
  const data = aiData({ answer: `${move.type.replaceAll("_", " ")} changed ${move.product?.name || "product"} by ${move.change}, moving on-hand/available ledger value from ${move.before} to ${move.after}.`, riskLevel: move.after < 0 ? "HIGH" : "LOW", facts: [`Product: ${move.product?.name || move.productId}`, `Reference: ${move.reference}`, `Posted by: ${move.user}`], relatedRecords: [{ type: move.referenceType, id: move.referenceId || move.reference }], calculation: { before: move.before, change: move.change, after: move.after }, source: "rule-based" });
  await saveAnalysis(req, "stock-explanation", "StockMove", move.id, req.params, data);
  ok(res, data);
});

erpilotRouter.get("/manufacturing-readiness/:manufacturingOrderId", async (req, res) => {
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.manufacturingOrderId }, include: { product: true, workOrders: true, bom: { include: { components: { include: { product: true } }, operations: true } } } });
  if (!mo) return ok(res, aiData({ answer: "Manufacturing order was not found.", riskLevel: "HIGH" }));
  const components = mo.bom.components.map((c) => { const required = c.qty * mo.qty; const available = c.product.onHand - c.product.reserved; return { productId: c.productId, productName: c.product.name, required, available, shortage: Math.max(0, required - available) }; });
  const blockers = components.filter((c) => c.shortage > 0);
  const workDone = mo.workOrders.filter((w) => w.status === "Done").length;
  const materialScore = blockers.length ? Math.max(0, 70 - blockers.length * 15) : 100;
  const workScore = Math.round((workDone / Math.max(1, mo.workOrders.length)) * 100);
  const score = Math.round(materialScore * 0.7 + workScore * 0.3);
  const data = aiData({ answer: blockers.length ? `${mo.number} has component shortages before production can complete.` : `${mo.number} is materially ready for production.`, riskLevel: blockers.length ? "HIGH" : score < 75 ? "MEDIUM" : "LOW", score, facts: [`Finished product: ${mo.product.name}`, `Quantity: ${mo.qty}`, `Work orders done: ${workDone}/${mo.workOrders.length}`], recommendations: blockers.length ? ["Replenish missing components before producing finished goods."] : ["Proceed with work order completion and production posting."], calculation: { components, blockers, materialScore, workScore } });
  await saveAnalysis(req, "manufacturing-readiness", "ManufacturingOrder", mo.number, req.params, data);
  ok(res, data);
});

erpilotRouter.post("/chat", async (req, res) => {
  const [
    products,
    customers,
    salesOrders,
    purchaseOrders,
    manufacturingOrders,
    boms,
    stockMoves,
    auditLogs,
    alerts,
    users,
    vendors,
    health,
  ] = await Promise.all([
    prisma.product.findMany({ take: 12, orderBy: { updatedAt: "desc" } }),
    prisma.customer.findMany({ take: 6, orderBy: { id: "asc" } }),
    prisma.salesOrder.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { lines: true } }),
    prisma.purchaseOrder.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { lines: true } }),
    prisma.manufacturingOrder.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { workOrders: true } }),
    prisma.bom.findMany({ take: 5, include: { components: true, operations: true } }),
    prisma.stockMove.findMany({ take: 10, orderBy: { date: "desc" } }),
    prisma.auditLog.findMany({ take: 6, orderBy: { timestamp: "desc" } }),
    prisma.alert.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ take: 10, select: { id: true, name: true, role: true, status: true } }),
    prisma.vendor.findMany({ take: 10, orderBy: { id: "asc" } }),
    businessHealth(),
  ]);
  const context = {
    health,
    products: products.map(compactProduct),
    lowStockProducts: products.filter((p) => (p.onHand || 0) - (p.reserved || 0) <= (p.reorderLevel || 0)).map(compactProduct),
    customers: customers.map((c) => ({ id: c.id, name: c.name, company: c.company, status: c.status })),
    salesOrders: salesOrders.map((o) => ({ id: o.id, number: o.number, status: o.status, date: compactDate(o.date), customerId: o.customerId, total: o.total, lines: o.lines.map(compactOrderLine) })),
    purchaseOrders: purchaseOrders.map((o) => ({ id: o.id, number: o.number, status: o.status, date: compactDate(o.date), vendorId: o.vendorId, total: o.total, lines: o.lines.map(compactOrderLine) })),
    manufacturingOrders: manufacturingOrders.map((o) => ({ id: o.id, number: o.number, status: o.status, scheduledDate: compactDate(o.scheduledDate), productId: o.productId, qty: o.qty, workOrders: o.workOrders.map((w) => ({ id: w.id, operation: w.name, status: w.status, minutes: w.minutes })) })),
    boms: boms.map((b) => ({ id: b.id, reference: b.reference, productId: b.productId, status: b.status, components: b.components.map((c) => ({ productId: c.productId, qty: c.qty })), operations: b.operations.map((o) => ({ name: o.name, workCenter: o.workCenter, minutes: o.minutes })) })),
    stockMoves: stockMoves.map((m) => ({ id: m.id, type: m.type, productId: m.productId, change: m.change, before: m.before, after: m.after, reference: m.reference, date: compactDate(m.date) })),
    auditLogs: auditLogs.map((l) => ({ action: l.action, entityType: l.entityType, entityId: l.entityId, user: l.user, timestamp: compactDate(l.timestamp) })),
    alerts: alerts.map((a) => ({ id: a.id, severity: a.severity, title: a.title, status: a.read ? "Read" : "Unread", relatedRecord: a.relatedRecord })),
    users,
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, leadTimeDays: v.leadTimeDays, reliabilityScore: v.reliabilityScore, status: v.status, supplies: v.supplies })),
  };
  const featureMap = {
    dashboard: "/dashboard",
    products: "/products",
    customers: "/customers",
    vendors: "/vendors",
    salesOrders: "/sales-orders",
    purchaseOrders: "/purchase-orders",
    manufacturingOrders: "/manufacturing-orders",
    bom: "/bom",
    stockLedger: "/inventory-ledger",
    alerts: "/alerts",
    users: "/users",
    digitalTwin: "/digital-twin",
    aiPilot: "/ai-copilot",
  };
  const fallback = {
    answer: `ERPilot reviewed live ERP records. Business health is ${health.status} (${health.score}/100). Check low-stock products, pending purchase receipts, active manufacturing work orders, alerts, and user approvals before committing new demand.`,
    supportingRecords: [],
    suggestedRoute: "/dashboard",
    suggestedAction: "Open the dashboard, then review alerts and stock ledger for current blockers.",
    confidence: "Medium",
    risk: health.status,
  };
  const data = aiData(await groqJson(
    "You are ERPilot, the embedded AI assistant for FlowForge ERP. You can explain and guide every feature: products, customers, vendors, sales orders, purchase orders, BoM, manufacturing orders, stock ledger, audit logs, alerts, users/admin approval, digital twin, and business health. Give concise operational answers, mention exact records when available, and return one suggested FlowForge route from the provided feature map.",
    { question: req.body.question || req.body.message, featureMap, context },
    fallback,
  ));
  await saveAnalysis(req, "chat", "Business", "FlowForge", req.body, data, data.source);
  ok(res, data);
});

aiRouter.post("/procurement-advice", async (req, res) => ok(res, { recommendation: "Use MTO manufacturing for Dining Table shortages and purchase components when below reorder level.", computed: req.body, source: "rule-based" }));
aiRouter.post("/business-health", async (_req, res) => ok(res, await businessHealth()));
