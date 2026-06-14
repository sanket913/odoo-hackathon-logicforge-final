export type ApiErrorPayload = { code?: string; message?: string };
export type ApiResponse<T> = { success: boolean; data: T; error?: ApiErrorPayload };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
const TOKEN_KEY = "flowforge_token";
const USER_KEY = "flowforge_user";

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const session = {
  getToken: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  getUser: <T = Record<string, unknown>>() => {
    if (typeof window === "undefined") return null;
    const value = localStorage.getItem(USER_KEY);
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return null; }
  },
  set: (token: string, user: unknown) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = session.getToken();
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("The server is offline. Check the API connection and try again.", 0, "NETWORK_ERROR");
  }
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload?.success) {
    if (response.status === 401) session.clear();
    throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, response.status, payload?.error?.code);
  }
  return payload.data;
}

const qs = (params?: Record<string, unknown>) => {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : "";
};

const resource = (path: string) => ({
  list: <T = unknown>(params?: Record<string, unknown>) => request<T>(`${path}${qs(params)}`),
  get: <T = unknown>(id: string) => request<T>(`${path}/${encodeURIComponent(id)}`),
  create: <T = unknown>(data: unknown) => request<T>(path, { method: "POST", body: data }),
  update: <T = unknown>(id: string, data: unknown) => request<T>(`${path}/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
  remove: <T = unknown>(id: string) => request<T>(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  action: <T = unknown>(id: string, action: string, data?: unknown) => request<T>(`${path}/${encodeURIComponent(id)}/${action}`, { method: "POST", body: data ?? {} }),
});

export const api = {
  baseUrl: API_BASE_URL,
  health: () => request<unknown>("/health", { auth: false }),
  auth: {
    login: (data: unknown) => request<{ token: string; user: unknown }>("/auth/login", { method: "POST", body: data, auth: false }),
    register: (data: unknown) => request<{ token?: string; user?: unknown; message?: string }>("/auth/register", { method: "POST", body: data, auth: false }),
    me: () => request<unknown>("/auth/me"),
    logout: () => request<unknown>("/auth/logout", { method: "POST" }),
  },
  profile: { get: () => request<unknown>("/profile"), update: (data: unknown) => request<unknown>("/profile", { method: "PUT", body: data }) },
  dashboard: { summary: (params?: Record<string, unknown>) => request<unknown>(`/dashboard/summary${qs(params)}`) },
  products: { ...resource("/products"), adjustStock: (id: string, data: unknown) => request(`/products/${id}/adjust-stock`, { method: "POST", body: data }) },
  customers: resource("/customers"), vendors: resource("/vendors"), manufacturingPlants: resource("/manufacturing-plants"), bom: resource("/boms"),
  salesOrders: resource("/sales-orders"), purchaseOrders: resource("/purchase-orders"), manufacturingOrders: resource("/manufacturing-orders"),
  stock: { stockMoves: (params?: Record<string, unknown>) => request<unknown>(`/stock-moves${qs(params)}`), productStockMoves: (id: string, params?: Record<string, unknown>) => request<unknown>(`/stock-moves/product/${id}${qs(params)}`) },
  inventoryMovements: {
    list: (params?: Record<string, unknown>) => request<unknown>(`/inventory-movements${qs(params)}`),
    summary: (params?: Record<string, unknown>) => request<unknown>(`/inventory-movements/summary${qs(params)}`),
    map: (params?: Record<string, unknown>) => request<unknown>(`/inventory-movements/map${qs(params)}`),
    traceability: (params?: Record<string, unknown>) => request<unknown>(`/inventory-movements/traceability${qs(params)}`),
    exceptions: (params?: Record<string, unknown>) => request<unknown>(`/inventory-movements/exceptions${qs(params)}`),
    adjustment: (data: unknown) => request<unknown>("/inventory-movements/adjustment", { method: "POST", body: data }),
    internalTransfer: (data: unknown) => request<unknown>("/inventory-movements/internal-transfer", { method: "POST", body: data }),
  },
  audit: { logs: (params?: Record<string, unknown>) => request<unknown>(`/audit-logs${qs(params)}`), summary: (params?: Record<string, unknown>) => request<unknown>(`/audit-logs/summary${qs(params)}`), recordLogs: (type: string, id: string) => request<unknown>(`/audit-logs/record/${encodeURIComponent(type)}/${encodeURIComponent(id)}`) },
  users: { ...resource("/users"), changeRole: (id: string, role: string) => request(`/users/${id}/role`, { method: "PATCH", body: { role } }), changeStatus: (id: string, status: string) => request(`/users/${id}/status`, { method: "PATCH", body: { status } }), resetPassword: (id: string) => request(`/users/${id}/reset-password`, { method: "POST", body: {} }) },
  alerts: { list: (params?: Record<string, unknown>) => request<unknown>(`/alerts${qs(params)}`), markRead: (id: string) => request(`/alerts/${id}/read`, { method: "PATCH", body: {} }) },
  erpilot: {
    chat: (data: unknown) => request<unknown>("/erpilot/chat", { method: "POST", body: data }),
    businessHealth: () => request<unknown>("/erpilot/business-health"),
    orderFeasibility: (salesOrderIdOrData: unknown) => typeof salesOrderIdOrData === "string" ? request<unknown>(`/erpilot/order-feasibility/${encodeURIComponent(salesOrderIdOrData)}`) : request<unknown>("/erpilot/order-feasibility", { method: "POST", body: salesOrderIdOrData }),
    whatIf: (data: unknown) => request<unknown>("/erpilot/what-if", { method: "POST", body: data }),
    rootCause: (salesOrderIdOrData: unknown) => typeof salesOrderIdOrData === "string" ? request<unknown>(`/erpilot/root-cause/${encodeURIComponent(salesOrderIdOrData)}`) : request<unknown>("/erpilot/root-cause", { method: "POST", body: salesOrderIdOrData }),
    vendorRanking: (data?: unknown) => request<unknown>("/erpilot/vendor-ranking", { method: "POST", body: data ?? {} }),
    bottlenecks: () => request<unknown>("/erpilot/bottlenecks"),
    digitalTwin: () => request<unknown>("/erpilot/digital-twin"),
    procurementPrediction: () => request<unknown>("/erpilot/procurement-prediction"),
    reorderRecommendations: () => request<unknown>("/erpilot/reorder-recommendations"),
    auditSummary: () => request<unknown>("/erpilot/audit-summary"),
    stockExplanation: (stockMoveId: string) => request<unknown>(`/erpilot/stock-explanation/${encodeURIComponent(stockMoveId)}`),
    manufacturingReadiness: (manufacturingOrderId: string) => request<unknown>(`/erpilot/manufacturing-readiness/${encodeURIComponent(manufacturingOrderId)}`),
  },
  settings: { get: () => request<unknown>("/settings"), update: (data: unknown) => request<unknown>("/settings", { method: "PUT", body: data }) },
};

export type ApiResource = ReturnType<typeof resource>;
