import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createSalesOrder, confirmSalesOrder, startManufacturingOrder, completeManufacturingOrder, deliverSalesOrder } from "../src/modules/erpService.js";

const prisma = new PrismaClient();
const runId = `lifecycle-${Date.now()}`;
const user = { name: "Lifecycle Tester" };
const log = (message, detail = "") => console.log(`${message}${detail ? `: ${detail}` : ""}`);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function cleanup(createdIds) {
  await prisma.inventoryReservation.deleteMany({ where: { salesOrderId: { in: createdIds.salesOrders } } });
  await prisma.stockMove.deleteMany({ where: { reference: { in: createdIds.references } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdIds.references } } });
  await prisma.workOrder.deleteMany({ where: { manufacturingOrderId: { in: createdIds.manufacturingOrders } } });
  await prisma.manufacturingOrder.deleteMany({ where: { id: { in: createdIds.manufacturingOrders } } });
  await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: { in: createdIds.salesOrders } } });
  await prisma.salesOrder.deleteMany({ where: { id: { in: createdIds.salesOrders } } });
}

async function main() {
  const created = { salesOrders: [], manufacturingOrders: [], references: [] };
  const customer = await prisma.customer.findFirst({ where: { name: { contains: "Raj Furniture Mart" } } });
  const diningTable = await prisma.product.findUnique({ where: { sku: "FG-DT-001" } });
  const legs = await prisma.product.findUnique({ where: { sku: "RM-LEG-001" } });
  const top = await prisma.product.findUnique({ where: { sku: "RM-TOP-001" } });
  const screws = await prisma.product.findUnique({ where: { sku: "RM-SCR-001" } });
  assert(customer, "Raj Furniture Mart customer not found");
  assert(diningTable && legs && top && screws, "Dining Table/component products not found");

  await prisma.product.update({ where: { id: diningTable.id }, data: { onHand: 5, reserved: 0 } });
  await cleanup({ salesOrders: [], manufacturingOrders: [], references: [runId] });

  log("Creating Sales Order", "20 Dining Tables");
  const so = await createSalesOrder({
    customerId: customer.id,
    date: new Date().toISOString(),
    createdBy: "Priya Shah",
    lines: [{ productId: diningTable.id, qty: 20, unitPrice: diningTable.salesPrice }],
  }, user);
  created.salesOrders.push(so.id);
  created.references.push(so.reference);

  log("Confirming Sales Order", so.reference);
  const confirmed = await confirmSalesOrder(so.id, user);
  const moAction = confirmed.actions.find((action) => action.refId && String(action.action || "").includes("Manufacturing"));
  assert(moAction, "Confirm did not create manufacturing procurement");
  assert(Number(moAction.shortage) === 15, `Expected shortage 15, got ${moAction.shortage}`);
  created.manufacturingOrders.push(moAction.refId);
  created.references.push(moAction.refNumber);

  const mo = await prisma.manufacturingOrder.findUnique({
    where: { id: moAction.refId },
    include: { bom: { include: { components: { include: { product: true } } } }, workOrders: true },
  });
  assert(mo?.qty === 15, `Expected MO qty 15, got ${mo?.qty}`);
  const required = Object.fromEntries(mo.bom.components.map((c) => [c.product.sku, c.qty * mo.qty]));
  assert(required["RM-LEG-001"] === 60, `Expected 60 Wooden Legs, got ${required["RM-LEG-001"]}`);
  assert(required["RM-TOP-001"] === 15, `Expected 15 Wooden Tops, got ${required["RM-TOP-001"]}`);
  assert(required["RM-SCR-001"] === 180, `Expected 180 Screws, got ${required["RM-SCR-001"]}`);
  log("Verified MO component multiplication", "60 legs, 15 tops, 180 screws");

  log("Starting Manufacturing Order", mo.number);
  await startManufacturingOrder(mo.id, user);
  log("Producing Manufacturing Order", mo.number);
  await completeManufacturingOrder(mo.id, user);

  const producedProduct = await prisma.product.findUnique({ where: { id: diningTable.id } });
  assert(producedProduct.onHand >= 20, `Expected Dining Table stock >= 20 before delivery, got ${producedProduct.onHand}`);

  log("Delivering Sales Order", so.reference);
  const delivered = await deliverSalesOrder(so.id, undefined, user);
  assert(["Fully Delivered", "Partially Delivered"].includes(delivered.status), `Unexpected SO status ${delivered.status}`);

  const saleDeliveryMove = await prisma.stockMove.findFirst({ where: { reference: so.reference, type: "SALE_DELIVERY" } });
  const deliveryAudit = await prisma.auditLog.findFirst({ where: { entityId: so.reference, action: { contains: "SO_DELIVER" } } });
  assert(saleDeliveryMove, "SALE_DELIVERY stock move was not created");
  assert(deliveryAudit, "Delivery audit log was not created");

  log("Lifecycle test passed", `SO ${so.reference}, MO ${mo.number}`);
}

main()
  .catch((error) => {
    console.error(`Lifecycle test failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
