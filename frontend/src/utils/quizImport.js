import * as XLSX from 'xlsx';

// Parses a CSV/Excel file of MCQs into the quiz-builder question format.
//
// Expected columns (case/space/underscore-insensitive):
//   question | text          — the question prompt (required)
//   type                     — single | multi | fill | truefalse (default: single)
//   option1..option10 / optiona..optionj / a..j — answer options
//   correct | answer         — correct option(s): "A", "2", "A,C", or the exact
//                              option/answer text (fill-in-the-blank)
//   difficulty | level       — easy | medium | hard (default: medium)
//   category                — question category/topic name (default: "Uncategorized")
//
// Returns { questions: [...], errors: ["Row 4: ..."], total }
export async function parseQuestionFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (!rows.length) return { questions: [], errors: ['The file has no data rows.'], total: 0 };

    // Normalize header names: lowercase, strip spaces/underscores
    const normKey = (k) => String(k).toLowerCase().replace(/[\s_-]/g, '');

    const TYPE_MAP = {
        single: 'MCQ_SINGLE', mcqsingle: 'MCQ_SINGLE', mcq: 'MCQ_SINGLE', singlechoice: 'MCQ_SINGLE',
        multi: 'MCQ_MULTI', mcqmulti: 'MCQ_MULTI', multiple: 'MCQ_MULTI', multiplechoice: 'MCQ_MULTI', multichoice: 'MCQ_MULTI',
        fill: 'FILL_BLANK', fillblank: 'FILL_BLANK', fillintheblank: 'FILL_BLANK', blank: 'FILL_BLANK', text: 'FILL_BLANK',
        truefalse: 'MCQ_SINGLE', tf: 'MCQ_SINGLE', boolean: 'MCQ_SINGLE',
    };
    const DIFF_MAP = { easy: 'EASY', e: 'EASY', medium: 'MEDIUM', med: 'MEDIUM', m: 'MEDIUM', hard: 'HARD', h: 'HARD', difficult: 'HARD' };

    const questions = [];
    const errors = [];

    rows.forEach((rawRow, rowIdx) => {
        const rowNum = rowIdx + 2; // 1-based + header row
        const row = {};
        Object.entries(rawRow).forEach(([k, v]) => { row[normKey(k)] = String(v).trim(); });

        const text = row.question || row.text || row.prompt || '';
        if (!text) {
            // skip fully empty rows silently, flag partially filled ones
            const hasAny = Object.values(row).some(v => v !== '');
            if (hasAny) errors.push(`Row ${rowNum}: missing question text — skipped.`);
            return;
        }

        const rawType = normKey(row.type || 'single');
        const isTrueFalse = ['truefalse', 'tf', 'boolean'].includes(rawType);
        const type = TYPE_MAP[rawType];
        if (!type) {
            errors.push(`Row ${rowNum}: unknown type "${row.type}" — skipped.`);
            return;
        }

        const category = row.category || '';

        const rawDiff = normKey(row.difficulty || row.level || 'medium');
        const difficulty = DIFF_MAP[rawDiff];
        if (!difficulty) {
            errors.push(`Row ${rowNum}: unknown difficulty "${row.difficulty || row.level}" — skipped.`);
            return;
        }

        // Collect options from option1/optiona/a... style columns, in order
        let options = [];
        if (isTrueFalse) {
            options = ['True', 'False'];
        } else if (type !== 'FILL_BLANK') {
            for (let i = 0; i < 10; i++) {
                const val = row[`option${i + 1}`] ?? row[`option${String.fromCharCode(97 + i)}`] ?? row[String.fromCharCode(97 + i)] ?? '';
                if (val !== '') options.push(val);
            }
            if (options.length < 2) {
                errors.push(`Row ${rowNum}: needs at least 2 options — skipped.`);
                return;
            }
            if (new Set(options.map(o => o.toLowerCase())).size !== options.length) {
                errors.push(`Row ${rowNum}: duplicate options — skipped.`);
                return;
            }
        }

        const correctRaw = row.correct || row.answer || row.correctanswer || '';
        if (!correctRaw) {
            errors.push(`Row ${rowNum}: missing correct answer — skipped.`);
            return;
        }

        let correctAnswers;
        if (type === 'FILL_BLANK') {
            correctAnswers = [correctRaw];
        } else {
            // Accept letters (A,C), 1-based numbers (1,3), or exact option text
            const tokens = type === 'MCQ_MULTI' ? correctRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [correctRaw.trim()];
            const indexes = [];
            for (const token of tokens) {
                let idx;
                if (/^[a-jA-J]$/.test(token)) idx = token.toLowerCase().charCodeAt(0) - 97;
                else if (/^([1-9]|10)$/.test(token)) idx = Number(token) - 1;
                else idx = options.findIndex(o => o.toLowerCase() === token.toLowerCase());
                if (idx < 0 || idx >= options.length) {
                    errors.push(`Row ${rowNum}: correct answer "${token}" doesn't match any option — skipped.`);
                    return;
                }
                if (!indexes.includes(idx)) indexes.push(idx);
            }
            correctAnswers = indexes;
        }

        questions.push({
            id: `q_imp_${Date.now()}_${rowIdx}_${Math.random().toString(36).slice(2, 6)}`,
            type,
            text,
            category,
            difficulty,
            options,
            correctAnswers,
        });
    });

    return { questions, errors, total: rows.length };
}

// Generates a downloadable template so instructors get the columns right.
export function downloadQuestionTemplate() {
    const rows = [
        { question: 'What does HTML stand for?', type: 'single', option1: 'HyperText Markup Language', option2: 'HighText Machine Language', option3: 'Hyperlink Text Mode Language', option4: '', correct: 'A', difficulty: 'easy' },
        { question: 'Which of these are JavaScript frameworks?', type: 'multi', option1: 'React', option2: 'Django', option3: 'Vue', option4: 'Flask', correct: 'A,C', difficulty: 'medium' },
        { question: 'CSS stands for Cascading Style ______', type: 'fill', option1: '', option2: '', option3: '', option4: '', correct: 'Sheets', difficulty: 'easy' },
        { question: 'The virtual DOM makes every re-render O(1)', type: 'truefalse', option1: '', option2: '', option3: '', option4: '', correct: 'False', difficulty: 'hard' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 45 }, { wch: 10 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'quiz_questions_template.xlsx');
}
