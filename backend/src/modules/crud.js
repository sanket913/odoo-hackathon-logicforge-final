import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { id } from "../utils/ids.js";
import { ok, fail } from "../utils/response.js";
import { audit, move } from "./erpService.js";
import { productDto, customerDto, vendorDto, manufacturingPlantDto, bomDto, userDto, toDbRole } from "../utils/serialize.js";
import bcrypt from "bcrypt";

const auditFieldChanges = async (req, entityType, entityId, before, after) => {
  const keys = Object.keys(req.body || {});
  for (const key of keys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      await audit(
        req.user,
        `${entityType.toUpperCase()}_FIELD_UPDATED`,
        entityType,
        entityId,
        `${entityType} ${entityId} field ${key} changed`,
        prisma,
        { [key]: before?.[key] },
        { [key]: after?.[key] },
      );
    }
  }
};

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

const simpleWriteData = (model, body) => {
  if (model === "customer") {
    const data = pick(body, ["name", "company", "email", "phone", "address"]);
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.status !== undefined) data.active = String(body.status).toLowerCase() === "active";
    return data;
  }
  if (model === "vendor") {
    const data = {
      ...pick(body, ["name", "contact", "email", "phone", "address", "leadTimeDays", "reliabilityScore", "costScore", "lat", "lng"]),
    };
    if (body.contactPerson !== undefined) data.contact = body.contactPerson;
    if (body.reliability !== undefined) data.reliabilityScore = Number(body.reliability);
    if (body.supplies !== undefined) data.supplies = Array.isArray(body.supplies) ? body.supplies : String(body.supplies).split(",").map((x) => x.trim()).filter(Boolean);
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.status !== undefined) data.active = String(body.status).toLowerCase() === "active";
    if (data.leadTimeDays !== undefined) data.leadTimeDays = Number(data.leadTimeDays);
    return data;
  }
  if (model === "manufacturingPlant") {
    const data = pick(body, ["name", "code", "address", "city", "lat", "lng", "capacity", "status", "notes"]);
    if (data.lat !== undefined) data.lat = Number(data.lat);
    if (data.lng !== undefined) data.lng = Number(data.lng);
    if (data.capacity !== undefined) data.capacity = Number(data.capacity);
    return data;
  }
  return body;
};

export function productsRouter() {
  const r = Router();
  r.get("/", async (_req, res) => ok(res, (await prisma.product.findMany({ orderBy: { name: "asc" } })).map(productDto)));
  r.post("/", async (req, res) => {
    const product = await prisma.product.create({ data: { ...req.body, id: id("p") } });
    await audit(req.user, "PRODUCT_CREATED", "Product", product.sku, `Created product ${product.name}`, prisma, undefined, product);
    ok(res, productDto(product), 201);
  });
  r.get("/:id", async (req, res, next) => {
    const p = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!p) return next(fail(404, "PRODUCT_NOT_FOUND", "Product not found"));
    ok(res, productDto(p));
  });
  r.put("/:id", async (req, res, next) => {
    try {
      const before = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!before) throw fail(404, "PRODUCT_NOT_FOUND", "Product not found");
      const after = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
      if (before.salesPrice !== after.salesPrice || before.costPrice !== after.costPrice) {
        await audit(req.user, "PRODUCT_PRICE_UPDATED", "Product", after.sku, `Price updated for ${after.name}: sales INR ${before.salesPrice}->INR ${after.salesPrice}, cost INR ${before.costPrice}->INR ${after.costPrice}`, prisma, { salesPrice: before.salesPrice, costPrice: before.costPrice }, { salesPrice: after.salesPrice, costPrice: after.costPrice });
      }
      if (before.onHand !== after.onHand) {
        await prisma.stockMove.create({ data: { id: id("sm"), date: new Date(), productId: after.id, type: "ADJUSTMENT", change: after.onHand - before.onHand, before: before.onHand, after: after.onHand, reference: "Manual adjustment", note: "Stock adjusted manually" } });
        await audit(req.user, "PRODUCT_QTY_ADJUSTED", "Product", after.sku, `Stock adjusted for ${after.name}: ${before.onHand}->${after.onHand}`, prisma, { onHand: before.onHand }, { onHand: after.onHand });
      }
      await auditFieldChanges(req, "Product", after.sku, before, after);
      ok(res, productDto(after));
    } catch (err) { next(err); }
  });
  r.post("/:id/adjust-stock", async (req, res, next) => {
    try {
      const qty = Number(req.body?.qty ?? req.body?.change ?? 0);
      if (!Number.isFinite(qty) || qty === 0) throw fail(400, "INVALID_QTY", "Stock adjustment quantity is required");
      const before = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!before) throw fail(404, "PRODUCT_NOT_FOUND", "Product not found");
      await move(before.id, "ADJUSTMENT", qty, "Manual adjustment", req.body?.note || "Stock adjusted manually");
      const after = await prisma.product.findUnique({ where: { id: req.params.id } });
      await audit(req.user, "PRODUCT_QTY_ADJUSTED", "Product", after.sku, `Stock adjusted for ${after.name}: ${before.onHand}->${after.onHand}`);
      ok(res, productDto(after));
    } catch (err) { next(err); }
  });
  r.delete("/:id", async (req, res) => {
    const deleted = await prisma.product.delete({ where: { id: req.params.id } });
    await audit(req.user, "PRODUCT_DELETED", "Product", deleted.sku, `Deleted product ${deleted.name}`, prisma, deleted, undefined);
    ok(res, productDto(deleted));
  });
  return r;
}

export function simpleRouter(model, dto, prefix) {
  const r = Router();
  r.get("/", async (_req, res) => ok(res, (await prisma[model].findMany({ include: model === "customer" ? { _count: { select: { salesOrders: true } } } : undefined })).map(dto)));
  r.get("/:id", async (req, res, next) => {
    const record = await prisma[model].findUnique({ where: { id: req.params.id } });
    if (!record) return next(fail(404, `${model.toUpperCase()}_NOT_FOUND`, `${model} not found`));
    ok(res, dto(record));
  });
  r.post("/", async (req, res) => ok(res, dto(await prisma[model].create({ data: { ...simpleWriteData(model, req.body), id: id(prefix) } })), 201));
  r.put("/:id", async (req, res) => ok(res, dto(await prisma[model].update({ where: { id: req.params.id }, data: simpleWriteData(model, req.body) }))));
  r.delete("/", async (req, res, next) => {
    if (!Object.prototype.hasOwnProperty.call(req.query, "id")) {
      return next(fail(400, "ID_REQUIRED", "Record id is required"));
    }
    ok(res, dto(await prisma[model].delete({ where: { id: String(req.query.id ?? "") } })));
  });
  r.delete("/:id", async (req, res) => ok(res, dto(await prisma[model].delete({ where: { id: req.params.id } }))));
  return r;
}

export function bomsRouter() {
  const r = Router();
  const include = { product: true, components: true, operations: true };
  r.get("/", async (_req, res) => ok(res, (await prisma.bom.findMany({ include })).map(bomDto)));
  r.get("/:id", async (req, res) => ok(res, bomDto(await prisma.bom.findUnique({ where: { id: req.params.id }, include }))));
  r.post("/", async (req, res) => {
    const b = await prisma.bom.create({ data: {
      id: id("b"), name: req.body.name, productId: req.body.productId,
      components: { create: (req.body.components || []).map((c) => ({ id: id("bc"), productId: c.productId, qty: c.qty })) },
      operations: { create: (req.body.operations || []).map((o, i) => ({ id: id("bo"), name: o.name, minutes: o.minutes, workCenter: o.workCenter, sequence: i + 1 })) },
    }, include });
    await audit(req.user, "BOM_CREATED", "BoM", b.id, `Created BoM ${b.name}`, prisma, undefined, b);
    ok(res, bomDto(b), 201);
  });
  r.put("/:id", async (req, res) => {
    const before = await prisma.bom.findUnique({ where: { id: req.params.id }, include });
    await prisma.bomComponent.deleteMany({ where: { bomId: req.params.id } });
    await prisma.bomOperation.deleteMany({ where: { bomId: req.params.id } });
    const b = await prisma.bom.update({ where: { id: req.params.id }, data: {
      name: req.body.name, productId: req.body.productId,
      components: { create: (req.body.components || []).map((c) => ({ id: id("bc"), productId: c.productId, qty: c.qty })) },
      operations: { create: (req.body.operations || []).map((o, i) => ({ id: id("bo"), name: o.name, minutes: o.minutes, workCenter: o.workCenter, sequence: i + 1 })) },
    }, include });
    await audit(req.user, "BOM_UPDATED", "BoM", b.id, `Updated BoM ${b.name}`, prisma, before, b);
    ok(res, bomDto(b));
  });
  r.delete("/:id", async (req, res) => {
    const deleted = await prisma.bom.delete({ where: { id: req.params.id }, include });
    await audit(req.user, "BOM_DELETED", "BoM", deleted.id, `Deleted BoM ${deleted.name}`, prisma, deleted, undefined);
    ok(res, bomDto(deleted));
  });
  return r;
}

export function manufacturingPlantsRouter() {
  const r = Router();
  const ensureDefaultPlant = async () => {
    const count = await prisma.manufacturingPlant.count();
    if (count) return;
    await prisma.manufacturingPlant.create({ data: {
      id: id("plant"),
      name: "Shiv Furniture Works",
      code: "MFG",
      address: "Pune Industrial Area, Pune, Maharashtra, India",
      city: "Pune",
      lat: 18.5204,
      lng: 73.8567,
      capacity: 120,
      status: "Active",
      notes: "Default manufacturing plant used by the live supply chain map.",
    } });
  };
  r.get("/", async (_req, res) => {
    await ensureDefaultPlant();
    ok(res, (await prisma.manufacturingPlant.findMany({ orderBy: { name: "asc" } })).map(manufacturingPlantDto));
  });
  r.get("/:id", async (req, res, next) => {
    const plant = await prisma.manufacturingPlant.findUnique({ where: { id: req.params.id } });
    if (!plant) return next(fail(404, "PLANT_NOT_FOUND", "Manufacturing plant not found"));
    ok(res, manufacturingPlantDto(plant));
  });
  r.post("/", async (req, res) => {
    const plant = await prisma.manufacturingPlant.create({ data: { ...simpleWriteData("manufacturingPlant", req.body), id: id("plant") } });
    await audit(req.user, "PLANT_CREATED", "ManufacturingPlant", plant.code, `Created manufacturing plant ${plant.name}`, prisma, undefined, plant);
    ok(res, manufacturingPlantDto(plant), 201);
  });
  r.put("/:id", async (req, res) => {
    const before = await prisma.manufacturingPlant.findUnique({ where: { id: req.params.id } });
    const plant = await prisma.manufacturingPlant.update({ where: { id: req.params.id }, data: simpleWriteData("manufacturingPlant", req.body) });
    await audit(req.user, "PLANT_UPDATED", "ManufacturingPlant", plant.code, `Updated manufacturing plant ${plant.name}`, prisma, before, plant);
    ok(res, manufacturingPlantDto(plant));
  });
  r.delete("/:id", async (req, res) => {
    const deleted = await prisma.manufacturingPlant.delete({ where: { id: req.params.id } });
    await audit(req.user, "PLANT_DELETED", "ManufacturingPlant", deleted.code, `Deleted manufacturing plant ${deleted.name}`, prisma, deleted, undefined);
    ok(res, manufacturingPlantDto(deleted));
  });
  return r;
}

export function usersRouter() {
  const r = Router();
  r.use((req, _res, next) => {
    if (req.user?.role !== "Admin") return next(fail(403, "ADMIN_ONLY", "Only admins can manage users and roles"));
    next();
  });
  r.get("/", async (_req, res) => ok(res, (await prisma.user.findMany()).map(userDto)));
  r.get("/:id", async (req, res, next) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return next(fail(404, "USER_NOT_FOUND", "User not found"));
    ok(res, userDto(user));
  });
  r.post("/", async (req, res) => ok(res, userDto(await prisma.user.create({ data: { id: id("u"), name: req.body.name, email: req.body.email, passwordHash: await bcrypt.hash(req.body.password || "Admin@123", 10), role: toDbRole(req.body.role), status: req.body.status || "Active" } })), 201));
  r.put("/:id", async (req, res) => ok(res, userDto(await prisma.user.update({ where: { id: req.params.id }, data: { ...req.body, role: req.body.role ? toDbRole(req.body.role) : undefined } }))));
  r.patch("/:id/role", async (req, res) => {
    if (req.params.id === req.user?.id) throw fail(400, "SELF_ROLE_CHANGE_BLOCKED", "Admins cannot change their own role");
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role: toDbRole(req.body.role) } });
    await audit(req.user, "USER_ROLE_UPDATED", "User", user.email, `Updated role for ${user.email} to ${req.body.role}`);
    ok(res, userDto(user));
  });
  r.patch("/:id/status", async (req, res) => {
    if (req.params.id === req.user?.id && req.body.status !== "Active") throw fail(400, "SELF_BLOCK_BLOCKED", "Admins cannot block their own account");
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    await audit(req.user, "USER_STATUS_UPDATED", "User", user.email, `Updated status for ${user.email} to ${req.body.status}`);
    ok(res, userDto(user));
  });
  r.patch("/:id/password", async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(req.body.password || "Admin@123", 10) } });
    await audit(req.user, "USER_PASSWORD_RESET", "User", user.email, `Reset password for ${user.email}`);
    ok(res, userDto(user));
  });
  r.delete("/:id", async (req, res) => {
    if (req.params.id === req.user?.id) throw fail(400, "SELF_DELETE_BLOCKED", "Admins cannot delete their own account");
    const deleted = await prisma.user.delete({ where: { id: req.params.id } });
    await audit(req.user, "USER_DELETED", "User", deleted.email, `Deleted user ${deleted.email}`, prisma, deleted, undefined);
    ok(res, userDto(deleted));
  });
  return r;
}

export { customerDto, vendorDto, manufacturingPlantDto };
