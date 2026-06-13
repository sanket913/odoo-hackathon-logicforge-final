import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { auth } from "../../middleware/auth.js";
import { fail, ok } from "../../utils/response.js";
import { id } from "../../utils/ids.js";
import { toDbRole, userDto } from "../../utils/serialize.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role = "Sales User" } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { id: id("u"), name, email, passwordHash, role: toDbRole(role), status: "Pending" } });
    ok(res, userDto(user), 201);
  } catch (err) {
    next(err.code === "P2002" ? fail(409, "EMAIL_EXISTS", "Email is already registered") : err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw fail(401, "INVALID_LOGIN", "Invalid email or password");
    if (user.status === "Pending") throw fail(403, "APPROVAL_PENDING", "Your request is waiting for admin verification.");
    if (user.status === "Rejected") throw fail(403, "ACCESS_REJECTED", "Your access request was rejected by admin.");
    if (user.status !== "Active") throw fail(403, "ACCOUNT_INACTIVE", "Your account is inactive. Contact admin.");
    const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    const token = jwt.sign({ sub: updated.id, role: updated.role }, env.jwtSecret, { expiresIn: "8h" });
    ok(res, { token, user: userDto(updated) });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", auth, (req, res) => ok(res, req.user));
