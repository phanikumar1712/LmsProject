# Admin → Bulk Enrollment

Sample files for testing the admin **Bulk Enrollment** flow
(upload → preview → confirm) at `http://localhost:5173/admin/enrollments`.

All rows reference **real** records from the dev database (CSE department):
course **JAVA PROGRAMMING** and real CSE student roll numbers / emails, so the
preview resolves and validates them like production data.

## Files

| File | Purpose |
|---|---|
| `enrollment_valid.xlsx` | All rows valid for the CSE admin. Rows reference the course by title, by lowercase title, and by UUID; students by roll number and by email. Some rows may preview as "Already enrolled" — that's expected dedup behavior. |
| `enrollment_valid.csv` | Same content as above, as a CSV. |
| `enrollment_with_errors.xlsx` | Mixed file that demonstrates the per-row validation: valid rows + **unknown course**, **cross-department (ECE) student**, and **missing student identifier** rows. |

## Accepted columns (case-insensitive)

- `Course` — course id (UUID) or title (exact, case-insensitive)
- `Student ID` — student roll number (aliases: `Roll No`, `Roll`)
- `Email` — student email

Each row needs a course **and** (student id **or** email). Log in as the
**CSE Admin** (`cse.admin@demo.com` / `demo123`) to preview these files — the
server rejects cross-department rows with `Different department`.
