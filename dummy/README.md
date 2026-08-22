# Dummy Data (organized by role)

Sample data for testing each role's flows. Import files reference **real**
dev-database records (course titles, instructor emails, category names) so
previews resolve and validate like production data. Each folder has a `valid`
file and a `with_errors` file for the per-row validation UI.

```
dummy/
├── README.md
├── admin/                        # Admin bulk-import flows
│   ├── README.md
│   ├── enrollments/              # bulk enrollment import (valid + errors + CSV)
│   ├── students/                 # bulk student import
│   ├── instructors/              # bulk instructor import
│   ├── courses/                  # bulk course import (Super Admin permission)
│   └── categories/               # bulk category import
├── instructor/
│   └── course-builder-sample/    # sample-course.json — every lesson type for the Course Builder
└── student/
    └── assignment-submissions/   # sample files for the submit-assignment upload flow
```

See `admin/README.md` for the import matrix (files, endpoints, columns, and
which login to use). Run the admin flows at **Admin → Bulk Import** or the
dedicated pages (`/admin/enrollments`, `/admin/students`, …); instructors test
the builder at `/instructor/create-course`; students test submissions from
their dashboard.
