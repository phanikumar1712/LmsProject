# 📚 LMS – Learning Management System

A full-stack Learning Management System (LMS) built with **Node.js + Express** (backend) and **React + Vite** (frontend), powered by **NeonDB (PostgreSQL)** and served via **Nginx** in production.

---

## 🗂️ Project Structure

```
LmsProject/
├── backend/          # Node.js + Express REST API
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── routes/        # API route definitions
│   │   ├── middleware/     # Auth, error handling
│   │   ├── db/            # DB pool & migrations
│   │   ├── utils/         # Helpers (email, upload, etc.)
│   │   └── index.js       # App entry point
│   ├── Dockerfile
│   ├── .env.example       # ← Copy this to .env and fill in values
│   └── package.json
├── frontend/         # React 19 + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/         # All page components
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities & constants
│   ├── Dockerfile
│   ├── nginx.conf         # Nginx config (production)
│   └── package.json
└── docker-compose.yml     # Orchestrates both services
```

---

## ✨ Features

- 🔐 **JWT Authentication** — Login, Register, OTP verification (via Resend)
- 👩‍🏫 **Instructor Portal** — Create & manage courses, lessons, quizzes
- 🎓 **Student Dashboard** — Enroll in courses, track progress, streaks
- 🛡️ **Admin Dashboard** — Manage users, moderate content
- 👑 **Super Admin** — Platform-wide stats, subscription plans, system health
- 📹 **Media Uploads** — Cloudinary integration for thumbnails & lesson files
- ⭐ **Course Ratings & Reviews**
- 🧪 **Anti-Cheat Quiz System** — Fullscreen enforcement, tab-switch detection
- 🌙 **Dark Mode** support
- 🐳 **Docker-ready** with Nginx reverse proxy

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | v20+ |
| [npm](https://www.npmjs.com/) | v9+ |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest (for Docker method) |

> ⚠️ **This is a Node.js project. Do NOT use `mvn`, `java`, or any Java/Spring Boot commands.**

---

## 🐳 Method 1 — Run with Docker (Recommended)

This is the easiest way. Docker handles everything — no manual installs needed.

### Step 1 — Set up the environment file

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your credentials (see [Environment Variables](#-environment-variables) below).

### Step 2 — Start the application

```bash
docker-compose up --build
```

### Step 3 — Open in browser

```
http://localhost
```

### Useful Docker Commands

```bash
# Run in background (detached mode)
docker-compose up --build -d

# View live logs
docker-compose logs -f

# Stop all containers
docker-compose down

# Rebuild a single service
docker-compose up --build backend
docker-compose up --build frontend
```

---

## 💻 Method 2 — Run Locally (Without Docker)

### Step 1 — Set up the environment file

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your credentials
```

### Step 2 — Start the Backend

```bash
cd backend
npm install
npm run dev        # Development (hot reload via nodemon)
# OR
npm start          # Production
```

Backend runs at → `http://localhost:5000`

### Step 3 — Start the Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at → `http://localhost:5173`

---

## 🔧 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `PORT` | Backend port (default: `5000`) | — |
| `NODE_ENV` | `development` or `production` | — |
| `DATABASE_URL` | NeonDB PostgreSQL connection string | [console.neon.tech](https://console.neon.tech) |
| `JWT_SECRET` | Long random secret for JWT signing | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) | — |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` (local) / `http://localhost` (Docker) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | [console.cloudinary.com](https://console.cloudinary.com/settings) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | [console.cloudinary.com](https://console.cloudinary.com/settings) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | [console.cloudinary.com](https://console.cloudinary.com/settings) |
| `RESEND_API_KEY` | Resend email API key | [resend.com](https://resend.com/) |
| `RESEND_FROM_EMAIL` | Sender email address | [resend.com](https://resend.com/) |

---

## 🗄️ Database Setup

The project uses **NeonDB** (serverless PostgreSQL). Run migrations to initialize the schema:

```bash
cd backend
npm run migrate
```

---

## 🛣️ API Endpoints Overview

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/*` | Register, Login, OTP, Forgot Password |
| `GET/POST /api/courses/*` | Course CRUD, search, filter |
| `POST /api/enrollments/*` | Enroll, track progress |
| `GET/POST /api/quizzes/*` | Quiz creation & submission |
| `GET/POST /api/ratings/*` | Course ratings & reviews |
| `GET /api/stats/*` | Dashboard analytics |
| `GET/POST /api/subscriptions/*` | Subscription plans |
| `POST /api/upload/*` | File/thumbnail uploads (Cloudinary) |
| `GET /api/users/*` | User profile management |
| `GET /api/notifications/*` | In-app notifications |
| `GET /api/health` | Health check endpoint |

---

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js 5
- **Database**: NeonDB (PostgreSQL via `pg` driver)
- **Auth**: JWT (`jsonwebtoken`) + bcrypt
- **Email**: Resend API
- **File Uploads**: Cloudinary + Multer
- **Security**: Helmet, express-rate-limit, express-validator

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 8
- **Routing**: React Router DOM 7
- **Styling**: TailwindCSS 4
- **Animations**: Framer Motion
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Toasts**: React Hot Toast

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (production)
- **Process Manager**: dumb-init

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `student` | Browse courses, enroll, take quizzes, rate courses |
| `instructor` | Create/manage courses, lessons, quizzes |
| `admin` | Moderate content, manage users |
| `superadmin` | Full platform control, system metrics |

---

## 📁 Key Scripts

```bash
# Backend
npm run dev        # Start with hot reload (nodemon)
npm start          # Start production server
npm run migrate    # Run DB migrations
npm test           # Run API tests

# Frontend
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**.






Findings

Unpublished and paid lesson content is publicly exposed
courses.js (line 9) exposes GET /api/courses/:id and GET /api/courses/:id/lessons without auth, and coursesController.js (line 86) / line 99 (line 99) do not check status, enrollment, preview, or subscription plan. Anyone with a course id can fetch draft/rejected course metadata and all lesson content_urls.

Any instructor can modify any course’s sections/lessons
Routes authorize the role only at courses.js (line 16), but createSection, updateSection, deleteSection, createLesson, updateLesson, and deleteLesson never verify the course belongs to req.user. See coursesController.js (line 275) and line 286 (line 286). A logged-in instructor can edit another instructor’s curriculum by id.

Progress can be faked with arbitrary lesson ids
enrollmentsController.js (line 69) accepts { courseId, lessonId }, checks only enrollment, then pushes lessonId into completed_lessons. It never validates that the lesson exists or belongs to that course. A student can mark unrelated UUIDs complete and reach 100%.

Instructor stats leak student data across instructors
enrollments.js (line 9) lets any INSTRUCTOR call /stats/:instructorId, and enrollmentsController.js (line 114) does not require req.user.id === instructorId unless admin. One instructor can view another instructor’s students, names, emails, and progress.

Quiz attempts are readable by any authenticated user
quizzes.js (line 7) only requires authentication for /attempts/:studentId, and quizzesController.js (line 114) does no owner/admin check. Any logged-in user can fetch another student’s quiz history.

Quiz creation upsert will fail at runtime
quizzesController.js (line 49) uses ON CONFLICT (lesson_id), but the migration defines lesson_id without a unique constraint at migrate.js (line 124). PostgreSQL will reject this with “no unique or exclusion constraint matching the ON CONFLICT specification.”

Section/lesson update SQL references missing columns
coursesController.js (line 289) and line 335 (line 335) set updated_at, but sections and lessons only define created_at in migrate.js (line 97) and line 108 (line 108). Updating sections/lessons will fail.

Duplicate enrollment likely returns a raw 500
enrollmentsController.js (line 48) inserts directly into a table with UNIQUE(student_id, course_id) but does not pre-check or handle conflict. Re-enrolling in the same course should return a clean 409, not a database error.