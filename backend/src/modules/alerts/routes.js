import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { fail, ok } from "../../utils/response.js";
import { id } from "../../utils/ids.js";
import { alertDto } from "../../utils/serialize.js";

export const alertsRouter = Router();

const roleAlertFilters = {
  Admin: {},
  "Business Owner": {},
  "Inventory Manager": {
    OR: [
      { type: "LOW_STOCK" },
      { type: "MATERIAL_SHORTAGE" },
      { entityType: "Product" },
      { entityType: "StockMove" },
    ],
  },
  "Purchase User": {
    OR: [
      { type: "LOW_STOCK" },
      { type: "PROCUREMENT_REQUIRED" },
      { type: "PURCHASE_OVERDUE" },
      { entityType: "PurchaseOrder" },
      { entityType: "Product" },
    ],
  },
  "Manufacturing User": {
    OR: [
      { type: "MATERIAL_SHORTAGE" },
      { type: "WORK_ORDER_BLOCKED" },
      { entityType: "ManufacturingOrder" },
      { entityType: "Product" },
    ],
  },
  "Sales User": {
    OR: [
      { type: "DELIVERY_READY" },
      { type: "ORDER_DELAY_RISK" },
      { entityType: "SalesOrder" },
    ],
  },
};

function alertWhereForRole(role) {
  return roleAlertFilters[role] ?? { id: "__no_alerts_for_role__" };
}

async function ensureInventoryAlerts() {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, onHand: true, reserved: true, reorderLevel: true },
  });

  for (const product of products) {
    const free = product.onHand - product.reserved;
    if (free > product.reorderLevel) continue;

    const existing = await prisma.alert.findFirst({
      where: {
        read: false,
        type: "LOW_STOCK",
        entityType: "Product",
        entityId: product.id,
      },
    });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        id: id("alert"),
        type: "LOW_STOCK",
        severity: free <= 0 ? "Critical" : "Warning",
        title: free <= 0 ? "Stock unavailable" : "Low stock threshold reached",
        message: `${product.name} has ${free} free-to-use stock against reorder level ${product.reorderLevel}.`,
        entityType: "Product",
        entityId: product.id,
        actionLink: `/products/${product.id}`,
      },
    });
  }
}

alertsRouter.get("/", async (req, res) => {
  await ensureInventoryAlerts();
  const where = alertWhereForRole(req.user?.role);
  ok(res, (await prisma.alert.findMany({ where, orderBy: { createdAt: "desc" } })).map(alertDto));
});

alertsRouter.post("/", (_req, _res, next) => {
  next(fail(405, "MANUAL_ALERTS_DISABLED", "Alerts are generated automatically from ERP activity."));
});

alertsRouter.post("/:id/read", async (req, res) => {
  const alert = await prisma.alert.findFirst({
    where: { AND: [{ id: req.params.id }, alertWhereForRole(req.user?.role)] },
  });
  if (!alert) throw fail(404, "ALERT_NOT_FOUND", "Alert not found");
  ok(res, alertDto(await prisma.alert.update({ where: { id: req.params.id }, data: { read: true } })));
});

alertsRouter.patch("/:id/read", async (req, res) => {
  const alert = await prisma.alert.findFirst({
    where: { AND: [{ id: req.params.id }, alertWhereForRole(req.user?.role)] },
  });
  if (!alert) throw fail(404, "ALERT_NOT_FOUND", "Alert not found");
  ok(res, alertDto(await prisma.alert.update({ where: { id: req.params.id }, data: { read: true } })));
});

alertsRouter.post("/mark-all-read", async (req, res) => {
  const result = await prisma.alert.updateMany({
    where: { AND: [{ read: false }, alertWhereForRole(req.user?.role)] },
    data: { read: true },
  });
  ok(res, result);
});
