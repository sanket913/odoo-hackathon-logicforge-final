import { fail } from "../utils/response.js";

const permissions = {
  Admin: ["*"],
  "Sales User": ["dashboard", "sales-orders", "customers", "products", "alerts"],
  "Purchase User": ["dashboard", "purchase-orders", "vendors", "products", "alerts"],
  "Manufacturing User": ["dashboard", "manufacturing-orders", "bom", "boms", "alerts"],
  "Inventory Manager": ["dashboard", "products", "inventory-ledger", "stock-moves", "alerts"],
  "Business Owner": ["dashboard", "products", "audit-logs", "ai-copilot", "erpilot", "alerts"],
};

export const roleGuard = (resource) => (req, _res, next) => {
  const allowed = permissions[req.user?.role] || [];
  if (allowed.includes("*") || allowed.includes(resource)) return next();
  next(fail(403, "FORBIDDEN", "You do not have access to this resource"));
};
