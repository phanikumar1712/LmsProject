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
  - [Who Can Import What](#who-can-import-what)
  - [Supported Formats](#supported-formats)
  - [Import Limits](#import-limits)
- [✨ Features](#-features)
- [🚀 Getting Started](#-getting-started)
- [🛣️ API Endpoints](#-api-endpoints)
- [🔧 Environment Variables](#-environment-variables)
- [📁 Key Scripts](#-key-scripts)

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
| Spreadsheet Parsing | xlsx 0.18 |
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
│   │   ├── utils/            # Helpers (email, quiz, pagination, formatters)
│   │   └── index.js          # Express app entry point
│   ├── tests/
│   ├── scripts/
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── frontend/                 # React 19 + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/            # All page components by role
│   │   │   ├── dashboard/
│   │   │   │   ├── student/     # Student dashboards
│   │   │   │   ├── instructor/  # Instructor dashboards
│   │   │   │   ├── admin/       # Admin dashboards
│   │   │   │   └── superadmin/  # Super Admin dashboards
│   │   ├── components/       # Reusable UI (DataTable, Charts, Layout)
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

### Permission Matrix

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
| List users | ❌ | ❌ | ✅ Dept students+instructors | ✅ All roles |
| Change user role | ❌ | ❌ | ❌ (was: limited) | ✅ Any role |
| Create Instructor | ❌ | ❌ | ✅ Dept | ✅ Any dept |
| Import Instructors (CSV) | ❌ | ❌ | ✅ Dept | ✅ Any dept |
| Import Students (CSV) | ❌ | ❌ | ✅ Dept | ✅ Any dept |
| Suspend/Activate user | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user |
| Reset user password | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user |
| Delete user | ❌ | ❌ | ✅ Dept non-admin | ✅ Any user |
| Create Admin | ❌ | ❌ | ❌ | ✅ |
| Create Super Admin | ❌ | ❌ | ❌ | ✅ Only |
| Manage admin departments | ❌ | ❌ | ❌ | ✅ |
| Set admin quotas | ❌ | ❌ | ❌ | ✅ |
| Force logout user | ❌ | ❌ | ❌ | ✅ |
| Bulk export users (CSV) | ❌ | ❌ | ✅ Dept | ✅ All |

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

#### 💳 Subscriptions & Billing
| Action | Student | Instructor | Admin | Super Admin |
|--------|---------|------------|-------|-------------|
| View plans | ✅ | ✅ | ✅ | ✅ |
| Subscribe to plan | ✅ | ✅ | ❌ | ❌ |
| Create/Edit/Delete plans | ❌ | ❌ | ❌ | ✅ |
| Assign plan to user | ❌ | ❌ | ❌ | ✅ |
| View invoices | ✅ Own | ✅ Own | ❌ | ✅ All |
| Handle refunds | ❌ | ❌ | ❌ | ✅ |

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
| View own audit trail | ❌ | ❌ | ❌ | ❌ |
| View department logs | ❌ | ❌ | ✅ (Scoped) | ✅ |
| View platform-wide logs | ❌ | ❌ | ❌ | ✅ |
| Export audit logs (CSV) | ❌ | ❌ | ❌ | ✅ |
| Filter by user/action/date | ❌ | ❌ | ❌ | ✅ |

#### 📢 Announcements
| Action | Student | Instructor | Admin (Dept) | Super Admin |
|--------|---------|------------|--------------|-------------|
| View announcements | ✅ Own dept | ✅ Own dept | ✅ Own dept | ✅ All |
| Create announcement | ❌ | ❌ | ✅ Dept only | ✅ Platform-wide |
| Delete announcement | ❌ | ❌ | ✅ Own | ✅ Any |

#### ⚙️ Platform Settings
| Action | Student | Instructor | Admin | Super Admin |
|--------|---------|------------|-------|-------------|
| View settings | ❌ | ❌ | ❌ | ✅ |
| Update branding | ❌ | ❌ | ❌ | ✅ |
| Configure email/SMTP | ❌ | ❌ | ❌ | ✅ |
| Payment gateway config | ❌ | ❌ | ❌ | ✅ |
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

---

### Department Scoping

Admins are **department-scoped**. When an Admin is assigned to a department:

| What Admin Sees | Scope Rule |
|----------------|------------|
| Users | Only STUDENT and INSTRUCTOR roles within their department |
| Courses | Only courses whose **category** belongs to their department |
| Categories | Only categories tagged with their department |
| Announcements | Only announcements created for their department |
| Analytics | Only enrollments/revenue/ratings from their department's courses |
| Audit Logs | Only actions performed by users in their department |
| Bulk Import | New users are automatically assigned to their department |

> **Super Admin** sees everything platform-wide with no department restriction.

---

## 🎯 Role Flows & Interactions

### 1. Student Flow

```
                       ┌──────────────────┐
                       │   Landing Page    │
                       │   / (HomePage)    │
                       └────────┬─────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Register/Login     │
                    │  /register  /login     │
                    └───────────┬───────────┘
                                │
                       ┌────────┴────────┐
                       │  Student Dashboard │
                       │   /student        │
                       └────────┬─────────┘
                                │
            ┌───────────────────┼────────────────────┐
            │                   │                    │
            ▼                   ▼                    ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Browse Courses │  │  My Courses  │  │     Profile      │
    │   /courses     │  │ /student/    │  │   /profile       │
    │                │  │   courses    │  └──────────────────┘
    └───────┬───────┘  └──────┬───────┘
            │                 │
            ▼                 ▼
    ┌───────────────┐  ┌──────────────┐
    │ Course Detail │  │ Course Player│
    │ /courses/:id  │  │  /courses/   │
    │               │  │  :id/learn   │
    └───────┬───────┘  └──────┬───────┘
            │                 │
            ▼                 ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Enroll + Rate │  │ Watch Videos │  │ Take Quizzes     │
    │ (anti-cheat:  │  │ + Track      │  │ (fullscreen,     │
    │  fullscreen)  │  │   Progress   │  │  tab-switch,     │
    └───────────────┘  └──────────────┘  │  daily limits)   │
                                         └──────────────────┘
```

**Student interactions with other roles:**
- **→ Instructor**: Can view instructor profile, follow/unfollow, rate their courses, submit reviews
- **→ Admin**: Cannot interact directly. Admin manages students (suspend, reset password, bulk import)
- **→ Super Admin**: No direct interaction. Super Admin can suspend/delete or force-reset student accounts

---

### 2. Instructor Flow

```
                       ┌──────────────────┐
                       │    Login/Register  │
                       └────────┬─────────┘
                                │
                       ┌────────┴────────┐
                       │  Instructor      │
                       │   Dashboard      │
                       │   /instructor    │
                       └────────┬─────────┘
                                │
            ┌───────────────────┼────────────────────┐
            │                   │                    │
            ▼                   ▼                    ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ My Courses    │  │ Create Course│  │    Analytics     │
    │ /instructor/  │  │ /instructor/ │  │  /instructor/    │
    │   courses     │  │ create-course│  │    analytics     │
    └───────┬───────┘  └──────┬───────┘  └──────────────────┘
            │                 │
            ▼                 ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Edit Course   │  │ Add Sections │  │ View Students    │
    │ Sections/     │  │ + Lessons    │  │ /instructor/     │
    │ Lessons       │  │ + Quizzes    │  │   students       │
    └───────┬───────┘  └──────┬───────┘  └──────────────────┘
            │                 │
            ▼                 ▼
    ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Submit for    │  │ Quiz Builder │  │ Review Ratings   │
    │ Admin Approval│  │ (Import      │  │ & Reply          │
    │ → PENDING     │  │  Questions   │  │ /instructor/     │
    │               │  │  from CSV)   │  │   reviews        │
    └───────────────┘  └──────────────┘  └──────────────────┘
```

**Course Lifecycle (Instructor → Admin):**

```
  ┌──────────┐     Submit      ┌──────────┐   Approve    ┌───────────┐
  │  DRAFT   │ ──────────────► │ PENDING  │ ────────────► │ PUBLISHED │
  │ Instructor│                │   Admin  │               │           │
  │ edits     │ ◄──────────────│ reviews  │               │  Live on  │
  └──────────┘  Send back      └──────────┘   Reject      │  platform │
        ▲        + note                    ┌───────────┐  └───────────┘
        │                                  │ REJECTED  │
        └──────────────────────────────────│           │
              Instructor revises &         └───────────┘
              resubmits
```

**Instructor interactions with other roles:**
- **→ Student**: Reply to course reviews, view enrolled students, track student progress
- **→ Admin**: Submit courses for approval, receive review notes when sent back to draft
- **→ Super Admin**: No direct interaction. Super Admin can override course status

---

### 3. Admin Flow (Department-Scoped)

```
                       ┌──────────────────┐
                       │    Login/Register  │
                       └────────┬─────────┘
                                │
                       ┌────────┴────────┐
                       │  Admin Dashboard  │
                       │    /admin         │
                       │  Dept-scoped data │
                       └────────┬─────────┘
                                │
         ┌──────────────────────┼──────────────────────────┐
         │                      │                          │
         ▼                      ▼                          ▼
 ┌───────────────┐    ┌──────────────────┐    ┌──────────────────────┐
 │ Manage Users  │    │  Manage Courses  │    │    Categories        │
 │ /admin/users  │    │  /admin/courses  │    │  /admin/categories   │
 ├───────────────┤    ├──────────────────┤    ├──────────────────────┤
 │ • View dept   │    │ • View dept      │    │ • Create/Edit/Delete │
 │   students &  │    │   courses        │    │ • Bulk Import (CSV)  │
 │   instructors │    │ • Approve/Reject │    └──────────────────────┘
 │ • Change roles│    │ • Send to Draft  │
 │   (no Admin)  │    │ • Edit/Delete    │         ┌──────────────────┐
 │ • Suspend/    │    │   (dept courses) │         │  Announcements   │
 │   Activate    │    └──────────────────┘         │  /admin/         │
 │ • Reset pwd   │                                 │  announcements   │
 │ • Bulk Import │         ┌──────────────────┐    │  (dept only)     │
 │   (CSV/Excel) │         │  Student Progress│    └──────────────────┘
 └───────────────┘         │  /admin/student- │
                           │     progress     │    ┌──────────────────┐
         ┌───────────────┐ ├──────────────────┤    │   Reports        │
         │ Bulk Enroll   │ │ • View progress  │    │  /admin/reports  │
         │ /admin/bulk-  │ │ • Track          │    │  (dept-scoped)   │
         │   enroll      │ │   completions    │    └──────────────────┘
         └───────────────┘ └──────────────────┘
```

**Admin interactions with other roles:**
- **→ Student**: Create/manage student accounts, bulk import, suspend, reset passwords, track progress
- **→ Instructor**: Approve/reject course submissions, send back to draft with notes, create instructor accounts
- **→ Super Admin**: Super Admin manages the admin's department assignment and access level

---

### 4. Super Admin Flow (Platform-Wide)

```
                       ┌──────────────────┐
                       │    Login/Register  │
                       └────────┬─────────┘
                                │
                       ┌────────┴────────┐
                       │  Super Admin     │
                       │   Dashboard      │
                       │   /super-admin   │
                       └────────┬─────────┘
                                │
         ┌──────────────────────┼──────────────────────────────┐
         │                      │                              │
         ▼                      ▼                              ▼
 ┌──────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
 │  Departments     │ │   Manage Admins    │ │  Platform Analytics  │
 │  /super-admin/   │ │  /super-admin/     │ │  /super-admin/       │
 │  departments     │ │    admins          │ │    analytics         │
 ├──────────────────┤ ├────────────────────┤ ├──────────────────────┤
 │ • Create/Edit/   │ │ • Create Admin     │ │ • Revenue trends     │
 │   Delete dept    │ │ • Assign depts     │ │ • User growth        │
 │ • View overview  │ │ • Set quotas       │ │ • Course engagement  │
 │ • Dept analytics │ │   (max students,   │ │ • AI reports         │
 └──────────────────┘ │    max courses)    │ │ • Export CSV/PDF     │
                      │ • Remove access    │ └──────────────────────┘
         ┌──────────────────┐ └────────────────────┘
         │  Platform         │
         │  Settings         │  ┌──────────────────┐  ┌──────────────────┐
         │  /super-admin/    │  │  Audit Logs      │  │  System Health   │
         │    settings       │  │  /super-admin/   │  │  /super-admin/   │
         ├──────────────────┤  │    audit-logs    │  │    system        │
         │ • Branding       │  ├──────────────────┤  ├──────────────────┤
         │ • Email/SMTP     │  │ • View all admin │  │ • Server uptime  │
         │ • Payment config │  │   actions        │  │ • DB status      │
         │ • SSO/Login      │  │ • Filter by user │  │ • Memory usage   │
         │ • Terms/Policies │  │ • Filter by date │  │ • Service health │
         │ • 2FA enforcement│  │ • Export CSV     │  └──────────────────┘
         └──────────────────┘  └──────────────────┘

         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
         │  Subscription    │  │  User Management │  │ Course Oversight │
         │  Plans           │  │  /admin/users    │  │  /admin/courses  │
         │  /admin/         │  ├──────────────────┤  ├──────────────────┤
         │  subscriptions   │  │ • Full access to │  │ • View ALL       │
         ├──────────────────┤  │   all roles      │  │   courses across │
         │ • Create/Edit/   │  │ • Promote to     │  │   departments    │
         │   Delete plans   │  │   Admin/SA       │  │ • Force-edit any │
         │ • View invoices  │  │ • Bulk import    │  │ • Force-delete   │
         │ • Handle refunds │  │   (any dept)     │  │ • Override status│
         └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Super Admin interactions with other roles:**
- **→ Student**: Full account management, bulk import/export, force password reset
- **→ Instructor**: Override course decisions, force-edit/delete, manage requests
- **→ Admin**: Create/demote, assign departments, set quotas, monitor via audit logs

---

## 📥 Bulk Import System

The platform supports **CSV and Excel (XLSX)** bulk imports with **case-insensitive headers**. Maximum **500 rows per import**, maximum **5 imports per 5 minutes**.

### Who Can Import What

| Import Type | Admin (Dept-Scoped) | Super Admin |
|-------------|---------------------|-------------|
| **Instructors** | ✅ Into own department | ✅ Into any department or global |
| **Students** | ✅ Into own department (roll_no required) | ✅ Into any department |
| **Categories** | ✅ Into own department | ✅ Platform-wide |
| **Quiz Questions** | ❌ (Instructor only) | ✅ (Any course) |

### Instructor Import

| Column | Required | Description |
|--------|----------|-------------|
| `name` | ✅ | Full name |
| `email` | ✅ | Must be unique |
| `phone` | ❌ | Phone number |

```csv
name,email,phone
Dr. Arjun Patel,arjun@example.com,9876543210
Prof. Meera Nair,meera@example.com,
```

**Admin**: New instructors are assigned to the admin's department.
**Super Admin**: Can optionally specify a `departmentId` in the request.

### Student Import

| Column | Required | Description |
|--------|----------|-------------|
| `name` | ✅ | Full name |
| `email` | ✅ | Must be unique |
| `roll_no` | ✅ | Must be unique per department (e.g., CS22001) |
| `phone` | ❌ | Phone number |

```csv
name,email,roll_no,phone
Riya Sharma,riya@example.com,CS22001,9876543210
Amit Verma,amit@example.com,CS22002,
```

### Category Import

| Column | Required | Description |
|--------|----------|-------------|
| `name` | ✅ | Category name (must be unique) |
| `icon` | ❌ | Emoji icon (defaults to 📚) |

```csv
name,icon
Web Development,💻
Data Science,📊
Marketing,📈
```

### Quiz Question Import (Instructors)

In the **Quiz Builder**, click the upload icon on any quiz to import questions.

| Column | Required | Description |
|--------|----------|-------------|
| `question` | ✅ | The question text |
| `type` | ❌ | `single` / `multi` / `fill` / `truefalse` (default: `single`) |
| `option1`–`option10` | ✅ | Answer options (≥2 for MCQ) |
| `correct` | ✅ | Correct answer: `A`, `A,C` (multi), or exact text (fill) |
| `difficulty` | ❌ | `easy` / `medium` / `hard` (default: `medium`) |

---

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based login, registration, and password reset
- OTP verification via Resend email API
- Role-based access control: **Student**, **Instructor**, **Admin**, **Super Admin**
- Department-scoped admin isolation
- Rate limiting: 10 login attempts/hour, 5 imports/5 minutes
- Constant-time OTP comparison (timing attack prevention)

### 👩‍🏫 Instructor Portal
- Create & manage courses with sections and lessons
- Quiz builder with CSV/Excel question import
- Anti-cheat quiz system: fullscreen enforcement, tab-switch detection, daily attempt limits
- View enrolled students and progress
- Analytics dashboard (revenue, enrollments, ratings)
- Respond to course reviews

### 🎓 Student Dashboard
- Browse and enroll in courses
- Video player with lesson tracking and progress bar
- Anti-cheat quiz system
- Wishlist management
- Certificates on course completion
- Learning streaks (current + longest)
- Subscription management (FREE/BASIC/PRO/ENTERPRISE)

### 🛡️ Admin Dashboard (Department-Scoped)
- User management: view, create, suspend, reset passwords for dept students & instructors
- Bulk import instructors and students from CSV/Excel
- Course moderation: approve, reject, send back to draft with notes
- Course content editing: edit sections, lessons, quizzes within dept courses
- Category management with bulk import
- Department-level analytics (enrollments, revenue, ratings)
- Announcements (department-scoped)
- Student progress tracking
- Bulk enrollment
- Assignments & submissions management
- Academic calendar / timetable
- Review moderation
- Reports export (CSV)

### 👑 Super Admin (Platform-Wide)
- **Department Management**: Create, edit, delete departments
- **Admin Management**: Create admins, assign departments, set per-admin quotas
- **User Management**: Full access to all roles, promote to Admin/Super Admin, bulk import into any department
- **Course Oversight**: View all courses across all departments, force-edit or delete any course, override instructor/admin decisions
- **Platform Settings**: Branding (logo, colors, platform name), email/SMTP config, payment gateway integration, SSO/login config, terms & policies
- **Subscription & Billing**: Manage pricing plans, view invoices, handle refunds
- **Analytics & Reports**: Platform-wide analytics, AI-powered reports, CSV export
- **Audit Logs**: View every action by every user, filter by user/action/date, CSV export (DPDP Act compliance)
- **System Health**: Server/uptime monitoring, DB status, memory usage, service health dashboard
- **Announcements**: Broadcast to all users or specific roles platform-wide
- **Force Logout**: Terminate any user session
- **2FA Enforcement**: Enable/require two-factor authentication platform-wide
- **Academic Sessions**: Create/edit/delete academic sessions per department

### 📹 Media & Content
- Cloudinary integration for video/image uploads
- Profile photo uploads with auto-cropping
- Course thumbnails and lesson content files
- Support for video, document, quiz, and text lesson types

### 🛡️ Security & Hardening
- Rate limiting on auth endpoints (10 attempts/hour) and import endpoints (5/5 min)
- Max row cap (500 rows) on all bulk imports
- Frontend timeout (120s) with cancel support on imports
- PostgreSQL error sanitization (no raw DB errors exposed to clients)
- Helmet security headers
- CORS protection with configurable origins
- Request timeout (30s) to prevent connection pool exhaustion
- Audit logging for all sensitive actions
- Password hashing with bcrypt (12 rounds)

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

---

### 👑 Demo Accounts

After running the database migration, the following demo accounts are created automatically.
**All non-SuperAdmin accounts use password: `demo123`**

> ℹ️ **Tip:** You can also use the **"Demo Login"** button on the login page — just select your role and click, no password needed!

#### 🌐 Platform-Wide Roles

| Role | Email | Password | Name |
|------|-------|----------|------|
| 👑 **Super Admin** | `superadmin@lms.com` | `superadmin` | Super Admin |

> **Super Admin** has full platform access — manage departments, admins, settings, audit logs, system health, subscriptions, and all user roles.

---

#### 🏛️ Department Admins (1 per department)

| Department | Email | Password | Name | Dashboard |
|------------|-------|----------|------|-----------|
| 💻 **CSE** | `cse.admin@demo.com` | `demo123` | CSE Admin | `/admin` |
| 📡 **ECE** | `ece.admin@demo.com` | `demo123` | ECE Admin | `/admin` |
| ⚡ **EEE** | `eee.admin@demo.com` | `demo123` | EEE Admin | `/admin` |
| ⚙️ **Mechanical** | `mech.admin@demo.com` | `demo123` | Mech Admin | `/admin` |
| 🏗️ **Civil** | `civil.admin@demo.com` | `demo123` | Civil Admin | `/admin` |

> Each admin is **department-scoped** — they only see users, courses, categories, and analytics within their own department.

---

#### 👨‍🏫 Instructors (1 per department)

| Department | Email | Password | Name |
|------------|-------|----------|------|
| 💻 **CSE** | `cse.instructor@demo.com` | `demo123` | Dr. Arjun Patel |
| 📡 **ECE** | `ece.instructor@demo.com` | `demo123` | Prof. Meera Nair |
| ⚡ **EEE** | `eee.instructor@demo.com` | `demo123` | Dr. Vikram Singh |
| ⚙️ **Mechanical** | `mech.instructor@demo.com` | `demo123` | Prof. Anand Joshi |
| 🏗️ **Civil** | `civil.instructor@demo.com` | `demo123` | Dr. Sunita Rao |

> Instructors can create courses, add sections/lessons/quizzes, view analytics, and submit courses for admin approval.

---

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

> Students can browse & enroll in courses, take quizzes, earn certificates, manage wishlists, and track their learning streaks.

---

### 🚀 Quick Start — Run on Your Friend's Laptop

Here's how to get the app running on any laptop (Mac / Linux / Windows with WSL):

```bash
# ── 1. Clone / Copy the project ────────────────────────────────
git clone <repo-url> lms
cd lms

# ── 2. Set up environment variables ────────────────────────────
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in **at minimum** these values:

| Variable | How to Get It |
|----------|---------------|
| `DATABASE_URL` | Sign up at [neon.tech](https://neon.tech) → Create project → Copy connection string (use the `psql` one with `?sslmode=require`) |
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CLOUDINARY_CLOUD_NAME` | Sign up at [cloudinary.com](https://cloudinary.com) → Dashboard |
| `CLOUDINARY_API_KEY` | Same page as above |
| `CLOUDINARY_API_SECRET` | Same page as above |
| `RESEND_API_KEY` | Sign up at [resend.com](https://resend.com) → Create API key (format: `re_...`) |

---

### 🐳 Option A — Run with Docker (Easiest)

> Requires Docker Desktop installed. Get it from [docker.com](https://www.docker.com/products/docker-desktop/).

```bash
# Start everything with one command
docker-compose up --build

# Open in browser
# http://localhost
```

The database migration runs automatically on first startup. Wait 20-30 seconds for the backend health check to pass.

**Useful Docker commands:**
```bash
docker-compose up --build -d      # Run in background
docker-compose logs -f backend    # Watch backend logs
docker-compose logs -f frontend   # Watch frontend logs
docker-compose down               # Stop everything
docker-compose up --build --profile dev  # Start with hot-reload frontend
```

---

### 💻 Option B — Run Locally (Without Docker)

#### Step 1: Backend Setup
```bash
cd backend
npm install
npm run migrate    # Creates tables + seeds demo accounts
npm run dev        # Start dev server at http://localhost:5000
```

#### Step 2: Frontend Setup (New Terminal)
```bash
cd frontend
npm install
npm run dev        # Start dev server at http://localhost:5173
```

#### Step 3: Open in Browser
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api/health

> The Vite dev server at `:5173` proxies `/api/*` requests to `:5000` automatically — no CORS issues.

---

### 🤝 Sharing Your Local Server with a Friend

If your friend is on the **same Wi-Fi network**, they can access your laptop:

**1. Find your local IP address:**
```bash
# Mac / Linux
ip addr show | grep 'inet ' | awk '{print $2}'
# or
ifconfig | grep 'inet '

# Windows (cmd)
ipconfig
```

**2. Update `backend/.env`:**
```env
FRONTEND_URL=http://<your-local-ip>:5173
```

**3. Start both servers.**

**4. Friend opens:** `http://<your-local-ip>:5173` in their browser

> 🚨 **Firewall note:** Make sure ports 5173 (frontend) and 5000 (backend) are open on your firewall.
>
> Mac: `System Settings → Network → Firewall`
>
> Windows: `Windows Defender Firewall → Allow an app through firewall`
>
> Linux: `sudo ufw allow 5173 && sudo ufw allow 5000`

---

### 🗄️ Database Migration (Manual)

If running without Docker, always run migration first:

```bash
cd backend
npm run migrate
```

This creates all tables, indexes, default categories, academic departments, subscription plans, platform settings, and seeds all demo accounts.

---

### 🔄 Dev Profile (Hot Reload Frontend)

```bash
docker-compose --profile dev up --build
```

This runs the frontend with Vite's hot module replacement at `http://localhost:5173` (changes reflect instantly). The API still proxies through Nginx on port 80.

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
| PUT | `/api/auth/change-password` | Auth | Change password |
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
| PUT | `/api/courses/:id/reject` | Admin+ | Reject course |
| POST | `/api/courses/:id/sections` | Instructor+ | Add section |
| PUT | `/api/courses/sections/:id` | Instructor+ | Update section |
| DELETE | `/api/courses/sections/:id` | Instructor+ | Delete section |
| POST | `/api/courses/:id/lessons` | Instructor+ | Add lesson |
| PUT | `/api/courses/lessons/:id` | Instructor+ | Update lesson |
| DELETE | `/api/courses/lessons/:id` | Instructor+ | Delete lesson |

### Enrollments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/enrollments/student/:id` | Student | User's enrollments |
| POST | `/api/enrollments` | Student | Enroll in course |
| PUT | `/api/enrollments/progress` | Student | Track lesson progress |
| POST | `/api/enrollments/bulk` | Admin+ | Bulk enroll students |
| GET | `/api/enrollments/stats/:id` | Instructor+ | Enrollment stats |

### Quizzes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/quizzes/course/:id` | Auth | Course quizzes |
| GET | `/api/quizzes/:id` | Auth | Quiz details |
| POST | `/api/quizzes/:id/start` | Student | Start attempt |
| POST | `/api/quizzes/:id/attempt` | Student | Submit answers |
| GET | `/api/quizzes/attempts/:id` | Student | Attempt history |
| POST | `/api/quizzes` | Instructor+ | Create quiz |

### Users (Admin+)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin+ | List users (filtered by role/dept) |
| PUT | `/api/users/:id/role` | Admin+ | Change user role |
| PUT | `/api/users/:id/toggle-status` | Admin+ | Suspend/activate |
| PUT | `/api/users/:id/reset-password` | Admin+ | Force password reset |
| PUT | `/api/users/:id/subscription` | SuperAdmin | Assign subscription plan |
| PUT | `/api/users/:id/limits` | SuperAdmin | Set admin quotas |
| DELETE | `/api/users/:id` | Admin+ | Delete user |
| POST | `/api/users/instructors` | Admin+ | Create instructor |
| POST | `/api/users/instructors/import` | Admin+ | Bulk import instructors |
| POST | `/api/users/students/import` | Admin+ | Bulk import students |
| POST | `/api/users/invite-admin` | SuperAdmin | Create admin |
| PUT | `/api/users/:id/departments` | SuperAdmin | Set admin departments |
| POST | `/api/users/instructor-request` | Student | Apply to be instructor |
| GET | `/api/users/instructor-requests` | Admin+ | View applications |
| PUT | `/api/users/instructor-requests/:id/approve` | Admin+ | Approve/reject |

### Stats & Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/stats/public` | Public | Public platform stats |
| GET | `/api/stats/platform` | Admin+ | Platform analytics |
| GET | `/api/stats/departments` | SuperAdmin | Department comparison |
| GET | `/api/stats/admins` | SuperAdmin | Per-admin overview |
| GET | `/api/stats/system-health` | SuperAdmin | System monitoring |
| GET | `/api/stats/audit-logs` | Admin+ | Audit trail (scoped) |
| GET | `/api/stats/settings` | SuperAdmin | Platform settings |
| PUT | `/api/stats/settings` | SuperAdmin | Update settings |
| GET | `/api/stats/ai-report` | SuperAdmin | AI insights report |
| GET | `/api/stats/students/progress` | Admin+ | Student progress data |

### Departments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/departments/public` | Public | Signup branch picker |
| GET | `/api/departments` | Admin+ | List (scoped for admin) |
| POST | `/api/departments` | SuperAdmin | Create department |
| PUT | `/api/departments/:id` | SuperAdmin | Update department |
| DELETE | `/api/departments/:id` | SuperAdmin | Delete department |

### Subscriptions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/subscriptions/plans` | Public | List plans |
| POST | `/api/subscriptions/plans` | SuperAdmin | Create plan |
| PUT | `/api/subscriptions/plans/:id` | SuperAdmin | Update plan |
| DELETE | `/api/subscriptions/plans/:id` | SuperAdmin | Delete plan |
| POST | `/api/subscriptions/upgrade` | Student | Upgrade subscription |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/upload` | Instructor+ | Upload media file |
| POST | `/api/upload/profile-photo` | Auth | Upload avatar |
| GET | `/api/notifications` | Auth | Get notifications |
| PUT | `/api/notifications/read-all` | Auth | Mark all read |
| GET | `/api/wishlist` | Auth | Get wishlist |
| POST | `/api/wishlist/toggle` | Auth | Toggle wishlist |
| GET | `/api/announcements` | Auth | Department announcements |
| POST | `/api/announcements` | Admin+ | Create announcement |
| POST | `/api/stats/categories` | Admin+ | Create category |
| POST | `/api/stats/categories/import` | Admin+ | Bulk import categories |
| GET | `/api/health` | Public | Health check |

---

## 🔧 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `PORT` | Backend port (default: `5000`) | — |
| `NODE_ENV` | `development` or `production` | — |
| `DATABASE_URL` | NeonDB PostgreSQL connection string | [console.neon.tech](https://console.neon.tech) |
| `JWT_SECRET` | Long random secret for JWT signing | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) | — |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` (local) / `http://localhost` (Docker) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | [console.cloudinary.com](https://console.cloudinary.com/settings) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | [console.cloudinary.com](https://console.cloudinary.com/settings) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | [console.cloudinary.com](https://console.cloudinary.com/settings) |
| `RESEND_API_KEY` | Resend email API key | [resend.com](https://resend.com/) |
| `RESEND_FROM_EMAIL` | Sender email address | [resend.com](https://resend.com/) |

---

## 📁 Key Scripts

```bash
# Backend
npm run dev          # Start with hot reload (nodemon)
npm start            # Start production server
npm run migrate      # Run DB migrations (seeds default data + demo accounts)
npm test             # Run API tests
npm run test:unit    # Run unit tests

# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

---

## 📄 License

This project is licensed under the **ISC License**.
