import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [];
const pass = (name, ok, detail = "") => checks.push({ name, ok, detail });

async function main() {
  const [
    users, customers, vendors, products, finished, components, boms, salesOrders,
    purchaseOrders, manufacturingOrders, stockMoves, auditLogs, alerts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.vendor.count(),
    prisma.product.count(),
    prisma.product.count({ where: { type: "Finished" } }),
    prisma.product.count({ where: { type: "Component" } }),
    prisma.bom.count(),
    prisma.salesOrder.count(),
    prisma.purchaseOrder.count(),
    prisma.manufacturingOrder.count(),
    prisma.stockMove.count(),
    prisma.auditLog.count(),
    prisma.alert.count(),
  ]);

  pass("users count >= 6", users >= 6, String(users));
  pass("customers count >= 100", customers >= 100, String(customers));
  pass("vendors count >= 8", vendors >= 8, String(vendors));
  pass("products count >= 15", products >= 15, String(products));
  pass("finished products count >= 6", finished >= 6, String(finished));
  pass("component products count >= 9", components >= 9, String(components));
  pass("BoMs count >= 6", boms >= 6, String(boms));
  pass("sales orders count >= 10", salesOrders >= 10, String(salesOrders));
  pass("purchase orders count >= 6", purchaseOrders >= 6, String(purchaseOrders));
  pass("manufacturing orders count >= 6", manufacturingOrders >= 6, String(manufacturingOrders));
  pass("stock moves count > 0", stockMoves > 0, String(stockMoves));
  pass("audit logs count > 0", auditLogs > 0, String(auditLogs));
  pass("alerts count > 0", alerts > 0, String(alerts));

  const allBoms = await prisma.bom.findMany({ include: { components: true, operations: true } });
  pass("each BoM has at least one component", allBoms.every((bom) => bom.components.length > 0), `${allBoms.filter((bom) => bom.components.length === 0).length} empty`);
  pass("each BoM has at least one operation", allBoms.every((bom) => bom.operations.length > 0), `${allBoms.filter((bom) => bom.operations.length === 0).length} empty`);

  const diningTable = await prisma.product.findUnique({ where: { sku: "FG-DT-001" } });
  pass("Dining Table exists", Boolean(diningTable), diningTable?.id || "missing");

  const diningBom = diningTable
    ? await prisma.bom.findFirst({ where: { productId: diningTable.id }, include: { components: { include: { product: true } }, operations: true } })
    : null;
  pass("Dining Table BoM exists", Boolean(diningBom), diningBom?.name || "missing");
  const diningComponentNames = new Set((diningBom?.components || []).map((c) => c.product.name));
  pass("Dining Table BoM has Wooden Legs, Wooden Top, Screws", ["Wooden Legs", "Wooden Top", "Screws"].every((name) => diningComponentNames.has(name)), [...diningComponentNames].join(", "));

  const so20 = diningTable ? await prisma.salesOrder.findFirst({ where: { lines: { some: { productId: diningTable.id, qty: 20 } } } }) : null;
  pass("Sales Order for 20 Dining Tables exists", Boolean(so20), so20?.number || "missing");

  const mo15 = diningTable ? await prisma.manufacturingOrder.findFirst({ where: { productId: diningTable.id, qty: 15 }, include: { bom: { include: { components: { include: { product: true } } } } } }) : null;
  pass("MO for 15 Dining Tables exists or can be created", Boolean(mo15), mo15?.number || "missing");

  const required = Object.fromEntries((mo15?.bom.components || []).map((c) => [c.product.name, c.qty * mo15.qty]));
  pass("15 Dining Tables = 60 Wooden Legs", required["Wooden Legs"] === 60, String(required["Wooden Legs"] ?? "missing"));
  pass("15 Dining Tables = 15 Wooden Tops", required["Wooden Top"] === 15, String(required["Wooden Top"] ?? "missing"));
  pass("15 Dining Tables = 180 Screws", required.Screws === 180, String(required.Screws ?? "missing"));

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} - ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }
  const failures = checks.filter((check) => !check.ok);
  if (failures.length) {
    console.error(`\nSeed validation failed: ${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nSeed validation passed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
