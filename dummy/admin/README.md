# Admin Dummy Data (bulk imports)

Sample files for every admin bulk-import flow. Each folder has a **valid** file
that imports cleanly and a **with_errors** file that demonstrates the per-row
validation. Files are verified against the real preview endpoints.

| Folder | Flow (endpoint) | Columns |
|---|---|---|
| `enrollments/` | Bulk enrollment (`/api/enrollments/import/preview`) | `Course`, `Student ID`, `Email` |
| `students/` | Bulk student import (`/api/users/students/preview`) | `name`, `email`, `roll_no`, `phone`, `year`, `semester`, `department` |
| `instructors/` | Bulk instructor import (`/api/users/instructors/preview`) | `name`, `email`, `phone`, `department` |
| `courses/` | Bulk course import (`/api/courses/import/preview`) | `title`, `instructor`, `department`, `category`, `level`, `duration`, `description` |
| `categories/` | Bulk category import (`/api/stats/categories/import`) | `name`, `icon` |

## Notes

- **Login**: use **CSE Admin** (`cse.admin@demo.com` / `demo123`) for
  enrollments, students, instructors, categories. Department-scoped admins are
  locked to their own department (error files include a cross-department row to
  prove it).
- **Course import** additionally requires the `course.create` permission, which
  department admins don't have by default — preview course files with the
  **Super Admin** account (`superadmin@lms.com` / `superadmin`) or grant the
  admin the permission from Super Admin → Permissions.
- All valid rows use **new, unique** dummy values (`dummy.*@demo.com`,
  `DMY*` rolls/titles) so they don't collide with existing records.
