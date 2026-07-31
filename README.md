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
| List users | ❌ | ❌ | ✅ Dept students+instructors | ✅ All roles |
| Change user role | ❌ | ❌ | ❌ | ✅ Any role |
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
| Export audit logs (CSV) | ❌ | ❌ | ❌ | ✅ |
| Filter by user/action/date | ❌ | ❌ | ❌ | ✅ |

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

### 3. Admin Flow (Department-Scoped)

Admins **manage users**, **moderate courses** (approve/reject/send back to draft), **bulk import** students & instructors via CSV/Excel, **create announcements**, **track student progress**, and generate **reports** — all scoped to their department.

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
- Demo login for all roles
- Role-based access control: **Student**, **Instructor**, **Admin**, **Super Admin**
- Department-scoped admin isolation
- Rate limiting: 10 login attempts/hour, 5 imports/5 minutes
- Constant-time OTP comparison (timing attack prevention)

### 👩‍🏫 Instructor Portal
- Create & manage courses with sections and lessons
- **Quiz builder** with CSV/Excel question import, random selection modes (ALL / RANDOM / BY_DIFFICULTY / BY_CATEGORY)
- **Anti-cheat quiz system**: fullscreen enforcement, tab-switch detection, daily attempt limits, developer-tools blocking
- View enrolled students and progress
- Analytics dashboard (enrollments, ratings)
- Respond to course reviews

### 🎓 Student Dashboard
- Browse and enroll in courses (all **completely free**)
- Video player with lesson tracking and progress bar
- **Anti-cheat quiz system** (fullscreen mode, 3 violations = auto-submit)
- Wishlist management
- **Certificates** on course completion
- **Learning streaks** (current + longest)
- **Discussion forums** per course/lesson

### 🛡️ Admin Dashboard (Department-Scoped)
- User management: view, create, suspend, reset passwords for dept students & instructors
- **Bulk import** instructors and students from CSV/Excel
- **Course moderation**: approve, reject, send back to draft with notes
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
- **Department Management**: Create, edit, delete departments
- **Admin Management**: Create admins, assign departments, set per-admin quotas
- **User Management**: Full access to all roles, promote to Admin/Super Admin, bulk import into any department
- **Course Oversight**: View all courses across all departments, force-edit or delete any course, override instructor/admin decisions
- **Platform Settings**: Branding (logo, colors, platform name), email/SMTP config, SSO/login config, terms & policies
- **Analytics & Reports**: Platform-wide analytics, **AI-powered reports**, CSV export
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

### 👑 Demo Accounts

After running the database migration, the following demo accounts are created automatically.
**All non-SuperAdmin accounts use password: `demo123`**

> 💡 **Tip:** You can also use the **"Demo Login"** button on the login page — just select your role and click, no password needed!

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

Open `backend/.env` and fill in **at minimum**: `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`.

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
| PUT | `/api/users/:id/reset-password` | Admin+ | Force password reset |
| DELETE | `/api/users/:id` | Admin+ | Delete user |
| POST | `/api/users/instructors` | Admin+ | Create instructor |
| POST | `/api/users/instructors/import` | Admin+ | Bulk import instructors |
| POST | `/api/users/students/import` | Admin+ | Bulk import students |
| POST | `/api/users/invite-admin` | SuperAdmin | Create admin |
| POST | `/api/users/instructor-request` | Student | Apply to be instructor |
| GET | `/api/users/instructor-requests` | Admin+ | View applications |
| PUT | `/api/users/instructor-requests/:id/approve` | Admin+ | Approve/reject |

### Stats & Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/stats/platform` | Admin+ | Platform analytics |
| GET | `/api/stats/instructor/:id` | Auth | Instructor analytics |
| GET | `/api/stats/public` | Public | Public platform stats |
| GET | `/api/stats/departments` | SuperAdmin | Department comparison |
| GET | `/api/stats/admins` | SuperAdmin | Per-admin overview |
| GET | `/api/stats/system-health` | SuperAdmin | System monitoring |
| GET | `/api/stats/audit-logs` | Admin+ | Audit trail (scoped) |
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

---

## 📁 Key Scripts

```bash
# Backend
npm run dev          # Start with hot reload (nodemon)
npm start            # Start production server
npm run migrate      # Run DB migrations (seeds default data + demo accounts)
npm test             # Run API flow tests
npm run test:unit    # Run unit tests (5 quiz-utils tests)

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
- ✅ Students receive real-time notification on announcement creation
- ✅ Students can view, read, and mark notifications as read
- ✅ Admin can view read receipts per announcement

### Authentication & Authorization
- ✅ All 4 roles (Student, Instructor, Admin, Super Admin) login successfully
- ✅ JWT token validation, password reset with OTP
- ✅ Role-based access control on all API routes

### Course Management
- ✅ CRUD operations for courses, sections, lessons
- ✅ Course lifecycle: DRAFT → PENDING → PUBLISHED / REJECTED
- ✅ Department-scoped course visibility for admins

### UI Dashboards
- ✅ All 4 dashboards render in-browser with zero console errors
- ✅ Stat cards, charts, navigation work correctly

---

## 📄 License

This project is licensed under the **ISC License**.