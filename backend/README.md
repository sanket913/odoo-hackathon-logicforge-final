# FlowForge ERP Backend

Node/Express API for FlowForge ERP + ERPilot AI.

## Setup

```bash
cd backend
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Use MySQL database `flowforge_erp` or update `DATABASE_URL`.

## Seed Credentials

All seed users use password `Admin@123`.

- `admin@flowforge.com`
- `sales@flowforge.com`
- `purchase@flowforge.com`
- `mfg@flowforge.com`
- `inventory@flowforge.com`
- `owner@flowforge.com`

## API Test Flow

1. `POST /api/auth/login`
2. `GET /api/products`
3. `POST /api/sales-orders`
   Body: `{ "customerId": "c1", "lines": [{ "productId": "p1", "qty": 20, "unitPrice": 12000 }] }`
4. `POST /api/sales-orders/:id/confirm`
   Expected: shortage `15`, auto `MO-*`.
5. `GET /api/manufacturing-orders`
6. `POST /api/manufacturing-orders/:id/start`
7. `POST /api/manufacturing-orders/:id/complete-workorder/:workOrderId` for Assembly.
8. Repeat for Painting.
9. Repeat for Packing.
10. `POST /api/manufacturing-orders/:id/complete`
    Expected stock impact: Wooden Legs `-60`, Wooden Top `-15`, Screws `-180`, Dining Table `+15`.
11. `GET /api/stock-moves`
12. `POST /api/sales-orders/:id/deliver`
13. `GET /api/audit-logs`
14. `GET /api/erpilot/order-feasibility/:salesOrderId`
15. `POST /api/erpilot/what-if`
    Body: `{ "productId": "p1", "quantity": 500 }`

All success responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`.
