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
  const number = `PO-${3001 + await prisma.purchaseOrder.count()}`;
  const po = await prisma.purchaseOrder.create({ data: { id: id("po"), number, vendorId: req.body.vendorId, date: new Date(req.body.date || Date.now()), expectedDate: new Date(req.body.expectedDate || Date.now()), source: String(req.body.source || "Manual").replaceAll(" ", "_"), lines: { create: req.body.lines.map((l) => ({ id: id("pol"), productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })) } }, include: includePO });
  await audit(req.user, "PO_CREATED", "PurchaseOrder", po.number, `Created ${po.number}`);
  ok(res, purchaseOrderDto(po), 201);
});
purchaseRouter.get("/:id", async (req, res) => ok(res, purchaseOrderDto(await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO }))));
purchaseRouter.post("/:id/confirm", async (req, res) => {
  const before = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO });
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
  if (Array.isArray(req.body.lines)) {
    await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: req.params.id } });
  }
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: {
    vendorId: req.body.vendorId,
    date: req.body.date ? new Date(req.body.date) : undefined,
    expectedDate: req.body.expectedDate ? new Date(req.body.expectedDate) : undefined,
    lines: Array.isArray(req.body.lines) ? { create: req.body.lines.map((l) => ({ id: id("pol"), productId: l.productId, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) } : undefined,
  }, include: includePO });
  await audit(req.user, "PO_UPDATED", "PurchaseOrder", po.number, `Updated ${po.number}`, prisma, before, po);
  ok(res, purchaseOrderDto(po));
});

export const manufacturingRouter = Router();
manufacturingRouter.get("/", async (_req, res) => ok(res, (await prisma.manufacturingOrder.findMany({ include: includeManufacturing, orderBy: { createdAt: "desc" } })).map(manufacturingOrderDto)));
manufacturingRouter.post("/", async (req, res, next) => {
  try {
    const qty = Number(req.body.qty);
    if (!req.body.productId || !req.body.bomId || !Number.isFinite(qty) || qty <= 0) {
      throw fail(400, "INVALID_MO", "Finished product, BoM, and a positive quantity are required");
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
        assignee: req.body.assignee || req.user?.name || "System",
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
    if (!req.body.productId || !req.body.bomId || !req.body.assignee || !Number.isFinite(qty) || qty <= 0) {
      throw fail(400, "INVALID_MO", "Finished product, BoM, assignee and a positive quantity are required");
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
stockRouter.get("/", async (_req, res) => ok(res, (await prisma.stockMove.findMany({ include: { product: true }, orderBy: { date: "desc" } })).map(stockMoveDto)));
stockRouter.get("/product/:productId", async (req, res) => ok(res, (await prisma.stockMove.findMany({ where: { productId: req.params.productId }, include: { product: true }, orderBy: { date: "desc" } })).map(stockMoveDto)));

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
