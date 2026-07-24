# Business Operations Platform – Client Backend

> High-performance, scalable, multi-tenant backend built with **Fastify**, **PostgreSQL**, **Raw SQL**, and **JWT Authentication**.

---

# Overview

The Client Backend powers the Business Operations Platform's customer-facing application.

It exposes secure REST APIs used by the Client Frontend and future public integrations while enforcing tenant isolation, authentication, authorization, feature flags, and business logic.

The backend is designed for:

- Multi-tenancy
- High performance
- Modular development
- Easy maintenance
- Horizontal scalability
- Enterprise security

Unlike the Admin Backend, this service contains only customer-facing functionality.

---

# Tech Stack

| Technology | Purpose |
|------------|----------|
| Fastify | HTTP Server |
| PostgreSQL | Database |
| node-postgres (pg) | Database Driver |
| JWT | Authentication |
| Refresh Tokens | Session Management |
| bcrypt | Password Hashing |
| Redis | Cache & Sessions (Future) |
| BullMQ | Background Jobs (Future) |
| Docker | Containerization |
| Swagger | API Documentation |
| TypeScript | Language |
| JSON Schema | Validation |

---

# Architecture

```
                ┌─────────────────────┐
                │   Client Frontend   │
                │      Next.js        │
                └──────────┬──────────┘
                           │
                           │ HTTPS
                           │
                ┌──────────▼──────────┐
                │   Fastify Backend   │
                └──────────┬──────────┘
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          │                │                 │
     PostgreSQL         Redis            BullMQ
          │                │                 │
          │                │                 │
          └────────────────┼─────────────────┘
                           │
                     Object Storage
```

---

# Project Structure

```
client-backend/
│
├── src/
│   ├── app.ts
│   ├── server.ts
│
│   ├── config/
│   │     database.ts
│   │     env.ts
│   │     jwt.ts
│
│   ├── plugins/
│   │     postgres.ts
│   │     jwt.ts
│   │     cors.ts
│   │     swagger.ts
│
│   ├── routes/
│   │     index.ts
│
│   ├── middleware/
│   │     authenticate.ts
│   │     authorize.ts
│
│   ├── modules/
│   │
│   │     auth/
│   │
│   │     users/
│   │
│   │     inventory/
│   │
│   │     orders/
│   │
│   │     procurement/
│   │
│   │     warehouse/
│   │
│   │     ai/
│
│   ├── repositories/
│
│   ├── services/
│
│   ├── utils/
│
│   ├── types/
│
│   └── sql/
│
├── migrations/
│
├── docs/
│
├── tests/
│
├── package.json
│
└── tsconfig.json
```

---

# Development Philosophy

The project follows a **Feature-Based Modular Architecture**.

Each business domain owns its:

- Routes
- Controllers
- Services
- Repository
- Schemas
- Types
- Utilities

Example:

```
modules/
    auth/
        auth.routes.ts
        auth.controller.ts
        auth.service.ts
        auth.repository.ts
        auth.schema.ts
        auth.types.ts
        auth.utils.ts
```

This keeps every feature isolated and easy to maintain.

---

# Layer Responsibilities

## Routes

Responsible for

- Registering endpoints
- Validation
- Authentication middleware
- Calling controllers

No business logic belongs here.

---

## Controller

Responsible for

- Receiving requests
- Calling services
- Returning responses

Controllers should remain thin.

---

## Service

Responsible for

- Business logic
- Validation
- Rules
- Authorization logic
- Transactions

Most application logic belongs here.

---

## Repository

Responsible for

- Raw SQL
- Database access
- Queries
- Inserts
- Updates
- Deletes

Repositories never contain business logic.

---

## SQL Folder

Contains reusable SQL queries if needed.

Example

```
sql/

users.sql

orders.sql

inventory.sql
```

---

# Database

Database Engine

```
PostgreSQL
```

Driver

```
node-postgres (pg)
```

No ORM will be used.

Reasons:

- Maximum performance
- Full SQL control
- Easier optimization
- No generated code
- Simpler deployments

---

# Database Conventions

Primary Keys

```
UUID
```

Money

```
NUMERIC(14,2)
```

Dates

```
TIMESTAMPTZ
```

Naming

```
snake_case
```

Soft Deletes

```
deleted_at
```

Audit Columns

```
created_at

updated_at
```

---

# Multi-Tenancy

Every tenant-scoped table contains

```
tenant_id
```

Each authenticated request resolves

```
tenant_id
```

from the JWT.

Future implementation will use PostgreSQL Row Level Security (RLS) to enforce tenant isolation at the database layer.

---

# Authentication

Authentication uses JWT.

## Login Flow

```
Email

↓

Password

↓

Verify Password

↓

Generate Access Token

↓

Generate Refresh Token

↓

Store Refresh Token

↓

Return User
```

---

# Tokens

Access Token

Purpose

```
API Authentication
```

Lifetime

```
15 Minutes
```

Refresh Token

Purpose

```
Generate New Access Token
```

Lifetime

```
30 Days
```

Refresh tokens are stored hashed in the database.

---

# Authentication Endpoints

```
POST /api/v1/auth/login

POST /api/v1/auth/refresh

POST /api/v1/auth/logout

GET /api/v1/auth/me
```

Future

```
Forgot Password

Reset Password

Verify Email

Invite User

MFA

Change Password
```

---

# Authorization

Authorization is Role Based.

Each User

↓

Has one or more Roles

↓

Each Role

↓

Contains Permissions

↓

Middleware validates permissions before allowing access.

Example

```
orders.create

orders.update

orders.delete

inventory.read
```

---

# API Versioning

Every endpoint is versioned.

Example

```
/api/v1/auth/login
```

Future versions

```
/api/v2
```

---

# Validation

Fastify JSON Schema Validation.

Every endpoint has

- Params Schema
- Query Schema
- Body Schema
- Response Schema

---

# Error Response

Every error follows one structure.

```json
{
    "error": {
        "code": "INVALID_CREDENTIALS",
        "message": "Email or password is incorrect.",
        "details": null
    }
}
```

---

# Success Response

```json
{
    "success": true,
    "data": {}
}
```

---

# Environment Variables

```
PORT=5000

NODE_ENV=development

DATABASE_URL=

JWT_SECRET=

JWT_EXPIRES_IN=15m

REFRESH_SECRET=

REFRESH_EXPIRES_IN=30d
```

---

# Coding Standards

- Feature-first architecture
- Single Responsibility Principle
- Raw SQL only
- Async/Await
- No callbacks
- Dependency Injection where appropriate
- Consistent naming conventions
- Strict TypeScript
- Reusable utilities
- Thin controllers
- Fat services

---

# Logging

Future implementation will use

```
Pino
```

for structured logging.

Logs

- Requests
- Errors
- Database
- Authentication
- Jobs

---

# API Documentation

Swagger UI will be available at

```
/docs
```

Generated automatically from Fastify schemas.

---

# Testing

Testing stack

- Vitest
- Supertest

Tests

```
Unit Tests

Integration Tests

Authentication Tests

Repository Tests
```

---

# Future Modules

The backend is designed to support the following business modules.

```
Authentication

Users

Companies

Branches

Departments

Employees

Inventory

Products

Orders

Customers

Suppliers

Procurement

Warehouse

Documents

Reports

Notifications

Workflow Engine

Barcode Services

AI Assistant

AI Insights

OCR

Automation

Feature Flags
```

---

# Security

- Password Hashing (bcrypt)
- JWT Authentication
- Refresh Token Rotation
- CORS Protection
- Helmet
- Rate Limiting
- SQL Parameterization
- Row Level Security
- Role Based Access Control
- Input Validation

---

# Future Infrastructure

```
Docker

Docker Compose

Redis

BullMQ

AWS S3

Nginx

GitHub Actions

CI/CD

Monitoring

Horizontal Scaling
```

---

# Development Roadmap

## Phase 1

- Fastify Setup
- PostgreSQL
- JWT
- Login
- Logout
- Refresh Token
- RBAC
- Swagger
- Users

---

## Phase 2

- Companies
- Branches
- Departments
- Employees
- Modules
- Feature Flags

---

## Phase 3

- Inventory
- Products
- Customers
- Suppliers
- Orders
- Procurement
- Warehouse

---

## Phase 4

- Reports
- Notifications
- Workflow Engine
- Scheduled Jobs
- Automation

---

## Phase 5

- OCR
- AI Assistant
- AI Search
- AI Reports
- AI Insights

---

# Design Principles

The backend is built around five core principles.

- Modular
- Scalable
- Secure
- Maintainable
- High Performance

Every feature should be independently maintainable while remaining consistent with the overall architecture.

---

# License

Private Repository

© Business Operations Platform
All Rights Reserved.