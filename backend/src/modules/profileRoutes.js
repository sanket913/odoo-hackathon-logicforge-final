import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { ok, fail } from "../utils/response.js";
import { userDto, toDbRole } from "../utils/serialize.js";
import { audit } from "./erpService.js";

export const profileRouter = Router();

const loadProfile = async (id) => {
  const rows = await prisma.$queryRaw`
    SELECT id, name, email, role, status, lastLogin, mobileNumber, address, employeeCode, createdAt, updatedAt
    FROM \`User\`
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0];
};

profileRouter.get("/", async (req, res, next) => {
  const user = await loadProfile(req.user.id);
  if (!user) return next(fail(404, "USER_NOT_FOUND", "User not found"));
  ok(res, { ...userDto(user), position: userDto(user).role, photoUrl: "" });
});

profileRouter.put("/", async (req, res, next) => {
  const before = await loadProfile(req.user.id);
  if (!before) return next(fail(404, "USER_NOT_FOUND", "User not found"));
  const nextRole = req.user.role === "Admin" && req.body.role ? toDbRole(req.body.role) : before.role;
  await prisma.$executeRaw`
    UPDATE \`User\`
    SET name = ${req.body.name ?? before.name},
        mobileNumber = ${req.body.mobileNumber ?? before.mobileNumber},
        address = ${req.body.address ?? before.address},
        employeeCode = ${req.body.employeeCode ?? before.employeeCode},
        role = ${nextRole},
        updatedAt = NOW()
    WHERE id = ${req.user.id}
  `;
  const after = await loadProfile(req.user.id);
  await audit(req.user, "PROFILE_UPDATED", "User", after.email, `Updated profile for ${after.email}`, prisma, before, after);
  ok(res, { ...userDto(after), position: userDto(after).role, photoUrl: "" });
});

profileRouter.post("/photo", async (_req, res) => {
  ok(res, { photoUrl: "" });
});
