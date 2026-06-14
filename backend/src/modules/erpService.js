import { prisma } from "../config/prisma.js";
import { addDays, today } from "../utils/dates.js";
import { id } from "../utils/ids.js";
import { fail } from "../utils/response.js";
import { salesOrderDto, purchaseOrderDto, manufacturingOrderDto } from "../utils/serialize.js";

const includeSO = { lines: true, manufacturingOrders: true, purchaseOrders: true };
const includePO = { lines: true };
const includeManufacturing = { workOrders: true, bom: { include: { components: true, operations: true } } };

export async function audit(user, action, entityType, entityId, message, tx = prisma, before = undefined, after = undefined) {
  return tx.auditLog.create({
    data: {
      id: id("al"),
      timestamp: new Date(),
      user: user?.name || "System",
      action,
      entityType,
      entityId,
      message,
      before,
      after,
    },
  });
}

async function alert(type, severity, title, message, entityType, entityId, actionLink, tx = prisma) {
  return tx.alert.create({ data: { id: id("alert"), type, severity, title, message, entityType, entityId, actionLink } });
}

export async function move(productId, type, change, reference, note, tx = prisma, reserveOnly = false, user = undefined) {
  const p = await tx.product.findUnique({ where: { id: productId } });
  if (!p) throw fail(404, "PRODUCT_NOT_FOUND", "Product not found");
  const physicalBefore = p.onHand;
  const availableBefore = p.onHand - p.reserved;
  const ledgerChange = reserveOnly ? -Math.abs(change) : change;
  const before = reserveOnly ? availableBefore : physicalBefore;
  const after = reserveOnly ? availableBefore + ledgerChange : physicalBefore + change;
  await tx.product.update({
    where: { id: productId },
    data: reserveOnly ? { reserved: { increment: change } } : { onHand: after },
  });
  const stockMove = await tx.stockMove.create({
    data: {
      id: id("sm"), date: new Date(), productId, type, change: ledgerChange, before, after, reference, note,
      referenceType: reference.split("-")[0] || "System", referenceId: reference, user: user?.name || "System",
    },
  });
  const fresh = await tx.product.findUnique({ where: { id: productId } });
  if (fresh && fresh.onHand - fresh.reserved <= fresh.reorderLevel) {
    await alert("LOW_STOCK", "Warning", "Low stock threshold reached", `${fresh.name} free-to-use stock is at or below reorder level.`, "Product", fresh.id, `/products/${fresh.id}`, tx);
  }
  return stockMove;
}

async function nextNumber(prefix, model, base, tx) {
  const count = await tx[model].count();
  return `${prefix}-${base + count + 1}`;
}

function validateSalesOrderInput(input) {
  const lines = Array.isArray(input?.lines) ? input.lines : [];
  if (!input?.customerId || !input?.date || !input?.createdBy || !lines.length) {
    throw fail(400, "SO_INCOMPLETE", "Customer, creation date, sales person and at least one product line are required");
  }
  if (lines.some((line) => !line.productId || Number(line.qty) <= 0 || Number(line.unitPrice) <= 0)) {
    throw fail(400, "SO_INCOMPLETE_LINES", "Every sales order line must have product, ordered quantity and sales unit price");
  }
  return lines;
}

export async function createSalesOrder(input, user) {
  const lines = validateSalesOrderInput(input);
  const number = await nextNumber("SO", "salesOrder", 1002, prisma);
  const so = await prisma.salesOrder.create({
    data: {
      id: id("so"), number, customerId: input.customerId, date: new Date(input.date || today()),
      createdBy: input.createdBy || user?.name || "System",
      lines: { create: lines.map((l) => ({ id: id("sol"), productId: l.productId, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })) },
    },
    include: includeSO,
  });
  await audit(user, "SO_CREATED", "SalesOrder", so.number, `Created sales order ${so.number}`);
  return salesOrderDto(so);
}

export async function confirmSalesOrder(soId, user) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: includeSO });
    if (!so) throw fail(404, "SO_NOT_FOUND", "Sales order not found");
    if (so.status !== "Draft") return { salesOrder: salesOrderDto(so), actions: [], alreadyConfirmed: true };
    if (!so.customerId || !so.date || !so.createdBy || !so.lines.length) throw fail(400, "SO_INCOMPLETE", "Customer, schedule date, salesperson and at least one product line are required before confirmation");
    if (so.lines.some((line) => !line.productId || line.qty <= 0 || line.unitPrice <= 0)) throw fail(400, "SO_INCOMPLETE_LINES", "Every sales order line must have product, ordered quantity and sales unit price before confirmation");
    const actions = [];
    let procurementTriggered = false;
    for (const line of so.lines) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      const free = Math.max(0, product.onHand - product.reserved);
      const reserveQty = Math.min(free, line.qty);
      const shortage = line.qty - reserveQty;
      if (reserveQty > 0) await move(product.id, "SALE_RESERVE", reserveQty, so.number, `Reserved for ${so.number}`, tx, true, user);
      if (reserveQty > 0) await tx.inventoryReservation.create({ data: { id: id("res"), productId: product.id, salesOrderId: so.id, qty: reserveQty } });
      const action = { productId: product.id, productName: product.name, ordered: line.qty, available: free, shortage, strategy: product.strategy, procurementType: product.procurementType, action: shortage ? "" : "Reserved from stock. No procurement needed." };
      if (shortage > 0 && product.procureOnDemand) {
        await alert("PROCUREMENT_REQUIRED", "Warning", "Procurement required", `${so.number} needs ${shortage} additional ${product.name}.`, "SalesOrder", so.id, `/sales-orders/${so.id}`, tx);
        procurementTriggered = true;
        if (product.procurementType === "Manufacturing") {
          const bom = product.bomId
            ? await tx.bom.findUnique({ where: { id: product.bomId }, include: { operations: true } })
            : await tx.bom.findFirst({ where: { productId: product.id }, include: { operations: true } });
          if (!bom) throw fail(400, "BOM_NOT_FOUND", `Create a BoM for ${product.name} before confirming this sales order`);
          const number = await nextNumber("MO", "manufacturingOrder", 2000, tx);
          const mo = await tx.manufacturingOrder.create({
            data: {
              id: id("mo"), number, productId: product.id, qty: shortage, bomId: bom.id, assignee: user?.name || "System", sourceSOId: so.id, status: "Confirmed",
              workOrders: { create: bom.operations.sort((a, b) => a.sequence - b.sequence).map((op, i) => ({ id: id("wo"), name: op.name, workCenter: op.workCenter, minutes: op.minutes * shortage, sequence: i + 1 })) },
            },
          });
          await audit(user, "MO_AUTO_CREATED", "ManufacturingOrder", mo.number, `Auto-created MO for ${shortage} x ${product.name} (${so.number})`, tx);
          Object.assign(action, { action: `Manufacturing Order created for ${shortage} units`, refId: mo.id, refNumber: mo.number });
        } else {
          if (!product.vendorId) throw fail(400, "VENDOR_REQUIRED", `Select a vendor for ${product.name} before automatic purchase procurement`);
          const vendor = await tx.vendor.findUnique({ where: { id: product.vendorId } });
          if (!vendor) throw fail(400, "VENDOR_NOT_FOUND", `Selected vendor for ${product.name} was not found`);
          const number = await nextNumber("PO", "purchaseOrder", 3000, tx);
          const po = await tx.purchaseOrder.create({
            data: {
              id: id("po"), number, vendorId: vendor.id, date: new Date(), expectedDate: addDays(vendor.leadTimeDays), status: "Confirmed", source: "Auto_from_Sales_Order", sourceSOId: so.id,
              lines: { create: [{ id: id("pol"), productId: product.id, qty: shortage, unitPrice: product.costPrice }] },
            },
          });
          await audit(user, "PO_AUTO_CREATED", "PurchaseOrder", po.number, `Auto-created PO for ${shortage} x ${product.name} (${so.number})`, tx);
          Object.assign(action, { action: `Purchase Order created for ${shortage} units from ${vendor.name}`, refId: po.id, refNumber: po.number });
        }
      }
      actions.push(action);
    }
    const updated = await tx.salesOrder.update({ where: { id: soId }, data: { status: "Confirmed", procurementTriggered }, include: includeSO });
    await audit(user, "SO_CONFIRMED", "SalesOrder", updated.number, `Confirmed ${updated.number}`, tx, { status: so.status }, { status: updated.status });
    return { salesOrder: salesOrderDto(updated), actions };
  });
}

export async function deliverSalesOrder(soId, qtyMap = {}, user) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: includeSO });
    if (!so) throw fail(404, "SO_NOT_FOUND", "Sales order not found");
    if (!["Confirmed", "Partially_Delivered"].includes(so.status)) {
      throw fail(409, "SO_NOT_DELIVERABLE", "Only confirmed or partially delivered sales orders can be delivered");
    }
    for (const line of so.lines) {
      const p = await tx.product.findUnique({ where: { id: line.productId } });
      const remaining = Math.max(0, line.qty - line.deliveredQty);
      const requested = Number(qtyMap[line.productId] ?? remaining);
      if (requested < 0) throw fail(400, "INVALID_DELIVERY_QTY", "Delivery quantity cannot be negative");
      if (requested > remaining) throw fail(400, "DELIVERY_EXCEEDS_ORDER", "Delivery quantity exceeds remaining order quantity");
      if (requested > p.onHand) throw fail(400, "DELIVERY_EXCEEDS_STOCK", "Delivery quantity exceeds available stock");
      const qty = requested;
      if (qty > 0) {
        await move(p.id, "SALE_DELIVERY", -qty, so.number, `Delivered for ${so.number}`, tx, false, user);
        await tx.product.update({ where: { id: p.id }, data: { reserved: Math.max(0, p.reserved - qty) } });
        await tx.salesOrderLine.update({ where: { id: line.id }, data: { deliveredQty: { increment: qty } } });
      }
    }
    const fresh = await tx.salesOrder.findUnique({ where: { id: soId }, include: includeSO });
    const all = fresh.lines.every((l) => l.deliveredQty >= l.qty);
    const some = fresh.lines.some((l) => l.deliveredQty > 0);
    const status = all ? "Fully_Delivered" : some ? "Partially_Delivered" : fresh.status;
    const updated = await tx.salesOrder.update({ where: { id: soId }, data: { status }, include: includeSO });
    await audit(user, all ? "SO_DELIVERED" : "SO_PARTIALLY_DELIVERED", "SalesOrder", updated.number, all ? `Delivered ${updated.number} in full` : `Partially delivered ${updated.number}`, tx, { status: so.status }, { status: updated.status });
    return salesOrderDto(updated);
  });
}

export async function cancelSalesOrder(soId, user) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: includeSO });
    if (!so) throw fail(404, "SO_NOT_FOUND", "Sales order not found");
    if (so.status === "Cancelled") return salesOrderDto(so);
    if (["Confirmed", "Partially_Delivered"].includes(so.status)) {
      for (const line of so.lines) {
        const p = await tx.product.findUnique({ where: { id: line.productId } });
        const releaseQty = Math.min(p.reserved, Math.max(0, line.qty - line.deliveredQty));
        if (releaseQty > 0) {
          const beforeAvailable = p.onHand - p.reserved;
          await tx.product.update({ where: { id: p.id }, data: { reserved: { decrement: releaseQty } } });
          await tx.inventoryReservation.updateMany({ where: { productId: p.id, salesOrderId: so.id, status: "Active" }, data: { status: "Released", releasedAt: new Date() } });
          await tx.stockMove.create({ data: { id: id("sm"), date: new Date(), productId: p.id, type: "SALE_UNRESERVE", change: releaseQty, before: beforeAvailable, after: beforeAvailable + releaseQty, reference: so.number, referenceType: "SO", referenceId: so.id, note: `Released reservation for ${so.number}`, user: user?.name || "System" } });
        }
      }
    }
    const updated = await tx.salesOrder.update({ where: { id: soId }, data: { status: "Cancelled" }, include: includeSO });
    await audit(user, "SO_CANCELLED", "SalesOrder", updated.number, `Cancelled ${updated.number}`, tx, { status: so.status }, { status: updated.status });
    return salesOrderDto(updated);
  });
}

export async function receivePurchaseOrder(poId, qtyMap = {}, user) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: includePO });
    if (!po) throw fail(404, "PO_NOT_FOUND", "Purchase order not found");
    if (!["Confirmed", "Partially_Received"].includes(po.status)) throw fail(409, "PO_NOT_RECEIVABLE", "Confirm the purchase order before receiving, and do not receive cancelled or completed orders");
    for (const line of po.lines) {
      const remaining = Math.max(0, line.qty - line.receivedQty);
      const requested = qtyMap[line.productId] ?? remaining;
      if (requested > remaining) throw fail(400, "RECEIPT_EXCEEDS_ORDER", "Receipt quantity exceeds remaining purchase quantity");
      const qty = requested;
      if (qty > 0) {
        await move(line.productId, "PURCHASE_RECEIPT", qty, po.number, `Received from vendor`, tx, false, user);
        await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQty: { increment: qty } } });
      }
    }
    const fresh = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: includePO });
    const all = fresh.lines.every((l) => l.receivedQty >= l.qty);
    const updated = await tx.purchaseOrder.update({ where: { id: poId }, data: { status: all ? "Fully_Received" : "Partially_Received" }, include: includePO });
    await audit(user, all ? "PO_RECEIVED" : "PO_PARTIALLY_RECEIVED", "PurchaseOrder", updated.number, all ? `Fully received ${updated.number}` : `Partially received ${updated.number}`, tx, { status: po.status }, { status: updated.status });
    return purchaseOrderDto(updated);
  });
}

export async function startManufacturingOrder(moId, user) {
  return prisma.$transaction(async (tx) => {
    const mo = await tx.manufacturingOrder.findUnique({ where: { id: moId }, include: includeManufacturing });
    if (!mo) throw fail(404, "MO_NOT_FOUND", "Manufacturing order not found");
    if (["In_Progress", "Done"].includes(mo.status)) return { started: false, shortages: [] };
    if (mo.status !== "Confirmed") throw fail(409, "MO_NOT_CONFIRMED", "Confirm the manufacturing order before starting");
    const shortages = [];
    for (const c of mo.bom.components) {
      const p = await tx.product.findUnique({ where: { id: c.productId } });
      const need = c.qty * mo.qty;
      const available = p.onHand - p.reserved;
      if (available < need) shortages.push({ name: p.name, needed: need, available });
    }
    if (shortages.length) throw fail(409, "COMPONENT_SHORTAGE", "Components are insufficient to start manufacturing", shortages);
    for (const c of mo.bom.components) await move(c.productId, "MO_COMPONENT_RESERVE", c.qty * mo.qty, mo.number, `Reserved for ${mo.number}`, tx, true, user);
    const first = mo.workOrders.sort((a, b) => a.sequence - b.sequence)[0];
    if (first) await tx.workOrder.update({ where: { id: first.id }, data: { status: "In_Progress" } });
    const updated = await tx.manufacturingOrder.update({ where: { id: moId }, data: { status: "In_Progress" }, include: includeManufacturing });
    await audit(user, "MO_STARTED", "ManufacturingOrder", updated.number, `Started ${updated.number}`, tx, { status: mo.status }, { status: updated.status });
    return { started: true, manufacturingOrder: manufacturingOrderDto(updated), shortages: [] };
  });
}

export async function completeWorkOrder(moId, woId, user) {
  const mo = await prisma.manufacturingOrder.findUnique({ where: { id: moId }, include: { workOrders: true } });
  const workOrders = mo.workOrders.sort((a, b) => a.sequence - b.sequence);
  const idx = workOrders.findIndex((w) => w.id === woId);
  if (idx < 0) throw fail(404, "WO_NOT_FOUND", "Work order not found");
  if (workOrders[idx].status !== "In_Progress") throw fail(409, "WO_NOT_IN_PROGRESS", "Work order is not in progress");
  await prisma.workOrder.update({ where: { id: woId }, data: { status: "Done" } });
  if (workOrders[idx + 1]) await prisma.workOrder.update({ where: { id: workOrders[idx + 1].id }, data: { status: "In_Progress" } });
  await audit(user, "WO_COMPLETED", "ManufacturingOrder", mo.number, `Completed work order ${workOrders[idx].name} on ${mo.number}`);
  return manufacturingOrderDto(await prisma.manufacturingOrder.findUnique({ where: { id: moId }, include: includeManufacturing }));
}

export async function completeManufacturingOrder(moId, user) {
  return prisma.$transaction(async (tx) => {
    const mo = await tx.manufacturingOrder.findUnique({ where: { id: moId }, include: includeManufacturing });
    if (!mo) throw fail(404, "MO_NOT_FOUND", "Manufacturing order not found");
    if (mo.status === "Done") throw fail(409, "MO_ALREADY_DONE", "Manufacturing order is already done");
    if (mo.status === "Cancelled") throw fail(409, "MO_CANCELLED", "Cancelled manufacturing orders cannot be produced");
    if (mo.status === "Draft") throw fail(409, "MO_NOT_CONFIRMED", "Confirm the manufacturing order before producing");
    for (const workOrder of mo.workOrders) {
      if (workOrder.status !== "Done") {
        await tx.workOrder.update({ where: { id: workOrder.id }, data: { status: "Done" } });
      }
    }
    for (const c of mo.bom.components) {
      const need = c.qty * mo.qty;
      const p = await tx.product.findUnique({ where: { id: c.productId } });
      await tx.product.update({ where: { id: c.productId }, data: { reserved: Math.max(0, p.reserved - need) } });
      await move(c.productId, "MO_COMPONENT_CONSUME", -need, mo.number, `Consumed in ${mo.number}`, tx, false, user);
    }
    await move(mo.productId, "MO_FINISHED_PRODUCE", mo.qty, mo.number, `Produced from ${mo.number}`, tx, false, user);
    const updated = await tx.manufacturingOrder.update({ where: { id: moId }, data: { status: "Done" }, include: includeManufacturing });
    await audit(user, "MO_COMPLETED", "ManufacturingOrder", updated.number, `Completed ${updated.number} and produced ${updated.qty} units`, tx, { status: mo.status }, { status: updated.status });
    return manufacturingOrderDto(updated);
  });
}
