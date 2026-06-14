import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { ok, fail } from "../utils/response.js";
import { id } from "../utils/ids.js";
import { salesOrderDto, purchaseOrderDto, manufacturingOrderDto, stockMoveDto, auditDto } from "../utils/serialize.js";
import { createSalesOrder, confirmSalesOrder, deliverSalesOrder, cancelSalesOrder, receivePurchaseOrder, startManufacturingOrder, completeWorkOrder, completeManufacturingOrder, audit } from "./erpService.js";

const includeSO = { customer: true, lines: true, manufacturingOrders: true, purchaseOrders: true };
const includePO = { vendor: true, lines: true };
const includeManufacturing = { product: true, workOrders: true, bom: { include: { components: { include: { product: true } }, operations: true } } };

export const salesRouter = Router();
salesRouter.get("/", async (_req, res) => ok(res, (await prisma.salesOrder.findMany({ include: includeSO, orderBy: { createdAt: "desc" } })).map(salesOrderDto)));
salesRouter.post("/", async (req, res) => ok(res, await createSalesOrder(req.body, req.user), 201));
salesRouter.get("/:id", async (req, res) => ok(res, salesOrderDto(await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include: includeSO }))));
salesRouter.post("/:id/confirm", async (req, res) => ok(res, await confirmSalesOrder(req.params.id, req.user)));
salesRouter.post("/:id/deliver", async (req, res) => ok(res, await deliverSalesOrder(req.params.id, req.body?.qtyMap, req.user)));
salesRouter.post("/:id/cancel", async (req, res) => ok(res, await cancelSalesOrder(req.params.id, req.user)));
salesRouter.put("/:id", async (req, res) => {
  const before = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include: includeSO });
  if (!before) throw fail(404, "SO_NOT_FOUND", "Sales order not found");
  if (before.status !== "Draft") throw fail(409, "SO_READONLY", "Only draft sales orders can be edited");
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (!req.body.customerId || !req.body.date || !req.body.createdBy || !lines.length) {
    throw fail(400, "SO_INCOMPLETE", "Customer, creation date, sales person and at least one product line are required");
  }
  if (lines.some((line) => !line.productId || Number(line.qty) <= 0 || Number(line.unitPrice) <= 0)) {
    throw fail(400, "SO_INCOMPLETE_LINES", "Every sales order line must have product, ordered quantity and sales unit price");
  }
  if (Array.isArray(req.body.lines)) {
    await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: req.params.id } });
  }
  const so = await prisma.salesOrder.update({ where: { id: req.params.id }, data: {
    customerId: req.body.customerId,
    createdBy: req.body.createdBy,
    lines: { create: lines.map((l) => ({ id: id("sol"), productId: l.productId, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) },
  }, include: includeSO });
  await audit(req.user, "SO_UPDATED", "SalesOrder", so.number, `Updated ${so.number}`, prisma, before, so);
  ok(res, salesOrderDto(so));
});

export const purchaseRouter = Router();
purchaseRouter.get("/", async (_req, res) => ok(res, (await prisma.purchaseOrder.findMany({ include: includePO, orderBy: { createdAt: "desc" } })).map(purchaseOrderDto)));
purchaseRouter.post("/", async (req, res) => {
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (!req.body.vendorId || !req.body.date || !req.body.responsiblePerson || !lines.length) {
    throw fail(400, "PO_INCOMPLETE", "Vendor, creation date, responsible person and at least one product line are required");
  }
  if (lines.some((line) => !line.productId || Number(line.qty) <= 0 || Number(line.unitPrice) <= 0)) {
    throw fail(400, "PO_INCOMPLETE_LINES", "Every purchase order line must have product, ordered quantity and cost unit price");
  }
  const number = `PO-${3001 + await prisma.purchaseOrder.count()}`;
  const po = await prisma.purchaseOrder.create({ data: { id: id("po"), number, vendorId: req.body.vendorId, responsiblePerson: req.body.responsiblePerson, date: new Date(req.body.date || Date.now()), expectedDate: new Date(req.body.expectedDate || Date.now()), source: String(req.body.source || "Manual").replaceAll(" ", "_"), lines: { create: lines.map((l) => ({ id: id("pol"), productId: l.productId, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) } }, include: includePO });
  await audit(req.user, "PO_CREATED", "PurchaseOrder", po.number, `Created ${po.number}`);
  ok(res, purchaseOrderDto(po), 201);
});
purchaseRouter.get("/:id", async (req, res) => ok(res, purchaseOrderDto(await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO }))));
purchaseRouter.post("/:id/confirm", async (req, res) => {
  const before = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO });
  if (!before) throw fail(404, "PO_NOT_FOUND", "Purchase order not found");
  if (before.status !== "Draft") throw fail(409, "PO_NOT_DRAFT", "Only draft purchase orders can be confirmed");
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: "Confirmed" }, include: includePO });
  await audit(req.user, "PO_CONFIRMED", "PurchaseOrder", po.number, `Confirmed ${po.number}`, prisma, { status: before?.status }, { status: po.status });
  ok(res, purchaseOrderDto(po));
});
purchaseRouter.post("/:id/receive", async (req, res) => ok(res, await receivePurchaseOrder(req.params.id, req.body?.qtyMap, req.user)));
purchaseRouter.post("/:id/cancel", async (req, res) => {
  const before = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO });
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: "Cancelled" }, include: includePO });
  await audit(req.user, "PO_CANCELLED", "PurchaseOrder", po.number, `Cancelled ${po.number}`, prisma, { status: before?.status }, { status: po.status });
  ok(res, purchaseOrderDto(po));
});
purchaseRouter.put("/:id", async (req, res) => {
  const before = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO });
  if (!before) throw fail(404, "PO_NOT_FOUND", "Purchase order not found");
  if (before.status !== "Draft") throw fail(409, "PO_READONLY", "Only draft purchase orders can be edited");
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (!req.body.vendorId || !req.body.date || !req.body.responsiblePerson || !lines.length) {
    throw fail(400, "PO_INCOMPLETE", "Vendor, creation date, responsible person and at least one product line are required");
  }
  if (lines.some((line) => !line.productId || Number(line.qty) <= 0 || Number(line.unitPrice) <= 0)) {
    throw fail(400, "PO_INCOMPLETE_LINES", "Every purchase order line must have product, ordered quantity and cost unit price");
  }
  if (Array.isArray(req.body.lines)) {
    await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: req.params.id } });
  }
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: {
    vendorId: req.body.vendorId,
    responsiblePerson: req.body.responsiblePerson,
    date: req.body.date ? new Date(req.body.date) : undefined,
    expectedDate: req.body.expectedDate ? new Date(req.body.expectedDate) : undefined,
    lines: { create: lines.map((l) => ({ id: id("pol"), productId: l.productId, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) },
  }, include: includePO });
  await audit(req.user, "PO_UPDATED", "PurchaseOrder", po.number, `Updated ${po.number}`, prisma, before, po);
  ok(res, purchaseOrderDto(po));
});

export const manufacturingRouter = Router();
manufacturingRouter.get("/", async (_req, res) => ok(res, (await prisma.manufacturingOrder.findMany({ include: includeManufacturing, orderBy: { createdAt: "desc" } })).map(manufacturingOrderDto)));
manufacturingRouter.post("/", async (req, res, next) => {
  try {
    const qty = Number(req.body.qty);
    if (!req.body.productId || !req.body.bomId || !req.body.assignee || !req.body.scheduledDate || !Number.isFinite(qty) || qty <= 0) {
      throw fail(400, "INVALID_MO", "Finished product, BoM, assignee, schedule date and a positive quantity are required");
    }

    const [product, bom] = await Promise.all([
      prisma.product.findUnique({ where: { id: req.body.productId } }),
      prisma.bom.findUnique({ where: { id: req.body.bomId }, include: { operations: true } }),
    ]);
    if (!product) throw fail(404, "PRODUCT_NOT_FOUND", "Finished product not found");
    if (!bom) throw fail(404, "BOM_NOT_FOUND", "BoM not found");
    if (bom.productId !== product.id) throw fail(400, "BOM_PRODUCT_MISMATCH", "Selected BoM does not belong to the finished product");

    const number = `MO-${2001 + await prisma.manufacturingOrder.count()}`;
    const mo = await prisma.manufacturingOrder.create({
      data: {
        id: id("mo"),
        number,
        productId: product.id,
        qty,
        bomId: bom.id,
        assignee: req.body.assignee,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : new Date(),
        sourceSOId: req.body.sourceSOId,
        status: req.body.status || "Draft",
        workOrders: { create: bom.operations.map((o, i) => ({ id: id("wo"), name: o.name, workCenter: o.workCenter, minutes: o.minutes * qty, sequence: i + 1 })) },
      },
      include: includeManufacturing,
    });
    await audit(req.user, "MO_CREATED", "ManufacturingOrder", mo.number, `Created ${mo.number}`);
    ok(res, manufacturingOrderDto(mo), 201);
  } catch (err) {
    next(err);
  }
});
manufacturingRouter.get("/:id", async (req, res) => ok(res, manufacturingOrderDto(await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: includeManufacturing }))));
manufacturingRouter.put("/:id", async (req, res, next) => {
  try {
    const before = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: includeManufacturing });
    if (!before) throw fail(404, "MO_NOT_FOUND", "Manufacturing order not found");
    if (before.status !== "Draft") throw fail(409, "MO_READONLY", "Only draft manufacturing orders can be edited");
    const qty = Number(req.body.qty);
    if (!req.body.productId || !req.body.bomId || !req.body.assignee || !req.body.scheduledDate || !Number.isFinite(qty) || qty <= 0) {
      throw fail(400, "INVALID_MO", "Finished product, BoM, assignee, schedule date and a positive quantity are required");
    }
    const [product, bom] = await Promise.all([
      prisma.product.findUnique({ where: { id: req.body.productId } }),
      prisma.bom.findUnique({ where: { id: req.body.bomId }, include: { operations: true } }),
    ]);
    if (!product) throw fail(404, "PRODUCT_NOT_FOUND", "Finished product not found");
    if (!bom) throw fail(404, "BOM_NOT_FOUND", "BoM not found");
    if (bom.productId !== product.id) throw fail(400, "BOM_PRODUCT_MISMATCH", "Selected BoM does not belong to the finished product");
    await prisma.workOrder.deleteMany({ where: { manufacturingOrderId: req.params.id } });
    const mo = await prisma.manufacturingOrder.update({
      where: { id: req.params.id },
      data: {
        productId: product.id,
        qty,
        bomId: bom.id,
        assignee: req.body.assignee,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : before.scheduledDate,
        workOrders: { create: bom.operations.map((o, i) => ({ id: id("wo"), name: o.name, workCenter: o.workCenter, minutes: o.minutes * qty, sequence: i + 1 })) },
      },
      include: includeManufacturing,
    });
    await audit(req.user, "MO_UPDATED", "ManufacturingOrder", mo.number, `Updated ${mo.number}`, prisma, before, mo);
    ok(res, manufacturingOrderDto(mo));
  } catch (err) {
    next(err);
  }
});
manufacturingRouter.post("/:id/confirm", async (req, res) => {
  const before = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: includeManufacturing });
  if (!before) throw fail(404, "MO_NOT_FOUND", "Manufacturing order not found");
  if (before.status !== "Draft") throw fail(409, "MO_NOT_DRAFT", "Only draft manufacturing orders can be confirmed");
  if (!before.productId || !before.bomId || !before.assignee || before.qty <= 0) throw fail(400, "INVALID_MO", "Finished product, BoM, assignee and quantity are required");
  const mo = await prisma.manufacturingOrder.update({ where: { id: req.params.id }, data: { status: "Confirmed" }, include: includeManufacturing });
  await audit(req.user, "MO_CONFIRMED", "ManufacturingOrder", mo.number, `Confirmed ${mo.number}`, prisma, { status: before.status }, { status: mo.status });
  ok(res, manufacturingOrderDto(mo));
});
manufacturingRouter.post("/:id/start", async (req, res) => ok(res, await startManufacturingOrder(req.params.id, req.user)));
manufacturingRouter.post("/:id/complete-workorder/:workOrderId", async (req, res) => ok(res, await completeWorkOrder(req.params.id, req.params.workOrderId, req.user)));
manufacturingRouter.post("/:id/work-orders/:workOrderId/complete", async (req, res) => ok(res, await completeWorkOrder(req.params.id, req.params.workOrderId, req.user)));
manufacturingRouter.post("/:id/complete", async (req, res) => ok(res, await completeManufacturingOrder(req.params.id, req.user)));
manufacturingRouter.post("/:id/produce", async (req, res) => ok(res, await completeManufacturingOrder(req.params.id, req.user)));
manufacturingRouter.post("/:id/cancel", async (req, res) => {
  const before = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id }, include: includeManufacturing });
  if (!before) throw fail(404, "MO_NOT_FOUND", "Manufacturing order not found");
  if (before.status === "Done") throw fail(409, "MO_DONE", "Completed manufacturing orders cannot be cancelled");
  const mo = await prisma.manufacturingOrder.update({ where: { id: req.params.id }, data: { status: "Cancelled" }, include: includeManufacturing });
  await audit(req.user, "MO_CANCELLED", "ManufacturingOrder", mo.number, `Cancelled ${mo.number}`, prisma, { status: before.status }, { status: mo.status });
  ok(res, manufacturingOrderDto(mo));
});

export const stockRouter = Router();
function stockWhere(query) {
  const where = {};
  if (query.productId) where.productId = String(query.productId);
  if (query.movementType) where.type = String(query.movementType);
  if (query.referenceType) where.referenceType = String(query.referenceType);
  if (query.referenceId) where.referenceId = { contains: String(query.referenceId) };
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(String(query.from));
    if (query.to) where.date.lte = new Date(`${String(query.to)}T23:59:59`);
  }
  if (query.search) {
    const search = String(query.search);
    where.OR = [{ reference: { contains: search } }, { referenceId: { contains: search } }, { product: { is: { name: { contains: search } } } }, { product: { is: { sku: { contains: search } } } }];
  }
  return where;
}
const stockInclude = { product: true };
const canManageInventory = (user) => ["Admin", "Inventory Manager"].includes(user?.role);
stockRouter.get("/", async (req, res) => {
  const take = Math.min(Number(req.query.limit || req.query.rowsPerPage || 100), 200);
  const page = Math.max(Number(req.query.page || 1), 1);
  const where = stockWhere(req.query);
  const [rows, total] = await Promise.all([
    prisma.stockMove.findMany({ where, include: stockInclude, orderBy: { date: "desc" }, skip: (page - 1) * take, take }),
    prisma.stockMove.count({ where }),
  ]);
  ok(res, { rows: rows.map(stockMoveDto), total, page, rowsPerPage: take });
});
stockRouter.get("/product/:productId", async (req, res) => ok(res, (await prisma.stockMove.findMany({ where: { productId: req.params.productId }, include: { product: true }, orderBy: { date: "desc" } })).map(stockMoveDto)));
stockRouter.get("/summary", async (req, res) => {
  const where = stockWhere(req.query);
  const [moves, products] = await Promise.all([prisma.stockMove.findMany({ where, include: stockInclude }), prisma.product.findMany()]);
  const incoming = moves.filter((m) => m.change > 0).reduce((sum, m) => sum + m.change, 0);
  const outgoing = Math.abs(moves.filter((m) => m.change < 0).reduce((sum, m) => sum + m.change, 0));
  ok(res, {
    totalMovements: moves.length,
    incomingQty: incoming,
    outgoingQty: outgoing,
    reservedQty: products.reduce((sum, p) => sum + p.reserved, 0),
    internalTransfers: moves.filter((m) => m.type === "INTERNAL_TRANSFER").length,
    exceptions: products.filter((p) => p.onHand < 0 || p.onHand - p.reserved < 0 || p.reserved > p.onHand).length,
  });
});
stockRouter.get("/map", async (req, res) => {
  const moves = await prisma.stockMove.findMany({ where: stockWhere(req.query), include: stockInclude, orderBy: { date: "desc" }, take: 500 });
  const edgeKey = (move) => move.type.includes("PURCHASE") ? "Vendor->Raw Material" : move.type.includes("MO_COMPONENT") ? "Raw Material->Production" : move.type.includes("MO_FINISHED") ? "Production->Finished Goods" : move.type.includes("SALE") ? "Finished Goods->Customer" : move.type.includes("SCRAP") ? "Production->Scrap" : "Warehouse->Warehouse";
  const edgeTone = (key) => key.startsWith("Vendor") ? "incoming" : key.startsWith("Raw") ? "reserved" : key.startsWith("Production") ? "production" : key.startsWith("Finished") ? "outgoing" : key.includes("Scrap") ? "exception" : "transfer";
  const edges = Object.values(moves.reduce((acc, move) => {
    const key = edgeKey(move);
    acc[key] ||= { id: key, from: key.split("->")[0], to: key.split("->")[1], quantity: 0, movements: 0, products: new Set(), latestAt: move.date, tone: edgeTone(key) };
    acc[key].quantity += Math.abs(move.change); acc[key].movements += 1; acc[key].products.add(move.productId);
    if (move.date > acc[key].latestAt) acc[key].latestAt = move.date;
    return acc;
  }, {})).map((edge) => ({ ...edge, latestAt: edge.latestAt.toISOString(), uniqueProducts: edge.products.size, products: undefined })).sort((a, b) => b.quantity - a.quantity);
  const nodes = ["Vendor", "Raw Material", "Production", "Finished Goods", "Customer", "Scrap", "Warehouse"].map((name) => {
    const incoming = edges.filter((edge) => edge.to === name).reduce((sum, edge) => sum + edge.quantity, 0);
    const outgoing = edges.filter((edge) => edge.from === name).reduce((sum, edge) => sum + edge.quantity, 0);
    const movements = edges.filter((edge) => edge.from === name || edge.to === name).reduce((sum, edge) => sum + edge.movements, 0);
    return { id: name, name, incoming, outgoing, movements, active: movements > 0 };
  });
  ok(res, { generatedAt: new Date().toISOString(), nodes, edges });
});
stockRouter.get("/traceability", async (req, res) => {
  const moves = await prisma.stockMove.findMany({ where: stockWhere(req.query), include: stockInclude, orderBy: { date: "asc" }, take: 200 });
  ok(res, moves.map((m) => ({ id: m.id, product: m.product?.name, sku: m.product?.sku, movementType: m.type, referenceType: m.referenceType, referenceId: m.referenceId || m.reference, occurredAt: m.date, path: `${m.product?.name || "Product"} -> ${m.type.replaceAll("_", " ")} -> ${m.referenceId || m.reference}` })));
});
stockRouter.get("/exceptions", async (_req, res) => {
  const products = await prisma.product.findMany();
  const rows = products.flatMap((p) => {
    const available = p.onHand - p.reserved;
    const issues = [];
    if (p.onHand < 0) issues.push({ severity: "Critical", product: p.name, sku: p.sku, problem: "Negative on-hand quantity", expected: ">= 0", actual: p.onHand });
    if (available < 0) issues.push({ severity: "Critical", product: p.name, sku: p.sku, problem: "Negative available quantity", expected: ">= 0", actual: available });
    if (p.reserved > p.onHand) issues.push({ severity: "Warning", product: p.name, sku: p.sku, problem: "Reserved quantity greater than on hand", expected: `<= ${p.onHand}`, actual: p.reserved });
    return issues.map((issue, index) => ({ id: `${p.id}-${index}`, detectedAt: new Date().toISOString(), reference: p.sku, assignedUser: "Inventory Manager", status: "Open", resolutionNote: "", ...issue }));
  });
  ok(res, rows);
});
stockRouter.post("/adjustment", async (req, res) => {
  if (!canManageInventory(req.user)) throw fail(403, "FORBIDDEN", "Only Admin and Inventory Manager can adjust stock");
  const qty = Number(req.body.quantity || 0);
  if (!req.body.productId || !Number.isFinite(qty) || qty <= 0 || !req.body.reason || !req.body.note) throw fail(400, "INVALID_ADJUSTMENT", "Product, quantity, reason and note are required");
  const direction = String(req.body.direction || "Increase");
  const change = direction === "Decrease" ? -qty : qty;
  const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
  if (!product) throw fail(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (product.onHand + change < 0) throw fail(400, "INSUFFICIENT_STOCK", "Adjustment would make on-hand stock negative");
  const moveType = change >= 0 ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT";
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id: product.id } });
    const afterQty = before.onHand + change;
    await tx.product.update({ where: { id: product.id }, data: { onHand: afterQty } });
    const sm = await tx.stockMove.create({ data: { id: id("sm"), date: new Date(), productId: product.id, type: moveType, change, before: before.onHand, after: afterQty, reference: "Stock adjustment", referenceType: "ADJ", referenceId: product.sku, note: `${req.body.reason}: ${req.body.note}`, user: req.user?.name || "System" } });
    await audit(req.user, "STOCK_ADJUSTMENT_POSTED", "Product", product.sku, `Stock adjustment posted for ${product.name}`, tx, { onHand: before.onHand }, { onHand: afterQty, reason: req.body.reason });
    return sm;
  });
  ok(res, stockMoveDto({ ...result, product }));
});
stockRouter.post("/internal-transfer", async (req, res) => {
  if (!canManageInventory(req.user)) throw fail(403, "FORBIDDEN", "Only Admin and Inventory Manager can create transfers");
  const qty = Number(req.body.quantity || 0);
  if (!req.body.productId || !req.body.sourceLocation || !req.body.destinationLocation || req.body.sourceLocation === req.body.destinationLocation || !Number.isFinite(qty) || qty <= 0) throw fail(400, "INVALID_TRANSFER", "Product, different locations and positive quantity are required");
  const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
  if (!product) throw fail(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (product.onHand - product.reserved < qty) throw fail(400, "INSUFFICIENT_STOCK", "Not enough available stock for transfer");
  const sm = await prisma.stockMove.create({ data: { id: id("sm"), date: new Date(), productId: product.id, type: "INTERNAL_TRANSFER", change: 0, before: product.onHand, after: product.onHand, reference: `${req.body.sourceLocation} -> ${req.body.destinationLocation}`, referenceType: "TRANSFER", referenceId: product.sku, note: req.body.note || "Internal transfer", user: req.user?.name || "System" } });
  await audit(req.user, "INTERNAL_TRANSFER_POSTED", "Product", product.sku, `Internal transfer for ${product.name}: ${qty}`, prisma, undefined, { quantity: qty, sourceLocation: req.body.sourceLocation, destinationLocation: req.body.destinationLocation });
  ok(res, stockMoveDto({ ...sm, product, sourceLocation: req.body.sourceLocation, destinationLocation: req.body.destinationLocation }));
});

export const auditRouter = Router();
function auditWhere(query) {
  const where = {};
  if (query.module) where.entityType = String(query.module);
  if (query.recordType) where.entityType = String(query.recordType);
  if (query.recordId) where.entityId = String(query.recordId);
  if (query.user) where.user = String(query.user);
  if (query.action) where.action = String(query.action);
  if (query.from || query.to) {
    where.timestamp = {};
    if (query.from) where.timestamp.gte = new Date(String(query.from));
    if (query.to) where.timestamp.lte = new Date(String(query.to));
  }
  return where;
}
auditRouter.get("/", async (req, res) => ok(res, (await prisma.auditLog.findMany({ where: auditWhere(req.query), orderBy: { timestamp: "desc" } })).map(auditDto)));
auditRouter.get("/summary", async (req, res) => {
  const logs = await prisma.auditLog.findMany({ where: auditWhere(req.query) });
  ok(res, {
    totalLogs: logs.length,
    createActions: logs.filter((l) => l.action.includes("CREATE") || l.action.includes("CREATED")).length,
    updateActions: logs.filter((l) => l.action.includes("UPDATE") || l.action.includes("UPDATED") || l.action.includes("CONFIRM") || l.action.includes("DELIVER") || l.action.includes("RECEIVE") || l.action.includes("START") || l.action.includes("COMPLETE")).length,
    deleteActions: logs.filter((l) => l.action.includes("DELETE") || l.action.includes("DELETED") || l.action.includes("CANCEL")).length,
  });
});
auditRouter.get("/record/:module/:recordId", async (req, res) => ok(res, (await prisma.auditLog.findMany({ where: { entityType: req.params.module, entityId: req.params.recordId }, orderBy: { timestamp: "desc" } })).map(auditDto)));
