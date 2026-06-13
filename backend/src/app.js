import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { ok } from "./utils/response.js";
import { auth } from "./middleware/auth.js";
import { roleGuard } from "./middleware/roleGuard.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/routes.js";
import { productsRouter, simpleRouter, bomsRouter, manufacturingPlantsRouter, usersRouter, customerDto, vendorDto } from "./modules/crud.js";
import { salesRouter, purchaseRouter, manufacturingRouter, stockRouter, auditRouter } from "./modules/ordersRoutes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { erpilotRouter, aiRouter } from "./modules/erpilot/routes.js";
import { alertsRouter } from "./modules/alerts/routes.js";
import { profileRouter } from "./modules/profileRoutes.js";

export const app = express();

app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => ok(res, { status: "ok", service: "FlowForge ERP API" }));
app.use("/api/auth", authRouter);

app.use("/api/dashboard", auth, roleGuard("dashboard"), dashboardRouter);
app.use("/api/profile", auth, profileRouter);
app.use("/api/products", auth, roleGuard("products"), productsRouter());
app.use("/api/customers", auth, roleGuard("customers"), simpleRouter("customer", customerDto, "c"));
app.use("/api/vendors", auth, roleGuard("vendors"), simpleRouter("vendor", vendorDto, "v"));
app.use("/api/manufacturing-plants", auth, roleGuard("manufacturing-plants"), manufacturingPlantsRouter());
app.use("/api/boms", auth, roleGuard("boms"), bomsRouter());
app.use("/api/sales-orders", auth, roleGuard("sales-orders"), salesRouter);
app.use("/api/purchase-orders", auth, roleGuard("purchase-orders"), purchaseRouter);
app.use("/api/manufacturing-orders", auth, roleGuard("manufacturing-orders"), manufacturingRouter);
app.use("/api/stock-moves", auth, roleGuard("stock-moves"), stockRouter);
app.use("/api/audit-logs", auth, roleGuard("audit-logs"), auditRouter);
app.use("/api/users", auth, roleGuard("users"), usersRouter());
app.use("/api/erpilot", auth, roleGuard("erpilot"), erpilotRouter);
app.use("/api/ai", auth, roleGuard("erpilot"), aiRouter);
app.use("/api/alerts", auth, roleGuard("alerts"), alertsRouter);

app.use(notFound);
app.use(errorHandler);
