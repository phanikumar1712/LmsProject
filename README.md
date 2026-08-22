# 📚 EduNexus LMS – Learning Management System

A full-stack Learning Management System (LMS) built with **Node.js + Express** (backend) and **React 19 + Vite + TailwindCSS** (frontend), powered by **NeonDB (PostgreSQL)** and served via **Nginx** in production.

Designed for **Indian colleges, universities, and ed-tech platforms** with department-level isolation, role-based access control, audit compliance (NAAC/UGC/DPDP Act), and bulk import capabilities.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [👥 Role-Based Access Control](#-role-based-access-control)
  - [Role Comparison Table](#role-comparison-table)
  - [Permission Matrix](#permission-matrix)
  - [Department Scoping](#department-scoping)
- [🎯 Role Flows & Interactions](#-role-flows--interactions)
  - [Student Flow](#1-student-flow)
  - [Instructor Flow](#2-instructor-flow)
  - [Admin Flow (Department-Scoped)](#3-admin-flow-department-scoped)
  - [Super Admin Flow (Platform-Wide)](#4-super-admin-flow-platform-wide)
- [📥 Bulk Import System](#-bulk-import-system)
- [✨ Features](#-features)
- [🚀 Getting Started](#-getting-started)
- [🛣️ API Endpoints](#-api-endpoints)
- [🔧 Environment Variables](#-environment-variables)
- [📁 Key Scripts](#-key-scripts)
- [🧹 Maintenance & Cleanup](#-maintenance--cleanup)
- [✅ Verified Flows](#-verified-flows)

---

## 🏗️ Tech Stack

### Backend
| Category | Technology |
|----------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 5.2 |
| Database | NeonDB (PostgreSQL) via `pg` 8.16 |
| Auth | JWT (`jsonwebtoken` 9) + bcrypt |
| Email | Resend API |
| File Uploads | Cloudinary + Multer |
| Spreadsheet Parsing | xlsx 0.20 |
| Security | Helmet 8, express-rate-limit 8 |

### Frontend
| Category | Technology |
|----------|-----------|
| Framework | React 19.2 |
| Build Tool | Vite 8 |
| Routing | React Router DOM 7.15 |
| Styling | TailwindCSS 4.3 |
| Animations | Framer Motion 12 |
| Charts | Recharts 3.8 |
| HTTP Client | Fetch API (native) |
| Icons | Lucide React |
| Toasts | React Hot Toast |

### Infrastructure
| Category | Technology |
|----------|-----------|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx (production) |
| Process Manager | dumb-init |

---

## 🗂️ Project Structure

```
LmsProject/
├── backend/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── controllers/      # Route handlers (auth, courses, users, etc.)
│   │   ├── routes/           # API route definitions with role guards
│   │   ├── middleware/        # Auth (JWT), error handling, rate limiting
│   │   ├── db/               # NeonDB pool, migrations, seed data
│   │   ├── utils/            # Helpers (email, quiz, pagination, formatters, courseAuth)
│   │   └── index.js          # Express app entry point
│   ├── tests/                # Unit & API integration tests
│   ├── scripts/              # Maintenance & one-off cleanup scripts
│   │   └── maintenance/      # Schema migrations, data fixes
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── frontend/                 # React 19 + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/            # All page components by role
│   │   │   └── dashboard/
│   │   │       ├── student/     # Student dashboards
│   │   │       ├── instructor/  # Instructor dashboards
│   │   │       ├── admin/       # Admin dashboards
│   │   │       └── superadmin/  # Super Admin dashboards
│   │   ├── components/       # Reusable UI (DataGrid, DataTable, Modal, ConfirmDialog, Breadcrumbs, Charts, Layout)
│   │   ├── contexts/         # AuthContext for global auth state
│   │   ├── services/         # API client layer (fetch-based)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # CSV/Excel import parsers
│   │   └── lib/              # Constants, course access logic
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
└── docker-compose.yml
```

---

## 👥 Role-Based Access Control

### Role Comparison Table

| Capability | 🎓 Student | 👨‍🏫 Instructor | 🛡️ Admin | 👑 Super Admin |
|-----------|-----------|---------------|----------|---------------|
| **Dashboard Path** | `/student` | `/instructor` | `/admin` | `/super-admin` |
| **Scope** | Self | Self | Department-wide | Platform-wide |
| **Department Isolation** | — | — | ✅ Scoped to own dept | ❌ Global access |

> **All courses are FREE.** There is no subscription/plan system. Every feature is fully accessible to all enrolled students.

### Full Permission Matrix

The platform includes granular role-based access for courses, users, departments, categories, analytics, announcements, and system settings. See the **Permission Matrix** sections below for the full detail (50+ actions across 4 roles).

#### 📚 Courses
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| Browse published courses | ✅ | ✅ | ✅ | ✅ |
| View course details | ✅ | ✅ | ✅ | ✅ |
| Create course | ❌ | ✅ Own | ✅ Dept | ✅ All |
| Edit course content | ❌ | ✅ Own | ✅ Dept | ✅ All |
| Delete course | ❌ | ✅ Own | ✅ Dept | ✅ All |
| Add sections/lessons | ❌ | ✅ Own | ✅ Dept | ✅ All |
| Approve/Reject course | ❌ | ❌ | ✅ Dept | ✅ All |
| Send to draft with note | ❌ | ❌ | ✅ Dept | ✅ All |
| Enroll | ✅ | ❌ | ❌ | ❌ |
| Force-edit any course | ❌ | ❌ | ❌ | ✅ |

#### 👥 User Management
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| View own profile | ✅ | ✅ | ✅ | ✅ |
| Change own password (self-service) | ✅ | ✅ | ❌ (managed by Super Admin) | ✅ |
| List users | ❌ | ❌ | ✅ Dept students+instructors | ✅ All roles |
| Change user role | ❌ | ❌ | ✅ Dept non-admin | ✅ Any role |
| Create Instructor | ❌ | ❌ | ✅ Dept | ✅ Any dept |
| Import Instructors (CSV) | ❌ | ❌ | ✅ Dept | ✅ Any dept |
| Import Students (CSV) | ❌ | ❌ | ✅ Dept | ✅ Any dept |
| Suspend/Activate user | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user |
| Reset user password | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user (incl. admins) |
| Force password change on next login | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user |
| Delete user | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user |
| Create Admin | ❌ | ❌ | ❌ | ✅ |
| Create Super Admin | ❌ | ❌ | ❌ | ✅ Only |
| Manage admin departments | ❌ | ❌ | ❌ | ✅ |
| Set admin quotas | ❌ | ❌ | ❌ | ✅ |

#### 🏛️ Department Management
| Action | Student | Instructor | Admin | Super Admin |
|--------|---------|------------|-------|-------------|
| List departments | ✅ Signup only | ❌ | ✅ | ✅ |
| Create department | ❌ | ❌ | ❌ | ✅ |
| Edit department | ❌ | ❌ | ❌ | ✅ |
| Delete department | ❌ | ❌ | ❌ | ✅ |
| Assign users to dept | ❌ | ❌ | ❌ | ✅ |

#### 📊 Categories
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| Browse categories | ✅ | ✅ | ✅ | ✅ |
| Create category | ❌ | ❌ | ✅ Dept | ✅ Any |
| Edit category | ❌ | ❌ | ✅ Dept | ✅ Any |
| Delete category | ❌ | ❌ | ✅ Dept | ✅ Any |
| Import categories (CSV) | ❌ | ❌ | ✅ Dept | ✅ Global |

#### 📢 Announcements
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| View announcements | ✅ Own dept | ✅ Own dept | ✅ Own dept | ✅ All |
| Create announcement | ❌ | ❌ | ✅ Dept only | ✅ Platform-wide |
| Delete announcement | ❌ | ❌ | ✅ Own | ✅ Any |

#### 📈 Analytics & Reports
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| Personal stats | ✅ | ✅ | ❌ | ❌ |
| Own course analytics | ❌ | ✅ | ❌ | ❌ |
| Department analytics | ❌ | ❌ | ✅ Scoped | ✅ All |
| Platform analytics | ❌ | ❌ | ❌ | ✅ |
| AI-powered reports | ❌ | ❌ | ❌ | ✅ |
| Export reports (CSV) | ❌ | ✅ Own | ✅ Dept | ✅ Platform |

#### 🔍 Audit Logs
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| View department logs | ❌ | ❌ | ✅ (Scoped) | ✅ |
| View platform-wide logs | ❌ | ❌ | ❌ | ✅ |
| See old → new values & device info | ❌ | ❌ | ✅ (Scoped) | ✅ |
| Export audit logs (CSV) | ❌ | ❌ | ✅ (Scoped) | ✅ |
| Filter by action / record / date / search | ❌ | ❌ | ✅ (Scoped) | ✅ |

> Every sensitive action is recorded with **WHO** (actor + role), **WHAT** (action),
> **WHEN** (timestamp), **WHICH record** (resource + id), **OLD → NEW values** (e.g.
> Active → Inactive), and **IP + device** (browser/OS parsed from the User-Agent).

#### ⚙️ Platform Settings
| Action | Student | Instructor | Admin | Super Admin |
|--------|---------|------------|-------|-------------|
| View settings | ❌ | ❌ | ❌ | ✅ |
| Update branding | ❌ | ❌ | ❌ | ✅ |
| Configure email/SMTP | ❌ | ❌ | ❌ | ✅ |
| SSO/Login config | ❌ | ❌ | ❌ | ✅ |
| Terms/Policies | ❌ | ❌ | ❌ | ✅ |
| API keys management | ❌ | ❌ | ❌ | ✅ |

#### 🩺 System Health
| Action | Student | Instructor | Admin | Super Admin |
|--------|---------|------------|-------|-------------|
| Server uptime | ❌ | ❌ | ❌ | ✅ |
| DB status/latency | ❌ | ❌ | ❌ | ✅ |
| Memory usage | ❌ | ❌ | ❌ | ✅ |
| Service status | ❌ | ❌ | ❌ | ✅ |
| Enforce 2FA platform-wide | ❌ | ❌ | ❌ | ✅ |

### Department Scoping

Admins are **department-scoped**. When an Admin is assigned to a department:

| What Admin Sees | Scope Rule |
|----------------|------------|
| Users | Only STUDENT and INSTRUCTOR roles within their department |
| Courses | Only courses whose **category** belongs to their department |
| Categories | Only categories tagged with their department |
| Announcements | Only announcements created for their department |
| Analytics | Only enrollments/ratings from their department's courses |
| Audit Logs | Only actions performed by users in their department |
| Bulk Import | New users are automatically assigned to their department |

> **Super Admin** sees everything platform-wide with no department restriction.

---

## 🎯 Role Flows & Interactions

### 1. Student Flow

Students can **browse courses, enroll for free, watch videos, take quizzes** (with anti-cheat enforcement), track progress, earn **certificates**, manage **wishlists**, maintain **learning streaks**, and interact in **discussions**.

### 2. Instructor Flow

Instructors **create courses** with sections/lessons/quizzes, **track student progress**, view **analytics**, respond to **reviews**, and **submit courses for admin approval**. The course lifecycle follows: **DRAFT → PENDING (submitted) → PUBLISHED (approved)** or **REJECTED (sent back for revision)**.

- **Instructor dashboard** (`/instructor`) shows My Courses · Total Students · Pending Assignments (ungraded submissions) · Avg Course Completion, plus **Upcoming Classes** (live sessions), **Upcoming Quizzes**, **Recent Submissions**, and **Recent Announcements** — all computed server-side from the instructor's own courses.
- **Course Builder** supports the full lesson-type palette: **Video · PDF · Document · Audio · Text · Quiz · Assignment · Coding Exercise · External Link** (each renders correctly in the student lesson player).
- **My Courses** cards deep-link into **Manage Content** (drag-to-reorder `/instructor/content-order?course=`), **Manage Students / View Progress** (`/instructor/students?course=`), and a one-click **Submit for Approval** button on Draft/Rejected courses.

### 3. Admin Flow (Department-Scoped)

Admins **manage users**, **moderate courses** (approve/reject/send back to draft), **bulk import** students & instructors via CSV/Excel, **create announcements**, **track student progress**, and generate **reports** — all scoped to their department. Admin passwords are **managed by the Super Admin** (no self-service or email-OTP reset) — students and instructors change their own password from the profile **Security** tab.

### 4. Super Admin Flow (Platform-Wide)

Super Admins have **full platform access**: manage **departments**, create **admins**, view **platform analytics** and **AI-powered reports**, monitor **system health**, review **audit logs** for DPDP Act compliance, configure **platform settings** (branding, email, etc.), and enforce **2FA**.

---

## 📥 Bulk Import System

Supports **CSV and Excel (XLSX)** bulk imports with **case-insensitive headers**. Max **500 rows per import**, max **5 imports per 5 minutes**.

| Import Type | Who Can Do It |
|-------------|---------------|
| **Instructors** | Admin (dept-scoped) / Super Admin (any dept) |
| **Students** | Admin (dept-scoped) / Super Admin (any dept) |
| **Categories** | Admin (dept-scoped) / Super Admin (platform-wide) |
| **Quiz Questions** | Instructor (within own courses) |

---

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based login, registration, and password reset
- OTP verification via Resend email API
- Demo login for Student/Instructor only (disabled in production)
- Role-based access control: **Student**, **Instructor**, **Admin**, **Super Admin**
- Department-scoped admin isolation
- Rate limiting: 10 login attempts/hour, 5 imports/5 minutes
- Constant-time OTP comparison (timing attack prevention)
- **Notifications**: created for 10+ event types (course approved/rejected, announcements, quizzes, assignments, discussions, certificates, enrollments, password resets, role changes)
- **Announcements**: batch-insert to target roles/departments; mark-read with view_count; read-receipt tracking

### 👩‍🏫 Instructor Portal
- Create & manage courses with sections and lessons
- **Quiz builder** with CSV/Excel question import, random selection modes (ALL / RANDOM / BY_DIFFICULTY / BY_CATEGORY)
- **Assessments tab**: create graded exams with max-attempt limits, per-category/difficulty question selection, and auto-grading
- **Assessment Reports**: student rankings, per-category score breakdown charts, CSV export, and full answer-vs-correct review pages
- **Anti-cheat quiz system**: fullscreen enforcement, tab-switch detection, daily attempt limits, developer-tools blocking
- View enrolled students and progress
- Analytics dashboard (enrollments, ratings)
- Respond to course reviews
- **Live Sessions**: create/manage live class sessions with meeting links
- **Content Versioning**: version snapshots with changelog and drip-status
- **Course Changelog**: document changes per version for student visibility

### 🎓 Student Dashboard
- Browse and enroll in courses (all **completely free**)
- Video player with lesson tracking and progress bar
- **Anti-cheat quiz system** (fullscreen mode, 3 violations = auto-submit)
- **Write Exam** tab: take instructor assessments with configurable attempts & selection modes
- **My Results** tab: full attempt history with per-question answers, scores, and printable reports
- Wishlist management
- **Certificates** on course completion
- **Learning streaks** (current + longest)
- **Discussion forums** per course/lesson
- **Notes**: personal notes per lesson, visible only to the student
- **Bookmarks**: mark and revisit specific lessons
- **Grades**: consolidated grade view across all courses

### 🛡️ Admin Dashboard (Department-Scoped)
- **Department limit enforcement**: capacity card with progress bars; course approval & student imports blocked with a clear message when the department limit is reached (admins & super admins get notified)
- User management: view, create, suspend, reset passwords for dept students & instructors
- **Self-service password change** for students & instructors (profile Security tab + Settings Security tab); admin passwords are managed by the Super Admin only — self-service and email-OTP reset are blocked for admins
- **Bulk import** instructors and students from CSV/Excel (one-student-per-department enforced via globally unique email + per-department roll number constraint)
- **Course moderation**: approve, reject (with structured reason modal), send back to draft with notes
- Course content editing: edit sections, lessons, quizzes within dept courses
- Category management with bulk import
- Department-level analytics (enrollments, ratings)
- **Announcements** (department-scoped) with read-tracking
- Student progress tracking
- Bulk enrollment
- Assignments & submissions management with **rubric grading**
- Academic calendar / timetable
- Review moderation
- Reports export (CSV)

### 👑 Super Admin (Platform-Wide)
- **Department Management**: Create, edit, delete departments + set per-department **student & course limits**
- **Admin Management**: Create admins, assign multiple departments (first = primary), promote/demote with password authorization
- **User Management**: Full access to all roles, promote to Admin/Super Admin, bulk import into any department
- **Course Oversight**: View all courses across all departments, force-edit or delete any course, override instructor/admin decisions
- **Platform Settings**: Branding (logo, colors, platform name), email/SMTP config, SSO/login config, terms & policies
- **Analytics & Reports**: Platform-wide analytics, **AI-powered reports**, per-department limit usage overview, CSV export
- **Audit Logs**: View every action by every user — with **old → new values**, **IP + device info**, filters by action/record/date/search, and CSV export (DPDP Act compliance). Super Admin sees the full platform trail; department admins see their own department's entries
- **System Health**: Server/uptime monitoring, DB status, memory usage, service health dashboard
- **Announcements**: Broadcast to **admins only** (or specific departments via filter), or all users/roles platform-wide
- **Force Logout**: Terminate any user session
- **2FA Enforcement**: Enable/require two-factor authentication platform-wide
- **Academic Sessions**: Create/edit/delete academic sessions per department

### 📹 Media & Content
- Cloudinary integration for video/image uploads
- Profile photo uploads with auto-cropping
- Course thumbnails and lesson content files
- Support for video, document, quiz, and text lesson types
- Course preview modal with video/audio/PDF/text/external link rendering

### 🛡️ Security & Hardening
- Rate limiting on auth endpoints (10 attempts/hour) and import endpoints (5/5 min)
- Max row cap (500 rows) on all bulk imports
- Frontend timeout (120s) with cancel support on imports
- PostgreSQL error sanitization (no raw DB errors exposed to clients)
- Helmet security headers
- CORS protection with configurable origins
- Request timeout (30s) to prevent connection pool exhaustion
- Audit logging for all sensitive actions — each entry records actor, action, record, **old/new values**, and **IP + parsed device** (browser/OS) via the shared `writeAudit` helper
- **Granular role-based permissions**: every protected route is gated by a permission (`student.create`, `course.approve`, `audit.view`, …) from `backend/src/utils/permissions.js`, not bare role strings — the Super Admin can **grant/revoke individual permissions per user** (`/super-admin/permissions`), and auth responses ship the user's effective permission list to the frontend (`useAuth().can('course.approve')`)
- Password hashing with bcrypt (12 rounds)
- Ownership & department-scope checks on assignments, attendance/live sessions, course mutations, and course-version endpoints — cross-course/cross-department access is rejected
- Self-service password change (`PUT /api/auth/change-password`) works for every role incl. admins; admins are always allowed to view their own user-detail page (self is exempt from department isolation)

### ⚡ Performance
- **N+1 query elimination**: notifications, bulk enrollments, and CSV/Excel user imports use batched `INSERT ... SELECT FROM unnest(...)` / `ON CONFLICT` queries — a 500-row import drops from ~3,000 round-trips to ~5
- **Bulk import constraint enforcement**: email uniqueness (global) + roll number uniqueness (per-department) prevent duplicate students across departments; dept capacity limits are checked before insert
- Memoized auth context (provider value + role helpers) to avoid re-rendering every consumer on each provider render
- Debounced course search (400ms) with stale-response guards so a slow older request can never overwrite a newer one
- Abortable data fetching: `useAsyncData` aborts in-flight requests on dependency change and unmount (network cancellation + state-write guards)
- Route-level code splitting: each page is its own lazy-loaded chunk (React.lazy + Suspense) with an error boundary for failed chunk loads

### 🌙 UX
- Dark mode support
- Responsive design (mobile-first)
- Toast notifications (react-hot-toast)
- Loading skeletons and transitions (Framer Motion)
- Animated charts (Recharts)
- Hover states and micro-interactions
- Collapsible sidebar navigation

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | v20+ |
| [npm](https://www.npmjs.com/) | v9+ |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest (for Docker method) |

### 👑 Demo Accounts

Demo accounts are seeded **only in development/test environments** (`NODE_ENV != production`). In production they are never created — real users must be provisioned via the admin UI, and the super admin password must be provided via `SUPER_ADMIN_PASSWORD`.

**All non-SuperAdmin accounts use password: `demo123`**

> 👑 The **Super Admin** account is seeded with the display name **"Super Admin"** — a proper name, not a placeholder. If your database was created by an older seed (which used a placeholder like `Test`), re-running `npm run migrate` automatically corrects the name to `Super Admin`. In production the password comes **only** from the `SUPER_ADMIN_PASSWORD` env var — the migration **fails hard** if it is missing, and automatically rotates an existing super-admin password to the env value (healing databases seeded before this hardening). In dev/test a manually-changed password is never overwritten by re-runs.

> 🧹 **Production migrations also delete any pre-existing `*@demo.com` demo accounts** — so a database migrated before this security fix gets its known demo credentials purged on the next `npm run migrate`.

> 💡 **Tip:** Use the **"Quick Demo Login"** buttons on the login page for one-click access to the **Student** and **Instructor** demo accounts. Admin and Super Admin are intentionally **not** exposed as one-click demos — privileged accounts must always authenticate with their real password. Demo login (`POST /api/auth/demo`) is **disabled in production**.

#### 🌐 Platform-Wide Roles

| Role | Email | Password | Name |
|------|-------|----------|------|
| 👑 **Super Admin** | `superadmin@lms.com` | `superadmin` | Super Admin |

#### 🏛️ Department Admins (1 per department)

| Department | Email | Password | Dashboard |
|------------|-------|----------|-----------|
| 💻 **CSE** | `cse.admin@demo.com` | `demo123` | `/admin` |
| 📡 **ECE** | `ece.admin@demo.com` | `demo123` | `/admin` |
| ⚡ **EEE** | `eee.admin@demo.com` | `demo123` | `/admin` |
| ⚙️ **Mechanical** | `mech.admin@demo.com` | `demo123` | `/admin` |
| 🏗️ **Civil** | `civil.admin@demo.com` | `demo123` | `/admin` |

#### 👨‍🏫 Instructors (1 per department)

| Department | Email | Password | Name |
|------------|-------|----------|------|
| 💻 **CSE** | `cse.instructor@demo.com` | `demo123` | Dr. Arjun Patel |
| 📡 **ECE** | `ece.instructor@demo.com` | `demo123` | Prof. Meera Nair |
| ⚡ **EEE** | `eee.instructor@demo.com` | `demo123` | Dr. Vikram Singh |
| ⚙️ **Mechanical** | `mech.instructor@demo.com` | `demo123` | Prof. Anand Joshi |
| 🏗️ **Civil** | `civil.instructor@demo.com` | `demo123` | Dr. Sunita Rao |

#### 🎓 Students

| Department | Email | Password | Name | Roll No |
|------------|-------|----------|------|---------|
| 💻 **CSE** | `cse.student1@demo.com` | `demo123` | Riya Sharma | CS22001 |
| 💻 **CSE** | `cse.student2@demo.com` | `demo123` | Amit Verma | CS22002 |
| 📡 **ECE** | `ece.student1@demo.com` | `demo123` | Karthik Reddy | EC22001 |
| 📡 **ECE** | `ece.student2@demo.com` | `demo123` | Sneha Gupta | EC22002 |
| ⚡ **EEE** | `eee.student1@demo.com` | `demo123` | Priya Deshmukh | EE22001 |
| ⚙️ **Mechanical** | `mech.student1@demo.com` | `demo123` | Rohit Kadam | ME22001 |
| 🏗️ **Civil** | `civil.student1@demo.com` | `demo123` | Anjali Mehta | CE22001 |

### 🚀 Quick Start

```bash
# ── 1. Clone / Copy the project ────────────────────────────────
git clone <repo-url> lms
cd lms

# ── 2. Set up environment variables ────────────────────────────
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in **at minimum**: `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`, and `SUPER_ADMIN_PASSWORD` (required for production migrations).

### 🐳 Option A — Run with Docker (Easiest)

```bash
docker-compose up --build
# Open http://localhost
```

### 💻 Option B — Run Locally (Without Docker)

```bash
# Terminal 1: Backend
cd backend
npm install
npm run migrate
npm run dev        # http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## 🛣️ API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register (student/instructor) |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/demo` | Public | Demo login by role |
| GET | `/api/auth/me` | Auth | Current user profile |
| PUT | `/api/auth/profile` | Auth | Update profile |
| PUT | `/api/auth/change-password` | Auth | Change own password (self-service; admins blocked — managed by Super Admin) |
| POST | `/api/auth/reset-password/request` | Public | Request OTP |
| POST | `/api/auth/verify-otp` | Public | Verify OTP |
| POST | `/api/auth/reset-password` | Public | Reset password |

### Courses
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/courses` | Public | List published courses |
| GET | `/api/courses/:id` | Public | Course details |
| GET | `/api/courses/:id/lessons` | Public | Lessons + sections |
| GET | `/api/courses/instructor/:id` | Auth | Instructor's courses |
| POST | `/api/courses` | Instructor+ | Create course |
| PUT | `/api/courses/:id` | Instructor+ | Update course |
| DELETE | `/api/courses/:id` | Instructor+ | Delete course |
| PUT | `/api/courses/:id/approve` | Admin+ | Approve course |
| PUT | `/api/courses/:id/reject` | Admin+ | Reject course with reason (`{ reason, moveToDraft }`) |
| POST | `/api/courses/:id/sections` | Instructor+ | Add section |
| PUT | `/api/courses/sections/:id` | Instructor+ | Update section |
| DELETE | `/api/courses/sections/:id` | Instructor+ | Delete section |
| POST | `/api/courses/:id/lessons` | Instructor+ | Add lesson |
| PUT | `/api/courses/lessons/:id` | Instructor+ | Update lesson |
| DELETE | `/api/courses/lessons/:id` | Instructor+ | Delete lesson |

### Quizzes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/quizzes/course/:id` | Auth | Course quizzes |
| GET | `/api/quizzes/:id` | Auth | Quiz details |
| POST | `/api/quizzes/:id/start` | Student | Start attempt (returns randomized questions) |
| POST | `/api/quizzes/:id/attempt` | Student | Submit answers (grades automatically) |
| GET | `/api/quizzes/attempts/:id` | Student | Attempt history |
| POST | `/api/quizzes` | Instructor+ | Create quiz with questions |

### Notifications & Announcements
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Auth | Get user notifications |
| PUT | `/api/notifications/read-all` | Auth | Mark all read |
| PUT | `/api/notifications/:id/read` | Auth | Mark one read |
| DELETE | `/api/notifications/clear-all` | Auth | Clear all notifications |
| GET | `/api/announcements` | Auth | Department announcements |
| POST | `/api/announcements` | Admin+ | Create announcement (creates notifications) |
| POST | `/api/announcements/:id/mark-read` | Auth | Mark announcement read |
| GET | `/api/announcements/:id/reads` | Admin+ | View read receipts |

### Users (Admin+)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin+ | List users (filtered by role/dept) |
| PUT | `/api/users/:id/role` | Admin+ | Change user role |
| PUT | `/api/users/:id/toggle-status` | Admin+ | Suspend/activate |
| PUT | `/api/users/:id/reset-password` | Admin+ | Force password reset — `{ force: true }` marks the account to change password on next login (temp password generated & returned) |
| DELETE | `/api/users/:id` | Admin+ | Delete user |
| POST | `/api/users/instructors` | Admin+ | Create instructor |
| POST | `/api/users/instructors/import` | Admin+ | Bulk import instructors |
| POST | `/api/users/students/import` | Admin+ | Bulk import students |
| POST | `/api/users/invite-admin` | SuperAdmin | Create admin |
| PUT | `/api/users/:id/departments` | SuperAdmin | Assign admin to departments |
| GET | `/api/users/:id/departments` | SuperAdmin | Get admin's departments |
| GET | `/api/users/:id/permissions` | SuperAdmin | Effective permissions + overrides for a user |
| PUT | `/api/users/:id/permissions` | SuperAdmin | Grant/revoke individual permissions (`{ permissions: { "grade.update": true } }`) |
| GET | `/api/users/instructors/template` | Admin+ | Download instructor import template |
| GET | `/api/users/students/template` | Admin+ | Download student import template |
| POST | `/api/users/instructor-request` | Student | Apply to be instructor |
| GET | `/api/users/instructor-requests` | Admin+ | View applications |
| PUT | `/api/users/instructor-requests/:id/approve` | Admin+ | Approve/reject |

### Stats & Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/stats/platform` | Admin+ | Platform analytics |
| GET | `/api/stats/instructor/:id` | Auth | Instructor analytics |
| GET | `/api/stats/public` | Public | Public platform stats |
| GET | GET | `/api/stats/departments` | SuperAdmin | Department comparison |
| GET | `/api/stats/admins` | Admin+ | Per-department usage vs limits (scoped for dept admins) |
| GET | `/api/stats/system-health` | SuperAdmin | System monitoring |
| GET | `/api/stats/audit-logs` | Admin+ | Audit trail (scoped) — filters: `action`, `resource`, `search`, `from`, `to`, `limit`, `offset`; rows include `oldValue`, `newValue`, `device`, `ip` |
| GET | `/api/stats/audit-logs/actions` | Admin+ | Distinct audit actions + counts (filter UI) |
| GET | `/api/stats/settings` | SuperAdmin | Platform settings |
| PUT | `/api/stats/settings` | SuperAdmin | Update settings |
| GET | `/api/stats/ai-report` | SuperAdmin | AI insights report |
| GET | `/api/stats/students/progress` | Admin+ | Student progress data |

### Full API reference includes endpoints for: Enrollments, Discussions, Ratings, Categories, Departments, Certificates, Uploads, Wishlist, Assignments, Attendance, and Content Versioning.

---

## 🔧 Environment Variables

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | NeonDB PostgreSQL connection string | [neon.tech](https://console.neon.tech) |
| `JWT_SECRET` | Long random secret for JWT signing | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | [cloudinary.com](https://console.cloudinary.com) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Same |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Same |
| `RESEND_API_KEY` | Resend email API key | [resend.com](https://resend.com) |
| `RESEND_FROM_EMAIL` | Sender email (optional) | Configured sender |
| `SUPER_ADMIN_PASSWORD` | Super admin password — **required in production** (migration refuses to seed a default) | Generate a strong one |

---

## 📁 Key Scripts

```bash
# Backend
npm run dev          # Start with hot reload (nodemon)
npm start            # Start production server
npm run migrate      # Run DB migrations (seeds default data + demo accounts)
npm test             # Run API flow tests
npm run test:unit    # Run unit tests (quiz, users, courses-limits, seed, permissions, audit — 91 tests)
node tests/e2e_department_isolation.js   # Department isolation E2E (23 checks)
node tests/e2e_assessment_flow.js        # Assessment create → take → report flow
node tests/e2e_quiz_notif.js             # Quiz + notification flow

# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## 🧹 Maintenance & Cleanup

### One-off Schema Cleanup

A maintenance script is available to remove leftover subscription/pricing schema from databases created before the subscription feature was removed:

```bash
# Preview (dry-run)
node scripts/maintenance/drop-subscription-schema.js

# Execute
node scripts/maintenance/drop-subscription-schema.js --apply
```

This safely drops: `subscription_plans`, `subscription_plan_courses` tables; `courses.price`, `courses.discount_price`, `courses.required_plan`, `users.subscription_plan`, `users.subscription_expiry`, `users.earnings` columns; and the `subscription_plan` enum type.

### Other Maintenance Scripts

```bash
npm run maintenance         # List available maintenance scripts
```

Additional scripts in `scripts/maintenance/` handle schema patches, OTP management, and system settings.

---

## ✅ Verified Flows

The following end-to-end flows have been verified via automated API testing:

### Quiz Builder Flow
- ✅ Instructor can create quizzes with MCQ_SINGLE, MCQ_MULTI, FILL_BLANK questions
- ✅ Quiz questions are serialized **without** correct answers for students
- ✅ Students can start a quiz attempt (randomized question set)
- ✅ Students can submit answers → immediate auto-grading with score
- ✅ Multiple attempts per day are rate-limited (5 per 24 hours)
- ✅ Unit tests (5/5) cover: option normalization, rejection, student serialization, multi-select grading, answer matching

### Notification Flow
- ✅ Admin can create department announcements targeting specific roles
- ✅ Super Admin can target **admins only** (all departments or a specific department filter) — students/instructors never see them
- ✅ Students receive real-time notification on announcement creation
- ✅ Students can view, read, and mark notifications as read
- ✅ Admin can view read receipts per announcement

### Department Limits
- ✅ Super Admin sets per-department student/course limits (with platform-wide defaults)
- ✅ Course approval blocked with `409` when the department course limit is reached
- ✅ Student signups & imports blocked when the department student limit is reached
- ✅ Department admins + all super admins receive a notification when a limit is reached (24h deduped)
- ✅ Admin dashboard shows live capacity progress bars and over-limit warnings

### Bulk Import Integrity
- ✅ Email uniqueness is enforced globally — a student in ECE cannot be imported into CSE (duplicate email rejected)
- ✅ Roll number uniqueness is scoped per department — same roll number in different departments is allowed (different students)
- ✅ Dept capacity limits checked before bulk insert — import fails fast with clear error when limit reached
- ✅ Preview mode validates all rows without writing — UI shows exactly what will be created/rejected
- ✅ Roll number constraint violations fall back to per-row inserts so one bad row doesn't sink the entire import

### Assessment Flow
- ✅ Instructor creates assessment with max-attempt limit & question selection mode (ALL / RANDOM / BY_DIFFICULTY / BY_CATEGORY)
- ✅ Enrolled students are notified and can take the exam from the **Write Exam** tab
- ✅ Concurrent-start race is prevented (advisory lock) so attempts can never exceed the cap
- ✅ Instructor sees rankings, per-category breakdown charts, CSV export, and per-student answer reports

### Authentication & Authorization
- ✅ All 4 roles (Student, Instructor, Admin, Super Admin) login successfully
- ✅ JWT token validation, password reset with OTP
- ✅ Role-based access control on all API routes
- ✅ Demo login exposes Student/Instructor only (rate-limited, disabled in production); no demo credentials are seeded in production

### Admin Password Management
- ✅ Students & instructors change their own password via the profile Security tab; **admins are blocked** from self-service and email-OTP reset (their passwords are managed by the Super Admin)
- ✅ Super Admins reset any user's password (temp password generated and returned once); dept-scoped admins reset only their dept's students & instructors
- ✅ **Force password change on next login** (`force: true`) — the account is flagged `must_change_password`, the user sees a banner and lands on the profile Security tab until they set a new password
- ✅ Admins can always open their own user-detail page (self is exempt from department isolation)

### Granular Permissions (Role-Based Permission System)
- ✅ Every protected route is gated by a permission (`student.create`, `course.approve`, `assignment.submit`, `audit.view`, …) — never bare role strings alone
- ✅ Permission matrix per role (`backend/src/utils/permissions.js`) mirrors the spec: Super Admin holds all; dept Admin gets `student.*`, `instructor.*`, `course.approve/update/delete`, `user.role.change`, `audit.view`; Instructor gets `course.create/update`, `assignment.create`, `quiz.create`, `grade.update`; Student gets `course.view/enroll`, `assignment.submit`, `quiz.attempt`
- ✅ Super Admin can **grant/revoke individual permissions per user** from `/super-admin/permissions` (overrides stored in `user_permissions`, audit-logged); overrides take precedence over the role default, and Super Admin can never be locked out
- ✅ Auth responses ship the user's effective permission list; the frontend gates UI with `useAuth().can('course.approve')`

### Audit Trail
- ✅ Every sensitive action logs **WHO** (actor + role), **WHAT**, **WHEN**, **WHICH record**, **OLD → NEW values** (e.g. Active → Inactive on suspend), and **IP + parsed device** (browser/OS from the User-Agent)
- ✅ Audit Logs page: filters by action/record/date/search, pagination, CSV export — Super Admin sees all, dept admins see their department's entries only

### Authorization Hardening
- ✅ Assignments, attendance/live sessions, course mutations, and course-version endpoints enforce instructor ownership or admin department scope
- ✅ Course-version snapshots (which embed quiz answers) are readable by course editors and enrolled students only
- ✅ Quiz answer keys are never serialized to non-editors

### Course Management
- ✅ CRUD operations for courses, sections, lessons
- ✅ Course lifecycle: DRAFT → PENDING → PUBLISHED / REJECTED
- ✅ Course rejection with structured reason modal (textarea + "Move to Draft" toggle) — replaces old `window.prompt()` with proper UI in both Admin and Super Admin dashboards
- ✅ Department-scoped course visibility for admins

### UI Dashboards
- ✅ All 4 dashboards render in-browser with zero console errors
- ✅ Stat cards, charts, navigation work correctly
- ✅ CourseDetailPage: rating distribution bar chart, expanded instructor card, lesson preview modal
- ✅ HomePage: typewriter hero, animated stats, category marquee, testimonials section, production footer

---

## 📄 License

This project is licensed under the **ISC License**.