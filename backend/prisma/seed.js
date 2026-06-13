import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash("Admin@123", 10);
const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 86400000);
const daysFromNow = (days) => new Date(now.getTime() + days * 86400000);

const roleUsers = [
  ["u-admin", "Aarav Mehta", "admin@flowforge.com", "Admin"],
  ["u-sales", "Priya Shah", "sales@flowforge.com", "Sales_User"],
  ["u-purchase", "Rohit Verma", "purchase@flowforge.com", "Purchase_User"],
  ["u-mfg", "Ishita Rao", "mfg@flowforge.com", "Manufacturing_User"],
  ["u-inventory", "Karan Singh", "inventory@flowforge.com", "Inventory_Manager"],
  ["u-owner", "Neha Kapoor", "owner@flowforge.com", "Business_Owner"],
];

const cities = ["Vadodara", "Ahmedabad", "Surat", "Rajkot", "Mumbai", "Pune", "Jaipur", "Udaipur", "Indore", "Bhopal", "Nashik", "Delhi"];
const baseCustomers = [
  "Raj Furniture Mart", "Urban Living Stores", "Shree Home Decor", "Patel Interiors", "Royal Wood House",
  "Galaxy Furnishings", "Modern Living Studio", "City Furniture Hub", "Interior Point", "Classic Furniture Gallery",
  "Krishna Home Furnishings", "Om Furniture Traders", "Elegant Interiors", "Mahadev Furniture House", "Harmony Home Studio",
  "Apex Furniture Retail", "Noble Wood Gallery", "Comfort Living Store", "Heritage Furniture Mart", "Prime Decor House",
];
const customers = Array.from({ length: 100 }, (_, i) => {
  const city = cities[i % cities.length];
  const base = baseCustomers[i % baseCustomers.length];
  const name = i < baseCustomers.length ? base : `${base} ${city}`;
  return {
    id: `seed-customer-${String(i + 1).padStart(3, "0")}`,
    name,
    company: `${name} Pvt Ltd`,
    email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/\.$/, "")}@shivfurniture.in`,
    phone: `+91 98${String(20000000 + i * 137).slice(-8)}`,
    address: `${12 + i}, ${["MG Road", "Ring Road", "Industrial Area", "Market Street"][i % 4]}, ${city}, India`,
    active: true,
  };
});

const vendors = [
  ["seed-vendor-01", "Patel Wood Suppliers", "Hiren Patel", ["Wood", "Plywood"], "Ahmedabad", 4, 88, 23.0225, 72.5714],
  ["seed-vendor-02", "Singh Hardware Co.", "Manjeet Singh", ["Screws", "Hinges", "Handles"], "Delhi", 5, 86, 28.6139, 77.209],
  ["seed-vendor-03", "Bharat Plywood Traders", "Amit Agarwal", ["Plywood"], "Surat", 6, 84, 21.1702, 72.8311],
  ["seed-vendor-04", "Royal Timber Depot", "Rakesh Jain", ["Wood"], "Jaipur", 7, 82, 26.9124, 75.7873],
  ["seed-vendor-05", "Gujarat Hardware Mart", "Nilesh Shah", ["Hinges", "Handles", "Metal Bracket"], "Vadodara", 5, 87, 22.3072, 73.1812],
  ["seed-vendor-06", "Sunrise Paints & Polish", "Meera Desai", ["Paint", "Polish"], "Mumbai", 3, 91, 19.076, 72.8777],
  ["seed-vendor-07", "Shree Foam & Cushion Works", "Sanjay Nair", ["Foam"], "Pune", 5, 85, 18.5204, 73.8567],
  ["seed-vendor-08", "Elite Glass Suppliers", "Farhan Khan", ["Glass"], "Delhi", 8, 80, 28.7041, 77.1025],
  ["seed-vendor-09", "National Adhesives", "Pooja Menon", ["Adhesive"], "Nashik", 4, 83, 19.9975, 73.7898],
  ["seed-vendor-10", "Premium Fabric House", "Imran Shaikh", ["Fabric"], "Mumbai", 6, 81, 19.1176, 72.906],
  ["seed-vendor-11", "Rajkot Metal Fittings", "Dhaval Joshi", ["Metal Bracket", "Fittings"], "Rajkot", 5, 84, 22.3039, 70.8022],
  ["seed-vendor-12", "Om Packaging Supplies", "Anita Sharma", ["Packaging"], "Indore", 4, 86, 22.7196, 75.8577],
].map(([id, name, contact, supplies, city, leadTimeDays, reliabilityScore, lat, lng], i) => ({
  id, name, contact, supplies,
  email: `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, ".")}@shivfurniture.in`,
  phone: `+91 99${String(10000000 + i * 4821).slice(-8)}`,
  address: `${city} Industrial Estate, ${city}, India`,
  leadTimeDays, reliabilityScore, costScore: 75 + (i % 5) * 3, lat, lng, active: true,
}));

const productRows = [
  ["seed-prod-dining-table", "Dining Table", "FG-DT-001", "Finished", 12000, 8000, 5, 0, 5, "MTO", true, "Manufacturing", null, "seed-bom-dining-table"],
  ["seed-prod-wooden-chair", "Wooden Chair", "FG-WC-001", "Finished", 3000, 1800, 100, 0, 20, "MTS", true, "Manufacturing", null, "seed-bom-wooden-chair"],
  ["seed-prod-office-desk", "Office Desk", "FG-OD-001", "Finished", 9000, 6000, 12, 0, 5, "MTO", true, "Manufacturing", null, "seed-bom-office-desk"],
  ["seed-prod-bookshelf", "Bookshelf", "FG-BS-001", "Finished", 7500, 5000, 10, 0, 4, "MTO", true, "Manufacturing", null, "seed-bom-bookshelf"],
  ["seed-prod-wardrobe", "Wardrobe", "FG-WD-001", "Finished", 18000, 12500, 3, 0, 2, "MTO", true, "Manufacturing", null, "seed-bom-wardrobe"],
  ["seed-prod-bed-frame", "Bed Frame", "FG-BF-001", "Finished", 15000, 10000, 4, 0, 2, "MTO", true, "Manufacturing", null, "seed-bom-bed-frame"],
  ["seed-prod-wooden-legs", "Wooden Legs", "RM-LEG-001", "Component", 0, 300, 500, 0, 100, "MTS", true, "Purchase", "seed-vendor-01", null],
  ["seed-prod-wooden-top", "Wooden Top", "RM-TOP-001", "Component", 0, 1500, 150, 0, 30, "MTS", true, "Purchase", "seed-vendor-01", null],
  ["seed-prod-screws", "Screws", "RM-SCR-001", "Component", 0, 2, 5000, 0, 1000, "MTS", true, "Purchase", "seed-vendor-02", null],
  ["seed-prod-plywood-board", "Plywood Board", "RM-PLY-001", "Component", 0, 1200, 300, 0, 50, "MTS", true, "Purchase", "seed-vendor-03", null],
  ["seed-prod-wood-polish", "Wood Polish", "RM-POL-001", "Component", 0, 250, 200, 0, 40, "MTS", true, "Purchase", "seed-vendor-06", null],
  ["seed-prod-paint", "Paint", "RM-PNT-001", "Component", 0, 400, 180, 0, 30, "MTS", true, "Purchase", "seed-vendor-06", null],
  ["seed-prod-door-hinges", "Door Hinges", "RM-HNG-001", "Component", 0, 80, 800, 0, 150, "MTS", true, "Purchase", "seed-vendor-05", null],
  ["seed-prod-drawer-handles", "Drawer Handles", "RM-HDL-001", "Component", 0, 120, 600, 0, 100, "MTS", true, "Purchase", "seed-vendor-05", null],
  ["seed-prod-foam-cushion", "Foam Cushion", "RM-FOM-001", "Component", 0, 600, 100, 0, 20, "MTS", true, "Purchase", "seed-vendor-07", null],
  ["seed-prod-glass-panel", "Glass Panel", "RM-GLS-001", "Component", 0, 900, 80, 0, 15, "MTS", true, "Purchase", "seed-vendor-08", null],
  ["seed-prod-adhesive", "Adhesive", "RM-ADH-001", "Component", 0, 180, 140, 0, 25, "MTS", true, "Purchase", "seed-vendor-09", null],
  ["seed-prod-packaging-box", "Packaging Box", "RM-PKG-001", "Component", 0, 90, 300, 0, 80, "MTS", true, "Purchase", "seed-vendor-12", null],
  ["seed-prod-fabric-roll", "Fabric Roll", "RM-FAB-001", "Component", 0, 700, 70, 0, 20, "MTS", true, "Purchase", "seed-vendor-10", null],
  ["seed-prod-metal-bracket", "Metal Bracket", "RM-MET-001", "Component", 0, 150, 500, 0, 100, "MTS", true, "Purchase", "seed-vendor-11", null],
];

const bomDefs = [
  ["seed-bom-dining-table", "Dining Table BoM", "seed-prod-dining-table", [["seed-prod-wooden-legs", 4], ["seed-prod-wooden-top", 1], ["seed-prod-screws", 12], ["seed-prod-wood-polish", 1]], [["Assembly", "Assembly Line", 60], ["Painting", "Paint Floor", 30], ["Packing", "Packaging Unit", 20]]],
  ["seed-bom-wooden-chair", "Wooden Chair BoM", "seed-prod-wooden-chair", [["seed-prod-wooden-legs", 4], ["seed-prod-plywood-board", 1], ["seed-prod-screws", 8], ["seed-prod-wood-polish", 1], ["seed-prod-foam-cushion", 1]], [["Assembly", "Assembly Line", 35], ["Cushion Fixing", "Cushion Station", 15], ["Polishing", "Paint Floor", 20], ["Packing", "Packaging Unit", 10]]],
  ["seed-bom-office-desk", "Office Desk BoM", "seed-prod-office-desk", [["seed-prod-wooden-legs", 4], ["seed-prod-plywood-board", 2], ["seed-prod-screws", 16], ["seed-prod-drawer-handles", 2], ["seed-prod-wood-polish", 1]], [["Cutting", "Cutting Station", 30], ["Assembly", "Assembly Line", 70], ["Polishing", "Paint Floor", 30], ["Packing", "Packaging Unit", 20]]],
  ["seed-bom-bookshelf", "Bookshelf BoM", "seed-prod-bookshelf", [["seed-prod-plywood-board", 4], ["seed-prod-screws", 24], ["seed-prod-wood-polish", 1]], [["Cutting", "Cutting Station", 40], ["Assembly", "Assembly Line", 90], ["Polishing", "Paint Floor", 35], ["Packing", "Packaging Unit", 20]]],
  ["seed-bom-wardrobe", "Wardrobe BoM", "seed-prod-wardrobe", [["seed-prod-plywood-board", 8], ["seed-prod-door-hinges", 6], ["seed-prod-drawer-handles", 4], ["seed-prod-screws", 40], ["seed-prod-paint", 2]], [["Cutting", "Cutting Station", 80], ["Assembly", "Assembly Line", 140], ["Painting", "Paint Floor", 60], ["Hardware Fitting", "Hardware Fitting Bench", 45], ["Packing", "Packaging Unit", 30]]],
  ["seed-bom-bed-frame", "Bed Frame BoM", "seed-prod-bed-frame", [["seed-prod-wooden-legs", 4], ["seed-prod-plywood-board", 5], ["seed-prod-screws", 32], ["seed-prod-wood-polish", 2]], [["Cutting", "Cutting Station", 50], ["Assembly", "Assembly Line", 120], ["Polishing", "Paint Floor", 45], ["Packing", "Packaging Unit", 25]]],
];

const workCenters = ["Assembly Line", "Paint Floor", "Packaging Unit", "Cutting Station", "Hardware Fitting Bench", "Cushion Station"];

async function clearSeed() {
  await prisma.$executeRawUnsafe("ALTER TABLE `SalesOrder` MODIFY `status` ENUM('Draft', 'Confirmed', 'Partially_Delivered', 'Fully_Delivered', 'Cancelled') NOT NULL DEFAULT 'Draft'");
  await prisma.$executeRawUnsafe("ALTER TABLE `PurchaseOrder` MODIFY `status` ENUM('Draft', 'Confirmed', 'Partially_Received', 'Fully_Received', 'Cancelled') NOT NULL DEFAULT 'Draft'");
  await prisma.$executeRawUnsafe("ALTER TABLE `ManufacturingOrder` MODIFY `status` ENUM('Draft', 'Confirmed', 'In_Progress', 'Done', 'Cancelled') NOT NULL DEFAULT 'Confirmed'");
  await prisma.auditLog.deleteMany();
  await prisma.eRPilotAnalysis.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.stockMove.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.manufacturingOrder.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.bomOperation.deleteMany();
  await prisma.bomComponent.deleteMany();
  await prisma.product.updateMany({ data: { bomId: null } });
  await prisma.bom.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.workCenter.deleteMany();
  await prisma.user.deleteMany();
}

async function seedMasterData() {
  await prisma.user.createMany({ data: roleUsers.map(([id, name, email, role], index) => ({ id, name, email, role, passwordHash, status: "Active", lastLogin: daysAgo(index) })) });
  await prisma.customer.createMany({ data: customers });
  await prisma.vendor.createMany({ data: vendors });
  await prisma.workCenter.createMany({ data: workCenters.map((name, i) => ({ id: `seed-wc-${i + 1}`, name, dailyCapacityMinutes: i === 1 ? 420 : 480 })) });
  await prisma.product.createMany({
    data: productRows.map(([id, name, sku, type, salesPrice, costPrice, onHand, reserved, reorderLevel, strategy, procureOnDemand, procurementType, vendorId]) => ({
      id, name, sku, type, salesPrice, costPrice, onHand, reserved, reorderLevel, strategy, procureOnDemand, procurementType, vendorId, active: true,
    })),
  });
  for (const [bomId, name, productId, components, operations] of bomDefs) {
    await prisma.bom.create({
      data: {
        id: bomId,
        name,
        productId,
        active: true,
        components: { create: components.map(([componentId, qty], i) => ({ id: `${bomId}-component-${i + 1}`, productId: componentId, qty })) },
        operations: { create: operations.map(([opName, workCenter, minutes], i) => ({ id: `${bomId}-operation-${i + 1}`, name: opName, workCenter, minutes, sequence: i + 1 })) },
      },
    });
    await prisma.product.update({ where: { id: productId }, data: { bomId } });
  }
}

async function createSalesOrder(id, number, customerId, productId, qty, unitPrice, status, deliveredQty, date, user = "Priya Shah") {
  await prisma.salesOrder.create({
    data: {
      id, number, customerId, date, status, createdBy: user,
      lines: { create: [{ id: `${id}-line-1`, productId, qty, unitPrice, deliveredQty }] },
    },
  });
}

async function createPurchaseOrder(id, number, vendorId, productId, qty, unitPrice, status, receivedQty, expectedDate, source = "Manual") {
  await prisma.purchaseOrder.create({
    data: {
      id, number, vendorId, date: daysAgo(10), expectedDate, status, source,
      lines: { create: [{ id: `${id}-line-1`, productId, qty, unitPrice, receivedQty }] },
    },
  });
}

async function createManufacturingOrder(id, number, productId, qty, bomId, status, assignee, sourceSOId, offsetDays = 0) {
  const bom = bomDefs.find(([id]) => id === bomId);
  await prisma.manufacturingOrder.create({
    data: {
      id, number, productId, qty, bomId, status, assignee, sourceSOId, createdAt: daysAgo(offsetDays), updatedAt: daysAgo(offsetDays),
      workOrders: {
        create: bom[4].map(([name, workCenter, minutes], i) => ({
          id: `${id}-wo-${i + 1}`,
          name,
          workCenter,
          minutes: minutes * qty,
          sequence: i + 1,
          status: status === "Done" ? "Done" : status === "In_Progress" && i === 0 ? "Done" : status === "In_Progress" && i === 1 ? "In_Progress" : "Pending",
        })),
      },
    },
  });
}

async function stockMove(id, productId, type, change, before, after, reference, note, user = "System", when = now) {
  await prisma.stockMove.create({ data: { id, productId, type, change, before, after, reference, referenceType: reference.split("-")[0] || "System", referenceId: reference, note, user, date: when } });
}

async function seedLifecycleData() {
  const c = (i) => customers[i].id;
  await createSalesOrder("seed-so-dt-draft", "SO-1001", c(0), "seed-prod-dining-table", 20, 12000, "Draft", 0, daysFromNow(5));
  await createSalesOrder("seed-so-dt-confirmed", "SO-1002", c(0), "seed-prod-dining-table", 20, 12000, "Confirmed", 0, daysAgo(2));
  await createSalesOrder("seed-so-chair-confirmed", "SO-1003", c(1), "seed-prod-wooden-chair", 10, 3000, "Confirmed", 0, daysFromNow(3));
  await createSalesOrder("seed-so-office-partial", "SO-1004", c(2), "seed-prod-office-desk", 8, 9000, "Partially_Delivered", 3, daysAgo(4));
  await createSalesOrder("seed-so-chair-delivered", "SO-1005", c(3), "seed-prod-wooden-chair", 5, 3000, "Fully_Delivered", 5, daysAgo(8));
  await createSalesOrder("seed-so-bed-cancelled", "SO-1006", c(4), "seed-prod-bed-frame", 2, 15000, "Cancelled", 0, daysAgo(7));
  await createSalesOrder("seed-so-wardrobe-late", "SO-1007", c(5), "seed-prod-wardrobe", 4, 18000, "Confirmed", 0, daysAgo(14));
  await createSalesOrder("seed-so-bookshelf-draft", "SO-1008", c(6), "seed-prod-bookshelf", 3, 7500, "Draft", 0, daysFromNow(2));
  await createSalesOrder("seed-so-desk-confirmed", "SO-1009", c(7), "seed-prod-office-desk", 2, 9000, "Confirmed", 0, daysFromNow(6));
  await createSalesOrder("seed-so-chair-partial", "SO-1010", c(8), "seed-prod-wooden-chair", 12, 3000, "Partially_Delivered", 6, daysAgo(3));
  await createSalesOrder("seed-so-dining-delivered", "SO-1011", c(9), "seed-prod-dining-table", 1, 12000, "Fully_Delivered", 1, daysAgo(11));
  await createSalesOrder("seed-so-bookshelf-late", "SO-1012", c(10), "seed-prod-bookshelf", 7, 7500, "Confirmed", 0, daysAgo(20));

  await prisma.inventoryReservation.createMany({ data: [
    { id: "seed-res-so1002-dining", productId: "seed-prod-dining-table", salesOrderId: "seed-so-dt-confirmed", qty: 5 },
    { id: "seed-res-so1003-chair", productId: "seed-prod-wooden-chair", salesOrderId: "seed-so-chair-confirmed", qty: 10 },
  ] });

  await createPurchaseOrder("seed-po-draft-legs", "PO-3001", "seed-vendor-01", "seed-prod-wooden-legs", 200, 300, "Draft", 0, daysFromNow(5));
  await createPurchaseOrder("seed-po-confirmed-screws", "PO-3002", "seed-vendor-02", "seed-prod-screws", 2000, 2, "Confirmed", 0, daysFromNow(3));
  await createPurchaseOrder("seed-po-partial-plywood", "PO-3003", "seed-vendor-03", "seed-prod-plywood-board", 100, 1200, "Partially_Received", 40, daysFromNow(1));
  await createPurchaseOrder("seed-po-received-paint", "PO-3004", "seed-vendor-06", "seed-prod-paint", 50, 400, "Fully_Received", 50, daysAgo(4));
  await createPurchaseOrder("seed-po-received-polish", "PO-3005", "seed-vendor-06", "seed-prod-wood-polish", 80, 250, "Fully_Received", 80, daysAgo(3));
  await createPurchaseOrder("seed-po-late-screws", "PO-3006", "seed-vendor-02", "seed-prod-screws", 1500, 2, "Confirmed", 0, daysAgo(8));
  await createPurchaseOrder("seed-po-cancelled-glass", "PO-3007", "seed-vendor-08", "seed-prod-glass-panel", 20, 900, "Cancelled", 0, daysFromNow(4));
  await createPurchaseOrder("seed-po-partial-fabric", "PO-3008", "seed-vendor-10", "seed-prod-fabric-roll", 30, 700, "Partially_Received", 10, daysAgo(1));

  await createManufacturingOrder("seed-mo-draft-desk", "MO-2001", "seed-prod-office-desk", 4, "seed-bom-office-desk", "Draft", "Ishita Rao", null, 0);
  await createManufacturingOrder("seed-mo-dining-confirmed", "MO-2002", "seed-prod-dining-table", 15, "seed-bom-dining-table", "Confirmed", "Ishita Rao", "seed-so-dt-confirmed", 1);
  await createManufacturingOrder("seed-mo-chair-progress", "MO-2003", "seed-prod-wooden-chair", 20, "seed-bom-wooden-chair", "In_Progress", "Ishita Rao", null, 2);
  await createManufacturingOrder("seed-mo-bookshelf-done", "MO-2004", "seed-prod-bookshelf", 5, "seed-bom-bookshelf", "Done", "Ishita Rao", null, 4);
  await createManufacturingOrder("seed-mo-bed-cancelled", "MO-2005", "seed-prod-bed-frame", 2, "seed-bom-bed-frame", "Cancelled", "Ishita Rao", null, 3);
  await createManufacturingOrder("seed-mo-wardrobe-late", "MO-2006", "seed-prod-wardrobe", 3, "seed-bom-wardrobe", "Confirmed", "Ishita Rao", null, 12);
  await createManufacturingOrder("seed-mo-dining-progress", "MO-2007", "seed-prod-dining-table", 6, "seed-bom-dining-table", "In_Progress", "Ishita Rao", null, 5);
  await createManufacturingOrder("seed-mo-chair-done", "MO-2008", "seed-prod-wooden-chair", 15, "seed-bom-wooden-chair", "Done", "Ishita Rao", null, 6);

  await stockMove("seed-sm-sale-reserve-1", "seed-prod-dining-table", "SALE_RESERVE", 5, 5, 5, "SO-1002", "Reserved Dining Tables for Raj Furniture Mart", "Priya Shah", daysAgo(2));
  await stockMove("seed-sm-sale-delivery-1", "seed-prod-wooden-chair", "SALE_DELIVERY", -5, 100, 95, "SO-1005", "Delivered chairs", "Priya Shah", daysAgo(8));
  await stockMove("seed-sm-purchase-receipt-1", "seed-prod-paint", "PURCHASE_RECEIPT", 50, 130, 180, "PO-3004", "Received paint from Sunrise Paints & Polish", "Rohit Verma", daysAgo(4));
  await stockMove("seed-sm-purchase-receipt-2", "seed-prod-wood-polish", "PURCHASE_RECEIPT", 80, 120, 200, "PO-3005", "Received wood polish", "Rohit Verma", daysAgo(3));
  await stockMove("seed-sm-mo-reserve-1", "seed-prod-wooden-legs", "MO_COMPONENT_RESERVE", 80, 500, 500, "MO-2003", "Reserved legs for Wooden Chair MO", "Ishita Rao", daysAgo(2));
  await stockMove("seed-sm-mo-consume-1", "seed-prod-plywood-board", "MO_COMPONENT_CONSUME", -20, 320, 300, "MO-2004", "Consumed plywood for Bookshelf", "Ishita Rao", daysAgo(4));
  await stockMove("seed-sm-mo-produce-1", "seed-prod-bookshelf", "MO_FINISHED_PRODUCE", 5, 5, 10, "MO-2004", "Produced Bookshelves", "Ishita Rao", daysAgo(4));
  await stockMove("seed-sm-release-1", "seed-prod-bed-frame", "RESERVATION_RELEASE", -2, 4, 4, "SO-1006", "Released reservation after cancellation", "Priya Shah", daysAgo(7));
  await stockMove("seed-sm-adjust-1", "seed-prod-plywood-board", "ADJUSTMENT", 20, 280, 300, "Manual adjustment", "Cycle count correction", "Karan Singh", daysAgo(6));
}

async function seedLogsAlertsAi() {
  const statusChange = (from, to) => [{ status: from }, { status: to }];
  const logs = [
    ["USER_LOGIN", "User", "sales@flowforge.com", "Sales user signed in"],
    ["PRODUCT_CREATED", "Product", "FG-DT-001", "Created Dining Table"],
    ["CUSTOMER_CREATED", "Customer", "Raj Furniture Mart", "Created customer Raj Furniture Mart"],
    ["VENDOR_CREATED", "Vendor", "Patel Wood Suppliers", "Created vendor Patel Wood Suppliers"],
    ["BOM_CREATED", "BoM", "Dining Table BoM", "Created Dining Table BoM"],
    ["SO_CREATED", "SalesOrder", "SO-1001", "Created draft Dining Table sales order"],
    ["SO_CONFIRMED", "SalesOrder", "SO-1002", "Confirmed SO-1002 and created manufacturing shortage", ...statusChange("Draft", "Confirmed")],
    ["MO_AUTO_CREATED", "ManufacturingOrder", "MO-2002", "Auto-created MO for 15 Dining Tables"],
    ["SO_PARTIALLY_DELIVERED", "SalesOrder", "SO-1004", "Partially delivered Office Desk order", ...statusChange("Confirmed", "Partially_Delivered")],
    ["SO_DELIVERED", "SalesOrder", "SO-1005", "Delivered Wooden Chair order", ...statusChange("Confirmed", "Fully_Delivered")],
    ["SO_CANCELLED", "SalesOrder", "SO-1006", "Cancelled Bed Frame order", ...statusChange("Draft", "Cancelled")],
    ["PO_CONFIRMED", "PurchaseOrder", "PO-3002", "Confirmed Screws purchase order", ...statusChange("Draft", "Confirmed")],
    ["PO_PARTIALLY_RECEIVED", "PurchaseOrder", "PO-3003", "Partially received plywood", ...statusChange("Confirmed", "Partially_Received")],
    ["PO_RECEIVED", "PurchaseOrder", "PO-3004", "Received paint purchase order", ...statusChange("Confirmed", "Fully_Received")],
    ["MO_CONFIRMED", "ManufacturingOrder", "MO-2002", "Confirmed Dining Table MO", ...statusChange("Draft", "Confirmed")],
    ["MO_STARTED", "ManufacturingOrder", "MO-2003", "Started Wooden Chair MO", ...statusChange("Confirmed", "In_Progress")],
    ["WO_COMPLETED", "ManufacturingOrder", "MO-2003", "Completed first work order", ...statusChange("Pending", "Done")],
    ["MO_COMPLETED", "ManufacturingOrder", "MO-2004", "Completed Bookshelf MO", ...statusChange("In_Progress", "Done")],
    ["STOCK_ADJUSTED", "Product", "RM-PLY-001", "Adjusted plywood stock after cycle count", { onHand: 280 }, { onHand: 300 }],
    ["ERPILOT_ANALYSIS_RUN", "ERPilot", "business-health", "ERPilot business health analysis generated"],
  ];
  await prisma.auditLog.createMany({
    data: logs.map(([action, entityType, entityId, message, before, after], i) => ({
      id: `seed-audit-${i + 1}`,
      timestamp: daysAgo(Math.floor(i / 3)),
      user: i % 2 ? "System" : "Aarav Mehta",
      action,
      entityType,
      entityId,
      message,
      before,
      after,
    })),
  });

  const alerts = [
    ["LOW_STOCK", "Warning", "Plywood Board near reorder level", "Plywood Board should be replenished soon.", "Product", "seed-prod-plywood-board", "/products/seed-prod-plywood-board", false],
    ["MATERIAL_SHORTAGE", "Critical", "Dining Table shortage", "SO-1002 needs 15 more Dining Tables through manufacturing.", "SalesOrder", "seed-so-dt-confirmed", "/sales-orders/seed-so-dt-confirmed", false],
    ["PROCUREMENT_REQUIRED", "Warning", "Manufacturing procurement required", "Dining Table shortage triggered MO-2002.", "ManufacturingOrder", "seed-mo-dining-confirmed", "/manufacturing-orders/seed-mo-dining-confirmed", false],
    ["ORDER_DELAY_RISK", "Warning", "Wardrobe order is late", "SO-1007 is past its planned date and not delivered.", "SalesOrder", "seed-so-wardrobe-late", "/sales-orders/seed-so-wardrobe-late", false],
    ["BOTTLENECK_RISK", "Warning", "Packaging Unit bottleneck risk", "Packaging workload is increasing this week.", "WorkCenter", "Packaging Unit", "/digital-twin", true],
    ["PURCHASE_OVERDUE", "Critical", "Screws purchase order overdue", "PO-3006 is overdue and still confirmed.", "PurchaseOrder", "seed-po-late-screws", "/purchase-orders/seed-po-late-screws", false],
    ["WORK_ORDER_BLOCKED", "Warning", "Work order waiting on components", "MO-2006 may be blocked by component availability.", "ManufacturingOrder", "seed-mo-wardrobe-late", "/manufacturing-orders/seed-mo-wardrobe-late", false],
    ["DELIVERY_READY", "Info", "Wooden Chair delivery ready", "Confirmed chair order can be delivered from stock.", "SalesOrder", "seed-so-chair-confirmed", "/sales-orders/seed-so-chair-confirmed", true],
    ["ERPILOT_RECOMMENDATION", "Info", "Review low-stock materials", "ERPilot recommends reviewing plywood and screws procurement.", "ERPilot", "recommendation", "/erpilot", false],
  ];
  await prisma.alert.createMany({ data: alerts.map(([type, severity, title, message, entityType, entityId, actionLink, read], i) => ({ id: `seed-alert-${i + 1}`, type, severity, title, message, entityType, entityId, actionLink, read, createdAt: daysAgo(i) })) });
  await prisma.eRPilotAnalysis.create({
    data: {
      id: "seed-erpilot-health",
      type: "business-health",
      entityType: "System",
      entityId: "seed",
      input: { scope: "seed" },
      output: { status: "Warning", score: 72, recommendation: "Confirm procurement for Dining Table shortages and monitor Packaging Unit capacity." },
      source: "rule-based",
      createdBy: "System",
    },
  });
}

async function main() {
  await clearSeed();
  await seedMasterData();
  await seedLifecycleData();
  await seedLogsAlertsAi();
  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    vendors: await prisma.vendor.count(),
    products: await prisma.product.count(),
    boms: await prisma.bom.count(),
    salesOrders: await prisma.salesOrder.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    manufacturingOrders: await prisma.manufacturingOrder.count(),
    stockMoves: await prisma.stockMove.count(),
    auditLogs: await prisma.auditLog.count(),
    alerts: await prisma.alert.count(),
  };
  console.log("FlowForge seed complete", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
