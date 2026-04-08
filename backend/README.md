# TeamFlow Backend - Feature Documentation

This README is a backend-focused feature map of what is currently implemented and what can be added next.

## 1. Backend Snapshot

- Stack: Node.js + Express 5 + TypeScript + MongoDB (Mongoose)
- Auth strategy: Cookie-based JWT access token
- Validation: Zod request-body validation middleware
- Security layers: Authentication + global role authorization + project role authorization
- Domain modules: Auth, Users, Projects, Members, Tasks
- Response shape: Centralized success/error response helpers

## 2. Project Structure (Backend)

```txt
backend/
  src/
    config/        # DB + mail transporter config
    controller/    # Route handlers
    middlewares/   # auth, role guards, validation
    models/        # Mongoose schemas (User, Project, Task)
    routes/        # API routes + nested routers
    seeds/         # startup dummy-user seeding
    services/      # business logic layer
    types/         # Zod schemas, enums, express/request typing
    utils/         # helpers (token, hash, responses, errors)
```

## 3. Runtime Behavior Implemented

### 3.1 App Boot Flow

- Loads env values via `dotenv`
- Enables JSON and URL-encoded body parsing
- Enables cookie parsing
- Enables CORS with:
  - `origin`: `CORS_ORIGIN` or `http://localhost:5173`
  - `credentials: true`
- Connects to MongoDB Atlas
- Runs startup user seeding (`seedDummyUsers`)
- Enables request logging with Morgan (`dev`)
- Mounts API router at `/api-v1`
- Uses centralized error middleware

### 3.2 Environment Variables Used

- `PORT`
- `CORS_ORIGIN`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET_KEY`
- `SALT_ROUND`
- `NODE_ENV`
- `EMAIL`
- `EMAIL_PASSWORD`

## 4. API Base Path

All routes are mounted under:

- `/api-v1`

Current top-level route groups:

- `/api-v1/auth`
- `/api-v1/projects`

Nested route groups:

- `/api-v1/projects/:projectId/tasks`
- `/api-v1/projects/:projectId/member`

## 5. Authentication and Authorization Features

### 5.1 Authentication

Implemented:

- Register with name/email/password
- Login with email/password
- JWT generation and verification
- Cookie-based session token (`accessToken`)
- Logout by clearing cookie
- `GET /me` for current logged-in user profile

Cookie behavior:

- `httpOnly: true`
- `sameSite: strict`
- `secure: true` only in production
- register max age: 15 minutes
- login max age: 60 minutes

### 5.2 Global Roles

- `ADMIN`
- `USER`

### 5.3 Project Roles

- `PO` (Product Owner)
- `PM` (Project Manager)
- `DEVELOPER`

### 5.4 Authorization Middleware Layers

- `protect`: requires valid JWT from cookie
- `authorizeGlobal([...])`: checks global role
- `authorizeProjectRole([...])`: checks project membership + project role
- Admin bypass is supported in project-role middleware (global admin can pass without being project member)

## 6. Feature Matrix by Module

## 6.1 Auth Module

### Endpoints

- `POST /api-v1/auth/register`
  - Validates: `name`, `email`, `password`
  - Creates user with global role `USER`
  - Hashes password before save
  - Sets access token cookie

- `POST /api-v1/auth/login`
  - Validates: `email`, `password`
  - Verifies user existence and password hash
  - Sets access token cookie

- `POST /api-v1/auth/logout`
  - Protected route
  - Clears `accessToken` cookie

- `GET /api-v1/auth/me`
  - Protected route
  - Returns authenticated user info (without password)

### Service Rules

- Prevents duplicate registration by email
- Returns explicit auth errors for missing user / wrong password

## 6.2 Users Module

### Endpoints

- `GET /api-v1/auth/users`
  - Protected route
  - Returns all users (name, email, id)
  - Sorted by name ascending

### Feature Purpose

- Useful for project-member assignment UI (user picker)

## 6.3 Projects Module

### Endpoints

- `GET /api-v1/projects`
  - Protected route
  - Admin: gets all projects
  - Regular users: gets only projects where they are members

- `POST /api-v1/projects`
  - Protected + Admin-only
  - Validates project create schema
  - Creates project with `createdBy = requester`

- `PATCH /api-v1/projects/:projectId/add-member`
  - Protected
  - Validates body with `userId|email` + `role`
  - Requires project role: `PO` or `PM` (Admin bypass possible)
  - Adds member with project role assignment

- `GET /api-v1/projects/:projectId`
  - Protected
  - Admin can fetch any project
  - Non-admin must be project member

- `DELETE /api-v1/projects/:projectId`
  - Protected
  - Requires project role: `PM` or `PO` (Admin bypass possible)
  - Deletes project and all tasks in that project

### Service-Level Rules Implemented

- Project name required
- `add-member` lookup supports either `userId` or `email`
- Blocks assigning global `ADMIN` as project member
- For non-admin callers, only `DEVELOPER` can be assigned
- Enforces max one `PO` per project
- Enforces max one `PM` per project
- Prevents duplicate project membership
- Project fetch returns populated user details for owner and members

## 6.4 Members Module (Nested)

### Endpoints

- `GET /api-v1/projects/:projectId/member`
- `POST /api-v1/projects/:projectId/member`

### Current Access Logic

- Both endpoints apply:
  - `protect`
  - `authorizeGlobal([ADMIN])`
  - `authorizeProjectRole([PO, PM])`
- Since global-admin check is mandatory and admin bypass exists in project-role middleware, these routes are effectively admin-only in current behavior.

### Features

- Adds member by explicit `userId + role`
- Fetches all project members with user details populated

## 6.5 Tasks Module (Nested)

### Endpoints

- `POST /api-v1/projects/:projectId/tasks`
  - Access: `PO`, `PM` (Admin bypass)
  - Creates task or subtask

- `GET /api-v1/projects/:projectId/tasks`
  - Access: `PO`, `PM`, `DEVELOPER` (Admin bypass)
  - Returns project tasks

- `GET /api-v1/projects/:projectId/tasks/:taskId`
  - Access: `PO`, `PM`, `DEVELOPER` (Admin bypass)
  - Returns single task

- `PATCH /api-v1/projects/:projectId/tasks/:taskId/status`
  - Access: `PO`, `PM`, `DEVELOPER` (Admin bypass)
  - Updates task status

- `DELETE /api-v1/projects/:projectId/tasks/:taskId`
  - Access: `PO`, `PM` (Admin bypass)
  - Deletes task (and subtasks if parent)

### Task Rules Implemented

- Cannot create task in archived project
- Assigned user must be a member of project
- Assigned member must have project role `DEVELOPER`
- Supports one-level subtasks using `parentTaskId`
- Prevents deeper nesting (subtask of subtask not allowed)
- If parent task is marked `DONE`, all its subtasks are auto-marked `DONE`
- Deleting parent task also deletes all subtasks

## 7. Validation Features (Zod)

### User Validation

- Name min length: 2
- Email must be valid format
- Password min length: 8

### Project Validation

- Name: min 3, max 100
- Description: optional, max 500
- Add member payload requires:
  - role
  - and at least one of `userId` or `email`

### Task Validation

- Title: min 3, max 200
- Description max 1000
- Priority enum supported
- `assignedTo` required for creation
- Status enum enforced for status update

### Member Validation

- `userId` required string
- `role` required enum

## 8. Data Model Features

## 8.1 User Model

Fields include:

- `name`, `email`, `password`
- `role` (`ADMIN` or `USER`)
- `refreshToken` (present but not actively used in auth flow)
- `isVerified`, `isBlocked`, `passwordChangedAt` (present but not yet used in guard flow)
- timestamps

## 8.2 Project Model

Fields include:

- `name`, `description`
- `createdBy`
- `members[]` with `{ user, role }`
- `status`: `ACTIVE`, `COMPLETED`, `ARCHIVED`
- timestamps

## 8.3 Task Model

Fields include:

- `title`, `description`
- `projectId`
- `parentTaskId` (self reference for subtasks)
- `createdBy`, `assignedTo`
- `status`: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`
- `priority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `dueDate`
- timestamps

Indexes:

- `projectId`
- `parentTaskId`
- compound index on `parentTaskId + projectId`

## 9. Reliability and API Standardization Features

Implemented:

- Shared success response formatter
- Shared error response formatter
- Custom `AppError` with status code + details
- `asyncHandler` wrapper for async controller error propagation
- centralized error middleware for known and unknown errors

## 10. Seed and Dev Experience Features

- Auto-seeds dummy users at app startup if not present
- Seed is idempotent by email-check
- Build and run scripts provided:
  - `npm run build`
  - `npm run dev`
  - `npm run start`

## 11. Features You Might Add Next (Prioritized)

## Priority A - Core Product Maturity

1. Refresh token flow
- Use `refreshToken` column in user model
- Add refresh endpoint + token rotation
- Keep short-lived access token and long-lived refresh token

2. Email verification + password reset
- Use existing mail transporter
- Complete currently empty mail utility
- Add verify-email and forgot/reset password APIs

3. Task updates beyond status
- Route/controller/service for editing title/description/priority/dueDate
- You already have `updateTaskDetailsZodSchema` ready to use

4. Pagination and filtering
- Add pagination for users/projects/tasks
- Filter tasks by status, assignee, priority, due date range
- Add sort options for list endpoints

## Priority B - Authorization and Integrity Improvements

1. Clarify members route policy
- Current `/member` endpoints behave as admin-only
- Decide intended behavior (admin-only vs PO/PM allowed)
- Adjust middleware ordering/rules accordingly

2. Enforce ObjectId validity
- Validate route params (`projectId`, `taskId`, `userId`) before DB calls
- Return clear 400 errors for invalid ids

3. Add business constraints
- Optional: prevent deleting a project unless status is archived
- Optional: enforce valid task status transitions (state machine)

4. Blocked/verified user enforcement
- Integrate `isBlocked` and `isVerified` into login/protect flow

## Priority C - Security and Operations

1. Rate limiting and brute-force protection
- Add rate limits for login/register endpoints

2. Input hardening
- Add request sanitization to reduce NoSQL injection and malicious payloads

3. Structured logging and observability
- Add request id/correlation id
- Add centralized logger and log levels

4. Health and readiness endpoints
- `/health` (basic)
- `/ready` (DB connectivity check)

## Priority D - Testing and Maintainability

1. Unit tests
- Service-level tests for role rules, add-member constraints, task rules

2. Integration/API tests
- Route tests for auth + RBAC matrix
- Seed and error-path test coverage

3. API documentation
- OpenAPI/Swagger docs auto-generated from schema definitions

4. Transactions for multi-step operations
- Use DB transactions for destructive cascades where consistency is critical

## 12. Known Gaps/Notes from Current Code

- `generateToken` helper is imported in auth service but not used there.
- `mail.ts` is currently empty even though nodemailer config exists.
- User model has fields (`refreshToken`, `isVerified`, `isBlocked`) that are not wired into active flows yet.
- Members routes currently combine global and project-role checks in a way that effectively restricts to admin.

## 13. Quick Start (Backend)

```bash
cd backend
npm install
npm run build
npm run dev
```

Server default:

- `http://localhost:3000`
- API base: `http://localhost:3000/api-v1`

---

If you want, I can next generate a second file called `FEATURE_CHECKLIST.md` inside backend with a checkbox roadmap (Now / Next / Later) that maps directly to this README.
