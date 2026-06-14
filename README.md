<div align="center">

# FlowForge ERP + ERPilot AI

### **From demand to delivery - every stock movement explained.**

![Full Stack](https://img.shields.io/badge/Full%20Stack-ERP-4648d4)
![Mini ERP](https://img.shields.io/badge/Mini%20ERP-Demand%20to%20Delivery-6b38d4)
![Manufacturing](https://img.shields.io/badge/Manufacturing-Furniture-283044)
![Inventory Movement](https://img.shields.io/badge/Inventory-Movement-16a34a)
![Procurement Automation](https://img.shields.io/badge/Procurement-Automation-d97706)
![MySQL](https://img.shields.io/badge/MySQL-Database-0f766e)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2f2ebe)
![React](https://img.shields.io/badge/React-Frontend-2563eb)
![Node.js](https://img.shields.io/badge/Node.js-Backend-15803d)
![ERPilot AI](https://img.shields.io/badge/ERPilot%20AI-Decision%20Engine-7c3aed)
![Groq Llama](https://img.shields.io/badge/Groq%20Llama-AI%20Layer-f97316)
![Odoo Hackathon 2026](https://img.shields.io/badge/Odoo%20Hackathon-2026-ba1a1a)

</div>


---
## Team

| Team | Members |
| --- | --- |
| LogicForge | Sanket Prajapati, Manav Joshi |

Built for the Odoo x Parul University Hackathon 2026.

---

FlowForge ERP is a full-stack Mini ERP platform for furniture manufacturing businesses. It connects Sales, Purchase, Manufacturing, Bills of Materials, Inventory, Procurement, Stock Ledger, Audit Logs, Role-Based Access, Dashboard visibility, Digital Twin, and ERPilot AI into one complete demand-to-delivery workflow.

> **FlowForge ERP is the transaction engine. ERPilot AI is the decision engine.**

## Product Snapshot

| Area | What FlowForge ERP Delivers |
| --- | --- |
| Products | Finished goods, raw materials, SKU, pricing, stock and procurement configuration |
| Customers | Customer master data connected to sales order demand |
| Vendors | Supplier profiles, lead time, reliability, cost and supplies |
| Sales | Demand capture, confirmation, reservation, delivery and cancellation |
| Purchase | Purchase order lifecycle, vendor receipt and stock increase |
| Manufacturing | BoM-based production with work orders and finished goods output |
| BoM | Component and operation definitions per finished product |
| Inventory | On-hand, reserved and available stock visibility |
| Procurement Automation | MTS/MTO decision path for shortage handling |
| Stock Ledger | Every stock movement recorded with before/after quantity |
| Audit Logs | Business traceability across key actions and field changes |
| Access Rights | Admin and role-based module permissions |
| Dashboard | Live status counters, risk indicators and next actions |
| ERPilot AI | Business explanations, recommendations and simulations |
| Digital Twin | Visual demand-to-delivery pipeline status |
| Alerts | Low stock, shortage, overdue and bottleneck signals |

## Problem Statement

Shiv Furniture Works needs more than isolated records. Furniture manufacturing involves customer demand, raw materials, BoMs, work centers, supplier timelines, production status, delivery commitments and stock accountability.

Many small and medium manufacturers still depend on disconnected spreadsheets, manual stock registers, paper BoMs, delayed procurement follow-up and manual manufacturing coordination. This creates overselling, understocking, late deliveries, unclear ownership, difficult traceability and weak owner-level visibility.

The real challenge is not only storing records. The real challenge is connecting every business action to inventory movement, traceability, and decision support.

## Solution Overview

FlowForge ERP converts manual operations into connected demand-to-delivery orchestration:

```text
Product + BoM -> Sales Order -> Stock Check -> MTS/MTO Decision -> Procurement
-> Purchase / Manufacturing -> Stock Ledger -> Delivery -> Audit Logs
-> ERPilot AI Explanation
```

This is not CRUD. This is demand-to-delivery orchestration.

## Why This Is Not Just CRUD

CRUD only creates and displays records. FlowForge ERP connects records through business rules.

| CRUD System | FlowForge ERP |
| --- | --- |
| Stores products | Tracks on-hand, reserved, available stock |
| Stores sales orders | Confirms orders, checks stock, reserves quantity |
| Stores purchase orders | Receives goods and increases stock |
| Stores manufacturing orders | Consumes components and produces finished goods |
| Stores logs | Tracks full stock and audit traceability |
| Shows dashboard | Shows live operational health and AI recommendations |

## Core ERP Concept: Inventory Movement

Inventory movement is the center of the system. Sales, purchase, manufacturing, cancellation and adjustment workflows all create stock impact and traceability.

| Module | Stock Impact | Ledger Movement |
| --- | --- | --- |
| Sales | Reserve stock and deliver product | SALE_RESERVE, SALE_DELIVERY |
| Purchase | Receive products | PURCHASE_RECEIPT |
| Manufacturing | Reserve components, consume components, produce finished goods | MO_COMPONENT_RESERVE, MO_COMPONENT_CONSUME, MO_FINISHED_PRODUCE |
| Cancellation | Release reservation | RESERVATION_RELEASE, SALE_UNRESERVE |
| Adjustment | Manual correction | ADJUSTMENT, STOCK_ADJUSTMENT_IN, STOCK_ADJUSTMENT_OUT |

```text
Available Quantity = On Hand Quantity - Reserved Quantity
```

This formula is used internally for stock check and procurement decision. The UI displays available quantity directly without exposing unnecessary calculation text.

## Complete Demand-to-Delivery Workflow

```mermaid
flowchart TD
    A["Login / Signup"] --> B["Role-Based Dashboard"]
    B --> C["Master Setup"]
    C --> C1["Products"]
    C --> C2["Customers"]
    C --> C3["Vendors"]
    C --> C4["Bills of Materials"]
    C --> C5["Users & Roles"]

    C1 --> D["Sales Order Created"]
    C2 --> D
    D --> E["Stock Check"]
    E --> F{"Enough Available Stock?"}

    F -->|Yes| G["Reserve Stock"]
    G --> H["Deliver Goods"]
    H --> I["Stock Ledger Updated"]
    I --> J["Audit Logs Updated"]

    F -->|No| K["Shortage Detected"]
    K --> L{"Procurement Type?"}

    L -->|Purchase| M["Auto Purchase Order"]
    M --> N["Receive Materials"]
    N --> O["Stock Updated"]
    O --> H

    L -->|Manufacturing| P["Auto Manufacturing Order"]
    P --> Q["Fetch BoM Components"]
    Q --> R["Reserve Components"]
    R --> S["Execute Work Orders"]
    S --> T["Consume Components"]
    T --> U["Produce Finished Goods"]
    U --> H

    J --> V["Dashboard Updated"]
    V --> W["ERPilot AI Insight"]
    W --> X["Digital Twin Status"]

    style F fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style L fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style W fill:#e0e7ff,stroke:#6366f1,stroke-width:2px
    style X fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

## MTS vs MTO Logic

MTS means Make To Stock. MTO means Make To Order.

* Wooden Chair: MTS, on-hand 100, order 10, deliver from stock.
* Dining Table: MTO, on-hand 5, order 20, shortage 15, create Manufacturing Order.

```mermaid
flowchart LR
    A["Sales Order Confirmed"] --> B["Check Product Strategy"]
    B --> C{"MTS or MTO?"}

    C -->|MTS| D["Use Existing Stock"]
    D --> E{"Enough Stock?"}
    E -->|Yes| F["Reserve and Deliver"]
    E -->|No| G["Create Procurement for Shortage"]

    C -->|MTO| H["Procure on Demand"]
    H --> I{"Procurement Configuration"}

    I -->|Vendor Available| J["Create Purchase Order"]
    I -->|BoM Available| K["Create Manufacturing Order"]
    I -->|Missing Config| L["Create Alert"]

    J --> M["Receive Goods"]
    K --> N["Manufacture Goods"]
    M --> O["Deliver"]
    N --> O

    style C fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style I fill:#fef3c7,stroke:#d97706,stroke-width:2px
```

## End-to-End Dining Table Example

| Field | Value |
| --- | --- |
| Customer | Raj Furniture Mart |
| Sales Order | 20 Dining Tables |
| Available stock | 5 |
| Shortage | 15 |
| Procurement type | Manufacturing |
| Auto-created record | Manufacturing Order for 15 Dining Tables |

BoM calculation:

* Wooden Legs: 15 x 4 = 60
* Wooden Top: 15 x 1 = 15
* Screws: 15 x 12 = 180
* Wood Polish: 15 x 1 = 15

Workflow:

1. Customer places Sales Order.
2. System checks stock.
3. Shortage detected.
4. Manufacturing Order is auto-created.
5. BoM components and work orders are populated.
6. Components are reserved.
7. Manufacturing work orders execute.
8. Components are consumed.
9. 15 Dining Tables are produced.
10. Sales Order is delivered.
11. Stock Ledger records all movements.
12. Audit Logs record all actions.
13. ERPilot AI explains the decision and next action.

```mermaid
sequenceDiagram
    participant Customer
    participant Sales as Sales Order
    participant Stock as Stock Engine
    participant Proc as Procurement Engine
    participant MO as Manufacturing Order
    participant BoM as Bill of Materials
    participant Ledger as Stock Ledger
    participant Audit as Audit Logs
    participant ERPilot as ERPilot AI

    Customer->>Sales: Order 20 Dining Tables
    Sales->>Stock: Check available quantity
    Stock-->>Sales: 5 available, shortage 15
    Sales->>Proc: Trigger procurement
    Proc->>MO: Create MO for 15 Dining Tables
    MO->>BoM: Fetch Dining Table BoM
    BoM-->>MO: Legs 60, Top 15, Screws 180, Polish 15
    MO->>Ledger: Reserve components
    MO->>Ledger: Consume components
    MO->>Ledger: Produce 15 Dining Tables
    Sales->>Ledger: Deliver 20 Dining Tables
    Sales->>Audit: Record lifecycle actions
    ERPilot-->>Sales: Explain feasibility and next action
```

## Core Modules

| Module | What It Does | Key Business Value |
| --- | --- | --- |
| Products | Maintains finished goods and components | Accurate stock and procurement setup |
| Customers | Stores customer data | Demand ownership and sales traceability |
| Vendors | Stores supplier data | Lead time and sourcing decisions |
| BoM | Defines components and operations | Manufacturing readiness |
| Sales Orders | Captures demand and delivery lifecycle | Stock reservation and fulfilment |
| Purchase Orders | Procures components and materials | Reliable replenishment |
| Manufacturing Orders | Produces finished goods from components | MTO/MTS production control |
| Work Orders | Tracks operation-level production tasks | Shop-floor progress visibility |
| Stock Ledger | Records every stock movement | Inventory proof |
| Audit Logs | Records business actions | Accountability |
| Users & Roles | Controls module access | Secure operations |
| Alerts | Highlights operational risks | Faster response |
| Dashboard | Summarizes live operations | Owner-level visibility |
| ERPilot AI | Explains and recommends actions | Decision support |
| Digital Twin | Visualizes live workflow state | Pipeline clarity |
| Supply Chain Map | Shows vendor and plant network | Location-aware supply visibility |

## Product and Procurement Configuration

Products include:

* SKU
* Product name
* Type: Finished / Component
* Sales Price
* Cost Price
* On Hand Qty
* Reserved Qty
* Available Qty
* Reorder Level
* Procure on Demand
* Procurement Type: Purchase / Manufacturing
* Vendor
* BoM
* Active Status

Business rules:

* Purchase procurement requires vendor configuration.
* Manufacturing procurement requires BoM configuration.
* Sales price fills sales order line pricing.
* Cost price fills purchase order line pricing.
* Product price and quantity changes create audit logs.
* Stock adjustments create stock ledger entries.

## Sales Order Lifecycle

```text
Draft -> Confirmed -> Partially Delivered -> Fully Delivered
Draft -> Cancelled
```

Key actions:

* Confirm: checks stock, reserves available quantity and triggers procurement if shortage exists.
* Deliver: decreases stock and updates delivered quantity.
* Cancel: cancels order and releases active reservation.
* Logs: records lifecycle actions.

## Purchase Order Lifecycle

```text
Draft -> Confirmed -> Partially Received -> Fully Received
Draft -> Cancelled
```

Key actions:

* Confirm: marks purchase as committed.
* Receive: increases stock through purchase receipt movement.
* Cancel: closes open purchase request.
* Logs: records purchase status changes and receipts.

## Manufacturing Order Lifecycle

```text
Draft -> Confirmed -> In Progress -> Done
Draft / Confirmed -> Cancelled
```

Key actions:

* Confirm: validates manufacturing intent.
* Start: reserves components and moves order into progress.
* Produce: consumes components and adds finished goods.
* Cancel: stops open manufacturing flow.
* Logs: records production actions and status changes.

## Bill of Materials Logic

Dining Table BoM:

| Component | Per Unit | For 15 Units |
| --- | ---: | ---: |
| Wooden Legs | 4 | 60 |
| Wooden Top | 1 | 15 |
| Screws | 12 | 180 |
| Wood Polish | 1 | 15 |

Operations:

| Operation | Work Center | Time |
| --- | --- | ---: |
| Assembly | Assembly Line | 60 mins |
| Painting | Paint Floor | 30 mins |
| Packing | Packaging Unit | 20 mins |

```text
Required Component Quantity = BoM Quantity Per Unit x Manufacturing Order Quantity
```

## Stock Ledger

Stock Ledger is the proof of inventory movement.

| Movement Type | Trigger | Stock Effect |
| --- | --- | --- |
| SALE_RESERVE | Sales order confirmation | Reserves available quantity |
| SALE_DELIVERY | Sales order delivery | Decreases finished goods |
| PURCHASE_RECEIPT | Purchase receipt | Increases purchased item |
| MO_COMPONENT_RESERVE | Manufacturing start | Reserves components |
| MO_COMPONENT_CONSUME | Manufacturing completion | Decreases components |
| MO_FINISHED_PRODUCE | Manufacturing completion | Increases finished goods |
| RESERVATION_RELEASE | Cancellation | Releases reserved quantity |
| ADJUSTMENT | Manual correction | Corrects stock |

Sample lifecycle ledger:

| Product | Movement | Qty | Reference |
| --- | --- | ---: | --- |
| Dining Table | SALE_RESERVE | -5 | SO-000001 |
| Wooden Legs | MO_COMPONENT_RESERVE | -60 | MO-000001 |
| Wooden Top | MO_COMPONENT_RESERVE | -15 | MO-000001 |
| Screws | MO_COMPONENT_RESERVE | -180 | MO-000001 |
| Wooden Legs | MO_COMPONENT_CONSUME | -60 | MO-000001 |
| Wooden Top | MO_COMPONENT_CONSUME | -15 | MO-000001 |
| Screws | MO_COMPONENT_CONSUME | -180 | MO-000001 |
| Dining Table | MO_FINISHED_PRODUCE | +15 | MO-000001 |
| Dining Table | SALE_DELIVERY | -20 | SO-000001 |

## Audit Logs

Audit logs are separate from stock ledger. Stock Ledger proves inventory movement. Audit Logs prove business action and user accountability.

Audit fields:

* Date and time
* User
* Module
* Record type
* Record ID
* Action
* Field changed
* Old value
* New value

Example actions:

* SO_CREATED
* SO_CONFIRMED
* MO_AUTO_CREATED
* MO_STARTED
* WO_COMPLETED
* MO_COMPLETED
* SALE_DELIVERY
* PO_CREATED
* PURCHASE_RECEIPT
* PRODUCT_PRICE_UPDATED
* USER_ROLE_CHANGED

## Role-Based Access Control

| Role | Main Access |
| --- | --- |
| Admin | Full workspace access, users and roles |
| Sales User | Customers, products, sales orders and sales-related visibility |
| Purchase User | Vendors, products, purchase orders and procurement signals |
| Manufacturing User | BoMs, manufacturing orders, work orders and production status |
| Inventory Manager | Products, inventory movement, stock ledger and stock adjustment |
| Business Owner | Dashboard, reports, intelligence views and business health |

Access is enforced in frontend navigation and backend APIs.

## Dashboard and Operational Visibility

The dashboard is designed for owner-level and operator-level visibility.

It includes:

* Business Health Score
* Sales Order counters
* Purchase Order counters
* Manufacturing Order counters
* Procurement Required
* Low Stock Products
* Material Shortages
* Stock Movements
* Audit Logs
* Alerts
* ERPilot AI Command Center
* Digital Twin Preview
* Next Best Actions

Dashboard data comes from MySQL through backend APIs.

## ERPilot AI Decision Layer

ERPilot AI reads live ERP data and converts it into operational insight. It never directly mutates stock or orders. The ERP core performs deterministic writes; ERPilot AI explains, predicts, simulates, and recommends.

Core AI features:

1. Real-Time ERP Chat Assistant
2. Order Feasibility Checker
3. Procurement and Reorder Recommendation
4. Manufacturing Readiness and Bottleneck Detection
5. What-If Simulator
6. Business Health Score
7. Root Cause, Stock Movement and Audit Explanation

The AI layer uses Groq API, Llama model integration, backend-only API key access and rule-based fallback behavior.

## ERPilot AI Architecture

```mermaid
flowchart LR
    A["MySQL ERP Database"] --> B["ERP Calculation Layer"]
    B --> C["Context Builder"]
    C --> D["Groq Llama Model"]
    D --> E["Structured JSON Insight"]
    E --> F["ERPilot UI Cards"]

    D -.->|API unavailable / malformed response| G["Rule-Based Fallback"]
    G --> E

    style D fill:#e0e7ff,stroke:#6366f1,stroke-width:2px
    style G fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style E fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

The frontend never receives AI API keys. All AI calls are handled by backend services.

## ERPilot AI Features

| Feature | Business Value |
| --- | --- |
| Real-Time ERP Chat Assistant | Answers operational questions from live records |
| Order Feasibility Checker | Explains whether demand can be fulfilled |
| Procurement Recommendation | Highlights purchase/manufacturing needs |
| Manufacturing Readiness | Detects component and work-order blockers |
| What-If Simulator | Simulates large-order impact before commitment |
| Business Health Score | Summarizes operational condition |
| Root Cause Explanation | Explains delays, shortages and ledger movements |

## Digital Twin Workflow

```mermaid
flowchart LR
    A["Customer Orders"] --> B["Stock Check"]
    B --> C["Procurement"]
    C --> D["Raw Materials"]
    D --> E["Manufacturing"]
    E --> F["Finished Goods"]
    F --> G["Delivery"]

    A --- A1["Status: Healthy / Warning / Blocked"]
    B --- B1["Availability + Shortage"]
    C --- C1["PO / MO Pipeline"]
    D --- D1["Component Readiness"]
    E --- E1["Work Order Progress"]
    F --- F1["Finished Goods Availability"]
    G --- G1["Pending Deliveries"]

    style A fill:#dcfce7,stroke:#16a34a
    style C fill:#fef3c7,stroke:#d97706
    style E fill:#e0e7ff,stroke:#6366f1
```

## What-If Simulator

Example question: "What if we accept 500 Dining Tables?"

BoM impact:

* Wooden Legs: 500 x 4 = 2000
* Wooden Top: 500 x 1 = 500
* Screws: 500 x 12 = 6000
* Wood Polish: 500 x 1 = 500

The simulator checks live stock, BoM, vendor/procurement readiness, and manufacturing load before recommending whether to accept the order.

## Smart Vendor Recommendation

```text
Vendor Score = Reliability x 35% + Lead Time x 25% + Cost x 20% + Availability x 20%
```

The purchase user gets a ranked vendor recommendation before creating procurement.

## Root Cause Analysis

ERPilot AI can explain why an order is delayed:

* Component shortage
* Pending purchase receipt
* Manufacturing bottleneck
* Incomplete work order
* Delayed delivery
* Missing procurement configuration

## Alerts and Notifications

Alerts convert operational risk into action:

* Low stock
* Material shortage
* Procurement required
* Order delay risk
* Bottleneck risk
* Purchase overdue
* Work order blocked
* Delivery ready
* ERPilot recommendation

## System Architecture

```mermaid
graph TB
    subgraph Users["Users"]
        Admin["Admin"]
        Sales["Sales User"]
        Purchase["Purchase User"]
        Mfg["Manufacturing User"]
        Inventory["Inventory Manager"]
        Owner["Business Owner"]
    end

    subgraph Frontend["React Frontend"]
        UI["ERP UI"]
        Dashboard["Dashboard"]
        ERPilotUI["ERPilot AI Cards"]
        DigitalTwin["Digital Twin"]
    end

    subgraph Backend["Node.js + Express Backend"]
        Auth["Auth + RBAC"]
        ProductService["Product Service"]
        SalesService["Sales Service"]
        PurchaseService["Purchase Service"]
        MfgService["Manufacturing Service"]
        BomService["BoM Service"]
        StockService["Stock Ledger Service"]
        AuditService["Audit Service"]
        ERPilotService["ERPilot Service"]
    end

    subgraph Database["MySQL Database via Prisma"]
        Products["Products"]
        Orders["Sales / Purchase / Manufacturing"]
        BOM["BoMs + Operations"]
        Stock["Stock Moves"]
        Audit["Audit Logs"]
        UsersDB["Users + Roles"]
    end

    subgraph AI["ERPilot AI Layer"]
        Calc["Rule Calculations"]
        Context["ERP Context Builder"]
        Llama["Groq Llama"]
        Fallback["Rule-Based Fallback"]
    end

    Users --> Frontend
    Frontend --> Backend
    Backend --> Database
    ERPilotService --> Calc
    Calc --> Context
    Context --> Llama
    Llama --> ERPilotService
    Fallback --> ERPilotService
    ERPilotService --> Database

    style AI fill:#e0e7ff,stroke:#6366f1,stroke-width:2px
    style Database fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style Backend fill:#fef3c7,stroke:#d97706,stroke-width:2px
```

## Database Design / ER Diagram

```mermaid
erDiagram
    User ||--o{ AuditLog : writes
    User ||--o{ ManufacturingOrder : assigned
    Customer ||--o{ SalesOrder : places
    Vendor ||--o{ Product : supplies
    Vendor ||--o{ PurchaseOrder : receives
    Product ||--o{ SalesOrderLine : sold_as
    Product ||--o{ PurchaseOrderLine : purchased_as
    Product ||--o{ ManufacturingOrder : produced_as
    Product ||--o{ StockMove : moves
    Product ||--o{ InventoryReservation : reserves
    Product ||--o| Bom : finished_product
    Bom ||--o{ BomComponent : contains
    Bom ||--o{ BomOperation : defines
    Bom ||--o{ ManufacturingOrder : used_by
    WorkCenter ||--o{ BomOperation : planned_at
    WorkCenter ||--o{ WorkOrder : executed_at
    SalesOrder ||--o{ SalesOrderLine : has
    SalesOrder ||--o{ PurchaseOrder : source
    SalesOrder ||--o{ ManufacturingOrder : source
    SalesOrder ||--o{ InventoryReservation : reserves
    PurchaseOrder ||--o{ PurchaseOrderLine : has
    ManufacturingOrder ||--o{ WorkOrder : has

    User {
      string id
      string email
      string role
      string status
    }
    Product {
      string id
      string sku
      string type
      int onHand
      int reserved
      string strategy
      string procurementType
    }
    SalesOrder {
      string id
      string number
      string status
    }
    ManufacturingOrder {
      string id
      string number
      string status
      int qty
    }
    StockMove {
      string id
      string type
      int change
      int before
      int after
    }
    AuditLog {
      string id
      string action
      string entityType
      string entityId
    }
```

## API Overview

Actual API groups exposed by the Express app:

| Group | Base Path | Key Endpoints |
| --- | --- | --- |
| Health | `/api/health` | `GET /` |
| Auth | `/api/auth` | `POST /register`, `POST /login`, `GET /me` |
| Profile | `/api/profile` | `GET /`, `PUT /`, `POST /photo` |
| Products | `/api/products` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `POST /:id/adjust-stock`, `DELETE /:id` |
| Customers | `/api/customers` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| Vendors | `/api/vendors` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| Manufacturing Plants | `/api/manufacturing-plants` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| BoM | `/api/boms` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| Sales Orders | `/api/sales-orders` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `POST /:id/confirm`, `POST /:id/deliver`, `POST /:id/cancel` |
| Purchase Orders | `/api/purchase-orders` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `POST /:id/confirm`, `POST /:id/receive`, `POST /:id/cancel` |
| Manufacturing Orders | `/api/manufacturing-orders` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `POST /:id/confirm`, `POST /:id/start`, `POST /:id/complete`, `POST /:id/produce`, `POST /:id/cancel` |
| Stock Ledger | `/api/stock-moves` | `GET /`, `GET /summary`, `GET /map`, `GET /traceability`, `GET /exceptions`, `POST /adjustment`, `POST /internal-transfer` |
| Inventory Movement | `/api/inventory-movements` | Same stock movement router |
| Audit Logs | `/api/audit-logs` | `GET /`, `GET /summary`, `GET /record/:module/:recordId` |
| Dashboard | `/api/dashboard` | `GET /summary`, `GET /filter` |
| Alerts | `/api/alerts` | `GET /`, `POST /:id/read`, `PATCH /:id/read`, `POST /mark-all-read` |
| Users | `/api/users` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `PATCH /:id/role`, `PATCH /:id/status`, `PATCH /:id/password`, `DELETE /:id` |
| ERPilot AI | `/api/erpilot` | `POST /chat`, `GET /business-health`, `GET /digital-twin`, `GET /reorder-recommendations`, `POST /what-if`, `POST /vendor-ranking`, `GET /bottlenecks` |
| AI Utility | `/api/ai` | `POST /procurement-advice`, `POST /business-health` |

## Request Lifecycle Diagram

```mermaid
sequenceDiagram
    participant User as Sales User
    participant FE as React Frontend
    participant API as Express API
    participant Auth as Auth / RBAC
    participant Sales as Sales Service
    participant Stock as Inventory Service
    participant Proc as Procurement Engine
    participant Mfg as Manufacturing Service
    participant Ledger as Stock Ledger
    participant Audit as Audit Log
    participant ERPilot as ERPilot AI

    User->>FE: Confirm Sales Order
    FE->>API: Confirm request
    API->>Auth: Verify token and role
    Auth-->>API: Authorized
    API->>Sales: Confirm order
    Sales->>Stock: Check available quantity
    Stock-->>Sales: Available + shortage
    Sales->>Ledger: Record SALE_RESERVE
    Sales->>Audit: Record SO_CONFIRMED
    alt Shortage detected
        Sales->>Proc: Trigger procurement
        Proc->>Mfg: Create Manufacturing Order
        Mfg->>Audit: Record MO_AUTO_CREATED
    end
    Sales-->>API: Confirmation result
    API-->>FE: Updated order + procurement info
    FE->>ERPilot: Request feasibility insight
    ERPilot-->>FE: Risk + recommendation
```

## Dynamic MySQL Seed Data

The database includes realistic seed data to explore every module immediately:

* 6 users with roles
* Around 100 customers
* 10+ vendors
* 15+ products
* Finished goods and raw materials
* BoMs for finished goods
* Work centers and operations
* Sales orders across all statuses
* Purchase orders across all statuses
* Manufacturing orders across all statuses
* Stock ledger entries
* Audit logs
* Alerts

Seed users:

| Role | Email | Password |
| --- | --- | --- |
| Admin | [admin@flowforge.com](mailto:admin@flowforge.com) | Admin@123 |
| Sales User | [sales@flowforge.com](mailto:sales@flowforge.com) | Admin@123 |
| Purchase User | [purchase@flowforge.com](mailto:purchase@flowforge.com) | Admin@123 |
| Manufacturing User | [mfg@flowforge.com](mailto:mfg@flowforge.com) | Admin@123 |
| Inventory Manager | [inventory@flowforge.com](mailto:inventory@flowforge.com) | Admin@123 |
| Business Owner | [owner@flowforge.com](mailto:owner@flowforge.com) | Admin@123 |

## Security and Reliability

| Area | Implementation |
| --- | --- |
| JWT authentication | Token-based protected API access |
| Password security | bcrypt password hashing |
| RBAC | Role guard middleware protects module routes |
| Backend permission enforcement | API routes are protected with auth and role checks |
| Prisma ORM | Typed database access and schema-backed relations |
| Backend-only AI key | AI provider key remains server-side |
| Rule-based AI fallback | ERPilot AI returns operational insight even when provider calls fail |
| No direct DB access from frontend | React calls Express APIs only |
| Safe error responses | Central error handling returns structured API errors |
| Duplicate order confirmation | Existing confirmed order returns current state instead of repeating actions |
| Stock validation | Delivery and manufacturing validate quantity/component conditions |

## Edge Cases Handled

| Edge Case | How FlowForge Handles It |
| --- | --- |
| Confirm order twice | Returns existing confirmed order state without repeating confirmation |
| Deliver more than ordered | Delivery quantity validation blocks invalid quantities |
| Receive more than ordered | Receipt workflow tracks received quantity against order lines |
| Start MO with insufficient components | Component shortage validation blocks start |
| Produce MO after completion | Completed order cannot be produced again |
| Missing vendor | Procurement configuration can create alert and guide user action |
| Missing BoM | Manufacturing procurement requires BoM readiness |
| Cancelled order reservation release | Active reservations are released on cancellation |
| AI provider unavailable | Rule-based fallback returns business-safe output |
| Unauthorized user access | Auth and role guard reject restricted routes |
| Invalid token | Protected API routes require valid authentication |

## Tech Stack

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* shadcn-style components
* Recharts
* Lucide React
* Leaflet / OpenStreetMap

### Backend

* Node.js
* Express.js
* Prisma ORM
* MySQL
* JWT
* bcrypt

### AI

* ERPilot AI
* Groq API
* Llama model
* Rule-based fallback

## Setup Instructions

```bash
git clone <repository-url>
cd <project-folder>
```

Backend:

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default URLs:

* Frontend: http://localhost:5173
* Backend: http://localhost:5000
* API Base: http://localhost:5000/api

## Environment Variables

Backend:

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | MySQL connection string |
| JWT_SECRET | Token signing secret |
| PORT | Backend server port |
| CLIENT_URL | Frontend origin |
| GROQ_API_KEY | Groq API key |
| GROQ_MODEL | Primary Llama model |
| GROQ_FALLBACK_MODEL | Fallback Llama model |
| ENABLE_ERPILOT_AI | Enables ERPilot AI feature path |

Frontend:

| Variable | Purpose |
| --- | --- |
| VITE_API_BASE_URL | Backend API base URL |
| VITE_ENABLE_ERPILOT_AI | Enables ERPilot UI features |

## Useful Commands

Backend:

```bash
npm run dev
npm run start
npm run prisma:seed
npm run seed:validate
npm run test:lifecycle
npx prisma studio
```

Frontend:

```bash
npm run dev
npm run build
npm run preview
```

## Final Evaluation Walkthrough

1. Login as Admin.
2. Open Dashboard and show Business Health Score, status counters, stock movements and AI command center.
3. Open Products and show Dining Table configuration.
4. Open BoM and show Dining Table components and operations.
5. Open Sales Orders and inspect/create order for Raj Furniture Mart.
6. Confirm order for 20 Dining Tables.
7. Show stock check: 5 available, shortage 15.
8. Show auto-created Manufacturing Order.
9. Open Manufacturing Order and show component calculation.
10. Start manufacturing and reserve components.
11. Complete work orders.
12. Produce finished goods.
13. Open Stock Ledger and show SALE_RESERVE, MO_COMPONENT_CONSUME, MO_FINISHED_PRODUCE and SALE_DELIVERY.
14. Deliver Sales Order.
15. Open Audit Logs and show traceability.
16. Open ERPilot AI and ask: "Can I fulfill the latest sales order?"
17. Run What-If: "What if I accept 500 Dining Tables?"
18. Open Digital Twin and show demand-to-delivery live status.

## Winning Highlights

* Implements full demand-to-delivery lifecycle
* Inventory movement is the central business rule
* Supports MTS and MTO strategies
* Auto-creates PO/MO based on shortage and product configuration
* Manufacturing is BoM-based and multiplies components per unit
* Stock Ledger gives complete inventory traceability
* Audit Logs give complete business traceability
* Dashboard gives owner-level visibility
* ERPilot AI explains why actions happen and what to do next
* Digital Twin visualizes the live ERP pipeline
* Database-backed seed data makes every module immediately testable

## Future Scope

* Barcode-based inventory scanning
* Advanced production scheduling
* Vendor performance analytics
* Demand forecasting dashboard
* Multi-warehouse support
* Mobile app for shop-floor users
* Approval workflow for purchase and stock adjustment
* Advanced role permissions

<div align="center">

## Final Pitch

**Traditional ERP answers:**
What happened?
What is happening?

**FlowForge ERP + ERPilot AI also answers:**
Why did it happen?
What will happen next?
What should I do now?

**FlowForge ERP is not just a Mini ERP.**
**It is an intelligent demand-to-delivery operating system for growing manufacturing businesses.**

Built for Odoo x Parul University Hackathon 2026.

</div>
