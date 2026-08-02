# Client Backend — API Reference

Business-facing API for the Business Operations Platform, built with **Fastify**.

- Base URL prefix: `/api/v1`
- Auth: JWT access token (tenant-scoped) required on all routes unless marked otherwise
- All list endpoints support pagination (`page`/`limit` or cursor) and are automatically scoped to the authenticated tenant via Row-Level Security
- Public API routes use a separate API-key auth scheme and are rate-limited independently at the Nginx layer

---

## Table of Contents

- [Auth](#auth)
- [Organization](#organization)
- [Users, Roles & Permissions](#users-roles--permissions)
- [Modules & Settings](#modules--settings)
- [Catalog (Products)](#catalog-products)
- [Inventory](#inventory)
- [Orders](#orders)
- [Customers](#customers)
- [Suppliers](#suppliers)
- [Procurement](#procurement)
- [Warehouse Operations](#warehouse-operations)
- [Documents](#documents)
- [Reports](#reports)
- [Automation](#automation)
- [Notifications](#notifications)
- [Barcode Services](#barcode-services)
- [AI Services](#ai-services)
- [Public API](#public-api)

---

## Auth

*No JWT required for `signup`, `login`, `refresh`, `forgot-password`, `reset-password`, `verify-email`.*

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/signup` | Business signup — creates tenant, subscription, owner user |
| POST | `/auth/login` | Issues access + refresh token |
| POST | `/auth/refresh` | Rotates access token using refresh token |
| POST | `/auth/logout` | Revokes refresh token |
| POST | `/auth/forgot-password` | Sends reset email |
| POST | `/auth/reset-password` | Sets new password from reset token |
| POST | `/auth/verify-email` | Confirms email verification token |
| POST | `/auth/mfa/enable` | Enrolls MFA for current user |
| POST | `/auth/mfa/verify` | Verifies MFA code at login |
| GET | `/auth/me` | Current user + tenant + permissions |

## Organization

| Method | Endpoint | Purpose |
|---|---|---|
| GET / PATCH | `/organization/profile` | Company profile |
| GET / POST | `/branches` | List / create branches |
| GET / PATCH / DELETE | `/branches/:id` | Manage a branch |
| GET / POST | `/departments` | List / create departments |
| GET / PATCH / DELETE | `/departments/:id` | Manage a department |
| GET / POST | `/employees` | List / add employees |
| GET / PATCH / DELETE | `/employees/:id` | Manage an employee |

## Users, Roles & Permissions

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/users` | List / invite tenant users |
| GET / PATCH / DELETE | `/users/:id` | Manage a user |
| POST | `/users/:id/resend-invite` | Resend invite email |
| GET / POST | `/roles` | List / create roles |
| GET / PATCH / DELETE | `/roles/:id` | Manage a role |
| GET | `/permissions` | List available permission keys |
| PUT | `/roles/:id/permissions` | Set a role's permission set |

## Modules & Settings

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/modules` | Modules enabled for this tenant (drives sidebar) |
| GET / PATCH | `/settings` | Tenant-level settings |
| GET | `/feature-flags` | Feature flags enabled for this tenant |

## Catalog (Products)

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/categories` | List / create categories |
| GET / PATCH / DELETE | `/categories/:id` | Manage a category |
| GET / POST | `/products` | List (filter/search) / create products |
| GET / PATCH / DELETE | `/products/:id` | Manage a product |
| GET / POST | `/products/:id/variants` | List / add variants |
| PATCH / DELETE | `/variants/:id` | Manage a variant |
| GET / POST | `/products/:id/prices` | Price history / set new price |
| POST / DELETE | `/products/:id/images`, `/images/:id` | Manage product images |
| GET / POST | `/barcodes` | List / assign barcodes |
| GET | `/barcodes/:code/lookup` | Resolve a scanned code to a product |

## Inventory

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/warehouses` | List / create warehouses |
| GET / PATCH / DELETE | `/warehouses/:id` | Manage a warehouse |
| GET | `/stock-levels` | Current stock, filterable by warehouse/product |
| GET | `/stock-levels/:productVariantId` | Stock for one item across warehouses |
| POST | `/stock-adjustments` | Manual adjustment (with reason) |
| GET | `/stock-transactions` | Transaction history / audit trail |
| GET / POST | `/stock-transfers` | List / initiate warehouse-to-warehouse transfer |
| PATCH | `/stock-transfers/:id` | Update transfer status |
| GET | `/low-stock-alerts` | Active low-stock alerts |

## Orders

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/orders` | List (filter by status/customer) / create order |
| GET / PATCH / DELETE | `/orders/:id` | Manage an order |
| POST | `/orders/:id/status` | Transition order status |
| GET | `/orders/:id/history` | Status history |
| POST | `/orders/:id/deliveries` | Attach delivery/tracking info |
| GET / PATCH | `/deliveries/:id` | Manage a delivery |

## Customers

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/customers` | List / create customers |
| GET / PATCH / DELETE | `/customers/:id` | Manage a customer |
| GET / POST | `/customers/:id/contacts` | Manage contacts |
| GET | `/customers/:id/orders` | Purchase history |
| GET | `/customers/:id/balance` | Outstanding balance / credit limit |

## Suppliers

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/suppliers` | List / create suppliers |
| GET / PATCH / DELETE | `/suppliers/:id` | Manage a supplier |
| GET / POST | `/suppliers/:id/contacts` | Manage contacts |
| GET / POST | `/suppliers/:id/documents` | Attach/list supplier documents |

## Procurement

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/purchase-requests` | List / create requests |
| GET / PATCH / DELETE | `/purchase-requests/:id` | Manage a request |
| POST | `/purchase-requests/:id/approve` | Approve |
| POST | `/purchase-requests/:id/reject` | Reject |
| GET / POST | `/purchase-orders` | List / create purchase orders |
| GET / PATCH / DELETE | `/purchase-orders/:id` | Manage a purchase order |
| POST | `/purchase-orders/:id/send` | Send PO to supplier |
| GET | `/approvals` | Generic approval trail (any entity) |

## Warehouse Operations

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/goods-receipts` | List / log a receipt against a PO |
| GET / PATCH | `/goods-receipts/:id` | Manage a receipt |
| GET / POST | `/pick-lists` | List / create pick lists (from orders) |
| PATCH | `/pick-lists/:id` | Update pick status |
| GET / POST | `/dispatches` | List / record a dispatch |

## Documents

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/documents` | List / upload a document |
| GET / DELETE | `/documents/:id` | Fetch / remove a document |
| POST | `/documents/:id/link` | Link a document to an order/supplier/PO/etc. |
| POST | `/uploads` | Raw file upload, returns a storage URL |

## Reports

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/reports/sales` | Sales report (query params for range/filters) |
| GET | `/reports/inventory` | Inventory report |
| GET | `/reports/customers` | Customer report |
| GET | `/reports/revenue` | Revenue report |
| GET | `/reports/expenses` | Expenses report |
| GET / POST | `/report-definitions` | Saved/custom report configs |
| GET | `/report-snapshots` | Generated/exported report files |

## Automation

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/workflow-rules` | List / create automation rules |
| GET / PATCH / DELETE | `/workflow-rules/:id` | Manage a rule |
| GET | `/workflow-runs` | Execution history for a rule |

## Notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notifications` | List notifications for current user |
| PATCH | `/notifications/:id/read` | Mark as read |

## Barcode Services

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/barcode-scans` | Log a scan event (from mobile/warehouse device) |
| GET | `/barcode-scans` | Scan history |

## AI Services

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/ai/ocr/receipt` | Submit receipt image for OCR |
| POST | `/ai/ocr/invoice` | Submit invoice image for OCR |
| POST | `/ai/document-extraction` | Generic document data extraction |
| GET / POST | `/ai/conversations` | List / start AI Assistant chat sessions |
| POST | `/ai/conversations/:id/messages` | Send a message in a conversation |
| GET | `/ai/insights` | Operational insights / predictive analytics |
| GET | `/ai/jobs/:id` | Poll status of an async AI job |

## Public API

*Separate API-key auth (not the tenant JWT), rate-limited independently at Nginx. Scope is restricted to what the API key's permissions allow.*

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/public/products` | Read-only product catalog |
| GET | `/public/orders` | Read orders (scoped to the API key's permissions) |
| POST | `/public/orders` | Create an order via integration |

---

## Notes

- Endpoints are grouped to match the module structure in the platform's design doc and can be built/migrated phase by phase (Foundation → Core Ops → Business Ops → Automation → AI).
- Route handlers should stay thin — validation (Fastify JSON Schema) → call a query/repository function (raw SQL via `pg`) → return response. No business logic in the route file itself.
- Every route that touches tenant-scoped data relies on Postgres Row-Level Security via the `tenant_id` set on the connection/session — but permission checks (RBAC) still need to happen explicitly in middleware per route, RLS is a safety net, not the access-control layer.