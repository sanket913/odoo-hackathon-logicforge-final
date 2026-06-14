import { fail } from "../utils/response.js";

const permissions = {
  Admin: ["*"],
  "Sales User": ["dashboard", "sales-orders", "customers", "products", "inventory-ledger", "stock-moves", "inventory-movements", "alerts"],
  "Purchase User": ["dashboard", "purchase-orders", "vendors", "products", "inventory-ledger", "stock-moves", "inventory-movements", "alerts"],
  "Manufacturing User": ["dashboard", "manufacturing-orders", "bom", "boms", "products", "inventory-ledger", "stock-moves", "inventory-movements", "alerts"],
  "Inventory Manager": ["dashboard", "products", "inventory-ledger", "stock-moves", "inventory-movements", "audit-logs", "alerts"],
  "Business Owner": ["dashboard", "products", "audit-logs", "ai-copilot", "erpilot", "inventory-ledger", "stock-moves", "inventory-movements", "alerts"],
};

export const roleGuard = (resource) => (req, _res, next) => {
  const allowed = permissions[req.user?.role] || [];
  if (allowed.includes("*") || allowed.includes(resource)) return next();
  next(fail(403, "FORBIDDEN", "You do not have access to this resource"));
};
