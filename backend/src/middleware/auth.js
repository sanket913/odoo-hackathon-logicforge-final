import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { fail } from "../utils/response.js";
import { fromDbRole } from "../utils/serialize.js";

export async function auth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw fail(401, "UNAUTHORIZED", "Missing bearer token");
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "Active") throw fail(401, "UNAUTHORIZED", "Invalid or inactive user");
    req.user = { id: user.id, name: user.name, email: user.email, role: fromDbRole(user.role), status: user.status };
    next();
  } catch (err) {
    next(err.status ? err : fail(401, "UNAUTHORIZED", "Invalid bearer token"));
  }
}
