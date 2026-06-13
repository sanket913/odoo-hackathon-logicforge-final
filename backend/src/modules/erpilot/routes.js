import { Router } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ok } from "../../utils/response.js";
import { id } from "../../utils/ids.js";
import { audit } from "../erpService.js";

export const erpilotRouter = Router();
export const aiRouter = Router();

async function saveAnalysis(req, type, entityType, entityId, input, output, source = "rule-based") {
  await prisma.eRPilotAnalysis.create({
    data: { id: id("analysis"), type, entityType, entityId, input, output, source, createdBy: req.user?.name || "System" },
  }).catch(() => null);
}

async function groqJson(system, user, fallback) {
  if (!env.groqApiKey) return { ...fallback, source: "rule-based" };
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.groqApiKey}` },
      body: JSON.stringify({
        model: env.groqModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\nReturn structured JSON only with keys: answer, suggestedRoute, suggestedAction, supportingRecords, confidence, risk. Never suggest direct database mutation. Prefer exact FlowForge routes when helpful.` },
          { role: "user", content: JSON.stringify(user) },
        ],
        temperature: 0.2,
      }),
    });
    if (!response.ok) throw new Error(`Groq returned ${response.status}`);
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    return { ...JSON.parse(content), source: "groq" };
  } catch (error) {
    return { answer: error.message || "AI response unavailable", recommendations: [], risk: "Unknown", source: "groq-fallback", fallback };
  }
}

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
  ok(res, data);
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
  ok(res, data);
});

erpilotRouter.post("/what-if", async (req, res) => {
  const data = await whatIf(req.body.productId, Number(req.body.quantity || 1));
  await audit(req.user, "ERPILOT_WHAT_IF_SIMULATED", "Product", req.body.productId, `ERPilot simulated ${data.quantity} x ${data.productName}`);
  await saveAnalysis(req, "what-if", "Product", req.body.productId, req.body, data);
  ok(res, data);
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
  const blockedMo = so.manufacturingOrders.find((m) => m.status !== "Done");
  const pendingPo = so.purchaseOrders.find((p) => p.status !== "Fully_Received");
  const issue = blockedMo ? "Manufacturing not completed" : pendingPo ? "Procurement still pending" : "No major blocker detected";
  const data = { issue, rootCause: blockedMo ? "Open work orders remain in the linked MO." : pendingPo ? "Vendor receipt is pending." : "Order is progressing normally.", affectedMaterial: so.lines.find((l) => l.product.onHand - l.product.reserved < l.qty)?.product.name, affectedMO: blockedMo?.number, affectedPO: pendingPo?.number, expectedRecovery: "1-3 working days", recommendedAction: blockedMo ? "Complete pending work orders in sequence." : "Monitor stock ledger and delivery readiness." };
  await audit(req.user, "ERPILOT_ROOT_CAUSE_ANALYZED", "SalesOrder", so.number, `ERPilot analyzed root cause for ${so.number}`);
  await saveAnalysis(req, "root-cause", "SalesOrder", so.id, req.params, data);
  ok(res, data);
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
  ok(res, data);
});

erpilotRouter.get("/bottlenecks", async (_req, res) => {
  const centers = await prisma.workCenter.findMany({ include: { workOrders: { where: { status: { in: ["Pending", "In_Progress"] } } } } });
  ok(res, centers.map((c) => {
    const totalDuration = c.workOrders.reduce((sum, w) => sum + w.minutes, 0);
    const utilizationPercentage = Math.round((totalDuration / c.dailyCapacityMinutes) * 100);
    return { workCenter: c.name, activeWorkOrders: c.workOrders.length, totalWorkloadMinutes: totalDuration, dailyCapacity: c.dailyCapacityMinutes, utilizationPercentage, status: utilizationPercentage > 100 ? "Blocked" : utilizationPercentage > 70 ? "Warning" : "Healthy", recommendation: utilizationPercentage > 70 ? "Rebalance workload or add capacity." : "Capacity is available." };
  }));
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

erpilotRouter.post("/chat", async (req, res) => {
  const context = {
    products: await prisma.product.findMany({ take: 20 }),
    customers: await prisma.customer.findMany({ take: 20 }),
    salesOrders: await prisma.salesOrder.findMany({ take: 10, include: { lines: true } }),
    purchaseOrders: await prisma.purchaseOrder.findMany({ take: 10, include: { lines: true } }),
    manufacturingOrders: await prisma.manufacturingOrder.findMany({ take: 10, include: { workOrders: true } }),
    boms: await prisma.bom.findMany({ take: 10, include: { components: true, operations: true } }),
    stockMoves: await prisma.stockMove.findMany({ take: 20, orderBy: { date: "desc" } }),
    auditLogs: await prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: "desc" } }),
    alerts: await prisma.alert.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
    users: await prisma.user.findMany({ take: 20, select: { id: true, name: true, email: true, role: true, status: true } }),
    vendors: await prisma.vendor.findMany(),
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
    answer: "ERPilot reviewed current ERP records. Check low stock products, pending purchase receipts, active manufacturing work orders, alerts, and user approvals before committing new demand.",
    supportingRecords: [],
    suggestedRoute: "/dashboard",
    suggestedAction: "Open the dashboard, then review alerts and stock ledger for current blockers.",
    confidence: "Medium",
    risk: "Unknown",
  };
  const data = await groqJson(
    "You are ERPilot, the embedded AI assistant for FlowForge ERP. You can explain and guide every feature: products, customers, vendors, sales orders, purchase orders, BoM, manufacturing orders, stock ledger, audit logs, alerts, users/admin approval, digital twin, and business health. Give concise operational answers, mention exact records when available, and return one suggested FlowForge route from the provided feature map.",
    { question: req.body.question, featureMap, context },
    fallback,
  );
  await saveAnalysis(req, "chat", "Business", "FlowForge", req.body, data, data.source);
  ok(res, data);
});

aiRouter.post("/procurement-advice", async (req, res) => ok(res, { recommendation: "Use MTO manufacturing for Dining Table shortages and purchase components when below reorder level.", computed: req.body, source: "rule-based" }));
aiRouter.post("/business-health", async (_req, res) => ok(res, await businessHealth()));
