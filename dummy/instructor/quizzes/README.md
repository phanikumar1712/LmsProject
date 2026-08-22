# Instructor → Quizzes (dummy data)

Two ways to use these files:

## 1. Question bank (import in the Quiz Builder)

- `question-bank.xlsx` / `question-bank.csv` — open **Instructor → Quizzes**
  (`/instructor/quiz-builder`) and use the **Import** button. Columns:
  `question`, `type` (single|multi|fill|truefalse), `option1..option4`,
  `correct` ("A", "A,C", or exact text for fill), `difficulty` (easy|medium|hard),
  `category`.

## 2. Full quiz payloads (POST /api/quizzes as the course instructor)

Each JSON is a ready-to-send `createQuiz` body (attach `courseId` → the
E2E Lesson Types Test Course, owned by `cse.instructor@demo.com`):

| File | What it demonstrates |
|---|---|
| `quiz-basic.json` | Every question type (MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE, FILL_BLANK, SHORT_ANSWER) + negative marking |
| `quiz-random.json` | A big bank with `selectionConfig: { mode: 'RANDOM', count: 5 }` |
| `quiz-by-difficulty.json` | `{ mode: 'BY_DIFFICULTY', easy: 2, medium: 2, hard: 1 }` |
| `quiz-exam-mid.json` | `examKind: 'mid'`, one attempt, availability window (`startDate`/`endDate`) |

Example:
```bash
curl -X POST http://localhost:5000/api/quizzes \
  -H "Authorization: Bearer \$TOKEN" -H "Content-Type: application/json" \
  -d @dummy/instructor/quizzes/quiz-basic.json
```
