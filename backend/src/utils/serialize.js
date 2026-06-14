const roleToDbMap = {
  Admin: "Admin",
  "Sales User": "Sales_User",
  "Purchase User": "Purchase_User",
  "Manufacturing User": "Manufacturing_User",
  "Inventory Manager": "Inventory_Manager",
  "Business Owner": "Business_Owner",
};
const roleFromDbMap = Object.fromEntries(Object.entries(roleToDbMap).map(([k, v]) => [v, k]));

export const toDbRole = (role) => roleToDbMap[role] || role;
export const fromDbRole = (role) => roleFromDbMap[role] || role;
const fromDbStatus = (status) => String(status).replaceAll("_", " ");

export function userDto(u) {
  return u && { id: u.id, name: u.name, email: u.email, role: fromDbRole(u.role), status: u.status, lastLogin: u.lastLogin?.toISOString?.(), createdAt: u.createdAt?.toISOString?.(), updatedAt: u.updatedAt?.toISOString?.(), mobileNumber: u.mobileNumber || "", address: u.address || "", employeeCode: u.employeeCode || `FF-${String(u.id || "").slice(-4).toUpperCase()}` };
}

export function productDto(p) {
  const availableQty = p.onHand - p.reserved;
  return p && {
    id: p.id, name: p.name, sku: p.sku, type: p.type, salesPrice: p.salesPrice, costPrice: p.costPrice,
    onHand: p.onHand, reserved: p.reserved, strategy: p.strategy, procureOnDemand: p.procureOnDemand,
    onHandQty: p.onHand, reservedQty: p.reserved, availableQty, freeToUse: availableQty, active: p.active,
    status: p.active ? "Active" : "Archived",
    procurementType: p.procurementType, reorderLevel: p.reorderLevel, vendorId: p.vendorId || undefined, bomId: p.bomId || undefined,
  };
}

export const customerDto = (c) => c && ({ ...c, status: c.active ? "Active" : "Archived", totalOrders: c._count?.salesOrders ?? 0 });
export const vendorDto = (v) => v && ({
  ...v,
  contactPerson: v.contact,
  supplies: Array.isArray(v.supplies) ? v.supplies.join(", ") : "",
  reliability: v.reliabilityScore,
  status: v.active ? "Active" : "Archived",
});

export const manufacturingPlantDto = (p) => p && ({
  id: p.id,
  name: p.name,
  code: p.code,
  address: p.address,
  city: p.city,
  lat: p.lat,
  lng: p.lng,
  capacity: p.capacity,
  status: p.status || "Active",
  notes: p.notes || "",
  createdAt: p.createdAt?.toISOString?.(),
  updatedAt: p.updatedAt?.toISOString?.(),
});

export function bomDto(b) {
  return b && {
    id: b.id, name: b.name, reference: b.name, productId: b.productId, finishedProductName: b.product?.name,
    quantity: 1, componentsCount: (b.components || []).length, operationsCount: (b.operations || []).length,
    status: b.active ? "Active" : "Archived",
    components: (b.components || []).map((c) => ({ productId: c.productId, productName: c.product?.name, qty: c.qty })),
    operations: (b.operations || []).sort((a, b) => a.sequence - b.sequence).map((o) => ({ name: o.name, minutes: o.minutes, workCenter: o.workCenter })),
  };
}

export function salesOrderDto(o) {
  const lines = o.lines || [];
  return o && {
    id: o.id, number: o.number, reference: o.number, customerId: o.customerId, date: o.date.toISOString().slice(0, 10),
    customerName: o.customer?.name, salespersonName: o.createdBy,
    lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
    status: fromDbStatus(o.status), deliveredQty: Object.fromEntries(lines.map((l) => [l.productId, l.deliveredQty])),
    total: lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    procurementTriggered: o.procurementTriggered, createdBy: o.createdBy,
    linkedMOIds: (o.manufacturingOrders || []).map((m) => m.id),
    linkedPOIds: (o.purchaseOrders || []).map((p) => p.id),
  };
}

export function purchaseOrderDto(o) {
  const lines = o.lines || [];
  return o && {
    id: o.id, number: o.number, reference: o.number, vendorId: o.vendorId, date: o.date.toISOString().slice(0, 10), expectedDate: o.expectedDate.toISOString().slice(0, 10),
    vendorName: o.vendor?.name, purchasePersonName: o.responsiblePerson || "Purchase Team", responsiblePerson: o.responsiblePerson || "",
    lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
    status: fromDbStatus(o.status), receivedQty: Object.fromEntries(lines.map((l) => [l.productId, l.receivedQty])),
    total: lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    source: fromDbStatus(o.source), sourceSOId: o.sourceSOId || undefined,
  };
}

export function manufacturingOrderDto(o) {
  const bomComponents = o.bom?.components || [];
  const components = bomComponents.map((c) => {
    const availability = Math.max(0, (c.product?.onHand ?? 0) - (c.product?.reserved ?? 0));
    const toConsume = c.qty * o.qty;
    return {
      productId: c.productId,
      productName: c.product?.name,
      availability,
      toConsume,
      consumedQty: o.status === "Done" ? toConsume : 0,
      units: "Units",
      componentStatus: availability >= toConsume ? "Available" : "Not Available",
    };
  });
  return o && {
    id: o.id, number: o.number, productId: o.productId, qty: o.qty, bomId: o.bomId, assignee: o.assignee,
    reference: o.number, finishedProductName: o.product?.name, quantity: o.qty, unit: "Units", assigneeName: o.assignee,
    scheduledDate: (o.scheduledDate || o.createdAt).toISOString().slice(0, 10),
    componentStatus: components.every((c) => c.componentStatus === "Available") ? "Available" : "Not Available",
    components,
    sourceSOId: o.sourceSOId || undefined, status: fromDbStatus(o.status),
    workOrders: (o.workOrders || []).sort((a, b) => a.sequence - b.sequence).map((w) => ({ id: w.id, name: w.name, workCenter: w.workCenter, minutes: w.minutes, expectedDuration: w.minutes, realDuration: w.status === "Done" ? w.minutes : 0, status: fromDbStatus(w.status) })),
  };
}

export const stockMoveDto = (m) => m && ({
  id: m.id, date: m.date.toISOString(), createdAt: m.date.toISOString(), productId: m.productId,
  productName: m.product?.name, type: m.type, movementType: m.type, change: m.change, quantityChange: m.change,
  sku: m.product?.sku, onHandBefore: m.before, onHandAfter: m.after, reservedBefore: m.reservedBefore ?? undefined, reservedAfter: m.reservedAfter ?? undefined,
  availableBefore: m.availableBefore ?? m.before, availableAfter: m.availableAfter ?? m.after,
  before: m.before, beforeQty: m.before, after: m.after, afterQty: m.after, reference: m.reference,
  sourceLocation: m.sourceLocation || "Main WH", destinationLocation: m.destinationLocation || locationForMove(m.type),
  status: "Posted", movementNumber: m.id,
  referenceType: m.referenceType, referenceId: m.referenceId || m.reference, userName: m.user, note: m.note,
});

const locationForMove = (type = "") => {
  if (String(type).includes("PURCHASE")) return "Raw Material Store";
  if (String(type).includes("MO_COMPONENT")) return "Production Floor";
  if (String(type).includes("MO_FINISHED")) return "Finished Goods Store";
  if (String(type).includes("SALE")) return "Customer";
  if (String(type).includes("SCRAP")) return "Scrap Location";
  return "Main WH";
};

export const alertDto = (a) => a && ({
  id: a.id,
  type: a.type,
  alertType: String(a.type).replaceAll("_", " "),
  severity: a.severity,
  title: a.title,
  message: a.message,
  entityType: a.entityType,
  entityId: a.entityId,
  relatedRecord: [a.entityType, a.entityId].filter(Boolean).join(" / "),
  actionLink: a.actionLink,
  read: a.read,
  status: a.read ? "Read" : "Unread",
  createdAt: a.createdAt.toISOString(),
});
export const auditDto = (a) => {
  const before = a.before || {};
  const after = a.after || {};
  const changed = Object.keys(after)[0] || Object.keys(before)[0] || "";
  return a && {
    id: a.id, timestamp: a.timestamp.toISOString(), createdAt: a.timestamp.toISOString(), user: a.user, userName: a.user,
    action: a.action, entityType: a.entityType, module: a.entityType, recordType: a.entityType, entityId: a.entityId,
    recordId: a.entityId, message: a.message, fieldChanged: changed || "Action", oldValue: changed ? before[changed] : "-", newValue: changed ? after[changed] : a.message,
    before: a.before || undefined, after: a.after || undefined,
  };
};
