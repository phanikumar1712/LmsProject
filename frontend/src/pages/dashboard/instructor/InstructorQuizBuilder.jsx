import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, GripVertical, CheckCircle, ChevronDown, CheckSquare, Circle, Type, Layers, Upload, Shuffle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { coursesAPI, quizzesAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { parseQuestionFile, downloadQuestionTemplate } from '../../../utils/quizImport';

const QUESTION_TYPES = [
    { value: 'MCQ_SINGLE', label: 'Single Choice (Radio)', icon: Circle },
    { value: 'MCQ_MULTI', label: 'Multiple Choice (Checkbox)', icon: CheckSquare },
    { value: 'TRUE_FALSE', label: 'True / False', icon: Circle },
    { value: 'SHORT_ANSWER', label: 'Short Answer', icon: Type },
    { value: 'FILL_BLANK', label: 'Fill in the Blank', icon: Type }
];

const SELECTION_MODES = [
    { value: 'ALL', label: 'All Questions' },
    { value: 'RANDOM', label: 'Random (pick N)' },
    { value: 'BY_DIFFICULTY', label: 'By Difficulty' },
    { value: 'BY_CATEGORY', label: 'By Category' },
];

export default function InstructorQuizBuilder({ redirectTo = '/instructor/courses', onCreated }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    const [quizInfo, setQuizInfo] = useState({
        courseId: '', title: '', instructions: '', timeLimit: 30, passingScore: 80, maxAttempts: 0,
        negativeMarking: 0, startDate: '', endDate: '', examKind: 'QUIZ'
    });

    // Selection config for random question drawing
    const [selectionMode, setSelectionMode] = useState('ALL');
    const [selectionConfig, setSelectionConfig] = useState({
        count: 10,
        easy: 3, medium: 4, hard: 3,
        categories: {},
    });

    const [questions, setQuestions] = useState([
        // eslint-disable-next-line react-hooks/purity
        { id: `q${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: 'MCQ_SINGLE', text: '', category: '', options: ['', ''], correctAnswers: [0], difficulty: 'MEDIUM', isExpanded: true }
    ]);

    // Extract unique categories from all questions
    const categories = useMemo(() => {
        const cats = new Set();
        questions.forEach(q => { if (q.category?.trim()) cats.add(q.category.trim()); });
        return [...cats].sort();
    }, [questions]);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
                let data;
                if (isAdmin) {
                    data = await coursesAPI.getAll({ admin: true, limit: 500 });
                } else if (user.id) {
                    data = await coursesAPI.getByInstructor(user.id);
                } else {
                    data = [];
                }
                setCourses(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('[QuizBuilder] Failed to load courses:', err);
                toast.error('Failed to load courses: ' + err.message);
                setCourses([]);
            }
        };
        load();
    }, [user]);

    const handleInfoChange = (e) => {
        setQuizInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const addQuestion = (type, presetCategory = '') => {
        setQuestions([...questions, {
            // eslint-disable-next-line react-hooks/purity
            id: `q${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, text: '',
            category: presetCategory,
            options: type.includes('MCQ') ? ['', ''] : type === 'TRUE_FALSE' ? ['True', 'False'] : [],
            correctAnswers: type === 'MCQ_SINGLE' || type === 'TRUE_FALSE' ? [0]
                : (type === 'FILL_BLANK' || type === 'SHORT_ANSWER') ? [''] : [],
            difficulty: 'MEDIUM',
            isExpanded: true
        }]);
    };

    const updateQuestion = (qIdx, field, value) => {
        const newQs = [...questions];
        newQs[qIdx][field] = value;
        setQuestions(newQs);
    };

    const removeQuestion = (qIdx) => {
        setQuestions(questions.filter((_, i) => i !== qIdx));
    };

    // Options Handlers
    const addOption = (qIdx) => {
        const newQs = [...questions];
        newQs[qIdx].options.push('');
        setQuestions(newQs);
    };

    const updateOption = (qIdx, optIdx, val) => {
        const newQs = [...questions];
        newQs[qIdx].options[optIdx] = val;
        setQuestions(newQs);
    };

    const removeOption = (qIdx, optIdx) => {
        const newQs = [...questions];
        newQs[qIdx].options.splice(optIdx, 1);
        newQs[qIdx].correctAnswers = newQs[qIdx].correctAnswers.filter(i => i !== optIdx).map(i => i > optIdx ? i - 1 : i);
        setQuestions(newQs);
    };

    const toggleCorrectOption = (qIdx, optIdx) => {
        const newQs = [...questions];
        const q = newQs[qIdx];

        if (q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE') {
            q.correctAnswers = [optIdx];
        } else if (q.type === 'MCQ_MULTI') {
            if (q.correctAnswers.includes(optIdx)) {
                q.correctAnswers = q.correctAnswers.filter(o => o !== optIdx);
            } else {
                q.correctAnswers.push(optIdx);
            }
        }
        setQuestions(newQs);
    };

    // Category management
    const bulkSetCategory = (category) => {
        setQuestions(prev => prev.map(q => ({ ...q, category })));
    };

    const addQuestionsByCategory = (type, category) => {
        addQuestion(type, category);
    };

    // Import quiz questions from CSV/Excel
    const handleFileImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        try {
            const result = await parseQuestionFile(file);
            if (result.errors.length > 0) {
                toast.error(`${result.errors.length} row(s) had issues — imported ${result.questions.length} questions`);
                console.warn('Import errors:', result.errors);
            }
            if (result.questions.length === 0) {
                toast.error('No valid questions found in file');
                setImporting(false);
                return;
            }
            setQuestions(prev => [...prev, ...result.questions.map(q => ({
                ...q,
                category: q.category || '',
                difficulty: q.difficulty || 'MEDIUM',
                isExpanded: false,
            }))]);
            toast.success(`Imported ${result.questions.length} questions from ${file.name}`);
        } catch (err) {
            toast.error('Failed to parse file: ' + err.message);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const buildSelectionConfig = () => {
        if (selectionMode === 'ALL') return null;
        if (selectionMode === 'RANDOM') return { mode: 'RANDOM', count: selectionConfig.count };
        if (selectionMode === 'BY_DIFFICULTY') {
            return { mode: 'BY_DIFFICULTY', easy: selectionConfig.easy, medium: selectionConfig.medium, hard: selectionConfig.hard };
        }
        if (selectionMode === 'BY_CATEGORY') {
            // Build categories object from config, only include categories with count > 0
            const cats = {};
            Object.entries(selectionConfig.categories).forEach(([cat, count]) => {
                if (count > 0) cats[cat] = count;
            });
            if (Object.keys(cats).length === 0) return null;
            return { mode: 'BY_CATEGORY', categories: cats };
        }
        return null;
    };

    const handleSave = async () => {
        if (!quizInfo.courseId || !quizInfo.title) {
            toast.error('Please assign a course and quiz title!');
            return;
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) { toast.error(`Question ${i + 1} is missing text.`); return; }
            const isOptionType = q.type.includes('MCQ') || q.type === 'TRUE_FALSE';
            if (isOptionType && q.options.some(o => !o.trim())) { toast.error(`Question ${i + 1} has empty options.`); return; }
            if (isOptionType && q.correctAnswers.length === 0) { toast.error(`Question ${i + 1} has no correct answer selected.`); return; }
            if ((q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') && (!q.correctAnswers[0] || !q.correctAnswers[0].trim())) { toast.error(`Question ${i + 1} requires a valid ${q.type === 'SHORT_ANSWER' ? 'answer' : 'blank answer'}.`); return; }
        }

        setSaving(true);
        try {
            const created = await quizzesAPI.createQuiz({
                courseId: quizInfo.courseId,
                title: quizInfo.title,
                instructions: quizInfo.instructions,
                examKind: quizInfo.examKind,
                timeLimit: parseInt(quizInfo.timeLimit),
                passingScore: parseInt(quizInfo.passingScore),
                maxAttempts: parseInt(quizInfo.maxAttempts) || 0,
                negativeMarking: parseFloat(quizInfo.negativeMarking) || 0,
                startDate: quizInfo.startDate ? new Date(quizInfo.startDate).toISOString() : null,
                endDate: quizInfo.endDate ? new Date(quizInfo.endDate).toISOString() : null,
                selectionConfig: buildSelectionConfig(),
                questions: questions.map(q => ({
                    id: q.id,
                    type: q.type,
                    text: q.text,
                    category: q.category?.trim() || '',
                    difficulty: q.difficulty || 'MEDIUM',
                    options: q.options,
                    correctAnswer: (q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE') ? String(q.options[q.correctAnswers[0]])
                        : q.type === 'MCQ_MULTI' ? q.correctAnswers.map(idx => String(q.options[idx]))
                            : (q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') ? String(q.correctAnswers[0])
                                : null
                }))
            });
            toast.success('Assessment created and students notified!');
            if (onCreated) onCreated(created);
            else navigate(redirectTo);
        } catch (err) {
            toast.error('Failed to create quiz: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTemplateDownload = () => {
        downloadQuestionTemplate();
        toast.success('Template downloaded!');
    };

    const InputClass = "w-full bg-card border border-border text-foreground placeholder:text-muted-foreground/60 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow text-[15px]";

    // Count questions per category for display
    const catCounts = useMemo(() => {
        const counts = {};
        questions.forEach(q => {
            const cat = q.category?.trim() || 'Uncategorized';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [questions]);

    // For BY_DIFFICULTY mode, count questions per difficulty
    const diffCounts = useMemo(() => {
        const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
        questions.forEach(q => {
            const d = q.difficulty || 'MEDIUM';
            counts[d] = (counts[d] || 0) + 1;
        });
        return counts;
    }, [questions]);

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div>
                <h1 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">Quiz Builder</h1>
                <p className="text-muted-foreground font-medium">Create powerful assessments with categories, random selection, and anti-cheat enforcements.</p>
            </div>

            <div className="bg-card border border-border shadow-sm rounded-2xl p-8 space-y-5">
                <h2 className="text-xl font-bold text-foreground border-b border-border pb-3">Quiz Details</h2>
                <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Target Course</label>
                        <select name="courseId" value={quizInfo.courseId} onChange={handleInfoChange} className={InputClass}>
                            <option value="">Select Course</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Quiz Title</label>
                        <input type="text" name="title" value={quizInfo.title} onChange={handleInfoChange} className={InputClass} placeholder="e.g. React Fundamentals Exam" />
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Assessment Type</label>
                        <select name="examKind" value={quizInfo.examKind} onChange={handleInfoChange} className={InputClass}>
                            <option value="QUIZ">Quiz (counts toward quiz grade)</option>
                            <option value="mid">Mid Exam (20% of final grade)</option>
                            <option value="final">Final Exam (40% of final grade)</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">Mid/Final exams feed the weighted grade breakdown on the student grades page.</p>
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Time Limit (mins)</label>
                        <input type="number" name="timeLimit" value={quizInfo.timeLimit} onChange={handleInfoChange} className={InputClass} min="1" />
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Passing Score (%)</label>
                        <input type="number" name="passingScore" value={quizInfo.passingScore} onChange={handleInfoChange} className={InputClass} min="1" max="100" />
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Max Attempts</label>
                        <input
                            type="number"
                            name="maxAttempts"
                            value={quizInfo.maxAttempts}
                            onChange={handleInfoChange}
                            className={InputClass}
                            min="0"
                            max="100"
                            placeholder="0 = unlimited"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">
                            Limit how many times each student can take this exam. <span className="font-bold text-indigo-600">0</span> means unlimited.
                            <span className="block mt-0.5 text-muted-foreground/80">Note: unlimited quizzes still respect a safety net of <span className="font-semibold">5 attempts per 24 hours</span> per student.</span>
                        </p>
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Negative Marking</label>
                        <input
                            type="number"
                            name="negativeMarking"
                            value={quizInfo.negativeMarking}
                            onChange={handleInfoChange}
                            className={InputClass}
                            min="0"
                            max="1"
                            step="0.25"
                            placeholder="0 = none"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">
                            Fraction of one question's marks deducted for a wrong answer. <span className="font-bold text-indigo-600">0.25</span> = a wrong answer costs a quarter of the question. Scores never go below 0.
                        </p>
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Availability Window</label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="datetime-local" name="startDate" value={quizInfo.startDate} onChange={handleInfoChange} className={InputClass} />
                            <input type="datetime-local" name="endDate" value={quizInfo.endDate} onChange={handleInfoChange} className={InputClass} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">
                            Leave both empty for always-on. Students can only start the assessment between these times.
                        </p>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Instructions</label>
                        <textarea name="instructions" value={quizInfo.instructions} onChange={handleInfoChange} className={`${InputClass} min-h-[100px] resize-y`} placeholder="Specific instructions for taking this exam..." />
                    </div>
                </div>
            </div>

            {/* Question Selection Mode */}
            <div className="bg-card border border-border shadow-sm rounded-2xl p-8 space-y-5">
                <h2 className="text-xl font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                    <Shuffle size={18} className="text-indigo-500" />
                    Question Selection Mode
                </h2>
                <p className="text-sm text-muted-foreground font-medium">
                    Choose how questions are picked when a student starts the quiz.
                        You have <strong className="text-foreground">{questions.length}</strong> questions in the bank.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {SELECTION_MODES.map(mode => {
                            const isActive = selectionMode === mode.value;
                            return (
                                <button
                                    key={mode.value}
                                    onClick={() => setSelectionMode(mode.value)}
                                    className={`px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                                        isActive
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                                            : 'border-border bg-card text-muted-foreground hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                                >
                                    {mode.label}
                                </button>
                            );
                        })}
                    </div>

                    {selectionMode === 'RANDOM' && (
                        <div className="bg-muted/30 border border-border rounded-xl p-5">
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                                Number of random questions per attempt
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={questions.length}
                                value={selectionConfig.count}
                                onChange={e => setSelectionConfig(prev => ({ ...prev, count: Math.min(Number(e.target.value), questions.length) }))}
                                className={InputClass}
                            />
                            <p className="text-xs text-muted-foreground mt-2 font-medium">Each student will get {Math.min(selectionConfig.count, questions.length)} random questions from your bank of {questions.length}.</p>
                        </div>
                    )}

                    {selectionMode === 'BY_DIFFICULTY' && (
                        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available: {Object.entries(diffCounts).map(([d, c]) => `${d}: ${c}`).join(' | ')}</p>
                            <div className="grid grid-cols-3 gap-4">
                                {['easy', 'medium', 'hard'].map(level => (
                                    <div key={level}>
                                        <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5 capitalize">{level}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={diffCounts[level.toUpperCase()]}
                                            value={selectionConfig[level]}
                                            onChange={e => setSelectionConfig(prev => ({ ...prev, [level]: Math.min(Number(e.target.value), diffCounts[level.toUpperCase()]) }))}
                                            className={InputClass}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectionMode === 'BY_CATEGORY' && (
                        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
                            {categories.length === 0 ? (
                                <p className="text-sm text-muted-foreground font-medium text-center py-4">
                                    No categories yet. Assign categories to your questions below, then configure how many to pick from each.
                                </p>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pick N questions from each category:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {categories.map(cat => (
                                            <div key={cat} className="flex items-center gap-3">
                                                <label className="text-sm font-bold text-foreground flex-1 capitalize">{cat} <span className="text-xs text-muted-foreground font-medium">({catCounts[cat] || 0} available)</span></label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={catCounts[cat] || 0}
                                                    value={selectionConfig.categories[cat] || 0}
                                                    onChange={e => {
                                                        const val = Math.min(Number(e.target.value), catCounts[cat] || 0);
                                                        setSelectionConfig(prev => ({
                                                            ...prev,
                                                            categories: { ...prev.categories, [cat]: val }
                                                        }));
                                                    }}
                                                    className="w-20 px-3 py-2 bg-card border border-border rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {selectionMode !== 'ALL' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
                                <Shuffle size={14} />
                                Each student will receive a different randomized subset of questions from your question bank.
                            </p>
                        </div>
                    )}
                </div>

                {/* Import Section */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8 space-y-4">
                    <h2 className="text-xl font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                        <Upload size={18} className="text-indigo-500" />
                        Import Questions
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        <label className={`px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-[13px] font-bold text-indigo-700 flex items-center gap-2 cursor-pointer transition-colors ${importing ? 'opacity-60' : ''}`}>
                            <Upload size={16} />
                            {importing ? 'Importing...' : 'Upload CSV / Excel'}
                            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileImport} className="hidden" disabled={importing} />
                        </label>
                        <button onClick={handleTemplateDownload} className="px-4 py-2.5 bg-card border border-border hover:bg-muted/40 rounded-xl text-[13px] font-bold text-foreground/80 flex items-center gap-2 transition-colors">
                            <Plus size={16} /> Download Template
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                        Supports CSV or Excel files. Include a <strong>category</strong> column to organize questions by topic.
                    </p>
                </div>

                {/* Question Categories Summary */}
                {categories.length > 0 && (
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                            <Layers size={16} className="text-indigo-500" />
                            Question Categories
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <span key={cat} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-indigo-100">
                                    <Layers size={12} />
                                    {cat}
                                    <span className="bg-indigo-200 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full">{catCounts[cat]}</span>
                                </span>
                            ))}
                        </div>
                        <button
                            onClick={() => bulkSetCategory('')}
                            className="text-xs text-muted-foreground hover:text-rose-500 font-medium mt-3 transition-colors"
                        >
                            Clear all categories
                        </button>
                    </div>
                )}

                {/* Questions */}
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-foreground">
                            Questions <span className="text-muted-foreground text-base font-medium ml-2">({questions.length})</span>
                        </h2>
                    </div>
                    {questions.map((q, qIdx) => {
                        const QIcon = QUESTION_TYPES.find(t => t.value === q.type)?.icon || Type;
                        return (
                            <div key={q.id} className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden transition-all">
                                <div className="bg-muted/40 border-b border-border p-4 flex items-center gap-3">
                                    <GripVertical size={18} className="text-muted-foreground/60 cursor-move" />
                                    <span className="bg-indigo-100 text-indigo-700 text-[11px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Q{qIdx + 1}</span>
                                    <QIcon size={18} className="text-muted-foreground" />
                                    <span className="text-foreground/80 font-bold text-[14px] flex-1">{QUESTION_TYPES.find(t => t.value === q.type)?.label}</span>
                                    {q.category && (
                                        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-indigo-100">{q.category}</span>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                        q.difficulty === 'EASY' ? 'bg-emerald-50 text-emerald-600' :
                                        q.difficulty === 'HARD' ? 'bg-rose-50 text-rose-600' :
                                        'bg-amber-50 text-amber-600'
                                    }`}>{q.difficulty}</span>
                                    <button onClick={() => updateQuestion(qIdx, 'isExpanded', !q.isExpanded)} className="p-2 text-muted-foreground/60 hover:bg-muted hover:text-foreground/80 rounded-lg transition-colors"><ChevronDown size={18} className={q.isExpanded ? "rotate-180 transition-transform" : "transition-transform"} /></button>
                                    <button onClick={() => removeQuestion(qIdx)} className="p-2 text-rose-500/70 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                </div>

                                {q.isExpanded && (
                                    <div className="p-6 space-y-5">
                                        <div>
                                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Question Prompt *</label>
                                            <textarea value={q.text} onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)} className={`${InputClass} min-h-[80px]`} placeholder="What is the output of..." />
                                        </div>

                                        {/* Category and Difficulty Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                                    <Layers size={12} className="inline mr-1" /> Category
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={q.category || ''}
                                                        onChange={e => updateQuestion(qIdx, 'category', e.target.value)}
                                                        className="flex-1 bg-card border border-border rounded-lg py-2.5 px-3 text-[13px] font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 shadow-sm"
                                                        placeholder="e.g. React Basics, Variables"
                                                        list={`categories-list-${qIdx}`}
                                                    />
                                                    <datalist id={`categories-list-${qIdx}`}>
                                                        {categories.map(cat => <option key={cat} value={cat} />)}
                                                    </datalist>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Difficulty</label>
                                                <select
                                                    value={q.difficulty || 'MEDIUM'}
                                                    onChange={e => updateQuestion(qIdx, 'difficulty', e.target.value)}
                                                    className="w-full bg-card border border-border rounded-lg py-2.5 px-3 text-[13px] font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 shadow-sm"
                                                >
                                                    <option value="EASY">Easy</option>
                                                    <option value="MEDIUM">Medium</option>
                                                    <option value="HARD">Hard</option>
                                                </select>
                                            </div>
                                        </div>

                                        {(q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI' || q.type === 'TRUE_FALSE') && (
                                            <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-4">
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Options & Correct Answer</label>
                                                {q.options.map((opt, oIdx) => (
                                                    <div key={oIdx} className="flex items-center gap-3">
                                                        <button onClick={() => toggleCorrectOption(qIdx, oIdx)} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 shadow-sm ${q.correctAnswers.includes(oIdx) ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-card border border-border text-transparent hover:border-indigo-400'}`}>
                                                            {q.correctAnswers.includes(oIdx) && <CheckCircle size={16} />}
                                                        </button>
                                                        <input type="text" value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} className="flex-1 bg-card border border-border rounded-lg py-2.5 px-3 text-[14px] font-bold text-foreground outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 shadow-sm" placeholder={`Option ${oIdx + 1}`} />
                                                        <button onClick={() => removeOption(qIdx, oIdx)} className="p-2 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => addOption(qIdx)} className="text-[12px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 mt-2 transition-colors"><Plus size={14} /> Add Option</button>
                                            </div>
                                        )}

                                        {(q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') && (
                                            <div className="bg-muted/40 border border-border rounded-xl p-5">
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                                                    {q.type === 'SHORT_ANSWER' ? 'Correct Answer (case-insensitive)' : 'Acceptable Answer(s) (Case-insensitive)'}
                                                </label>
                                                <input type="text" value={q.correctAnswers[0] || ''} onChange={e => {
                                                    const newQs = [...questions]; newQs[qIdx].correctAnswers = [e.target.value]; setQuestions(newQs);
                                                }} className={InputClass} placeholder={q.type === 'SHORT_ANSWER' ? 'Exact expected answer...' : 'Exact valid text...'} />
                                                {q.type === 'SHORT_ANSWER' && (
                                                    <p className="text-[11px] font-medium text-muted-foreground/70 mt-2">
                                                        Tip: accept alternative spellings by adding them to the question's options (the options list is optional for short answers).
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-3 pt-5">
                    {QUESTION_TYPES.map(qt => (
                        <button key={qt.value} onClick={() => addQuestion(qt.value)} className="px-4 py-2.5 bg-card border border-border hover:bg-muted/40 hover:border-border rounded-xl text-[13px] font-bold text-foreground/80 flex items-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-indigo-100">
                            <Plus size={16} className="text-indigo-600" /> Add {qt.label}
                        </button>
                    ))}
                </div>

                {/* Quick-add by category */}
                {categories.length > 0 && (
                    <div className="bg-muted/20 border border-border rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-foreground mb-3">Quick Add to Category</h3>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <div key={cat} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                                    <span className="text-xs font-bold text-foreground capitalize">{cat}</span>
                                    <button
                                        onClick={() => addQuestionsByCategory('MCQ_SINGLE', cat)}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                        + MCQ
                                    </button>
                                    <button
                                        onClick={() => addQuestionsByCategory('FILL_BLANK', cat)}
                                        className="text-[10px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                                    >
                                        + Fill
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md p-4 border-t border-border z-20 flex justify-end px-8 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                    <div className="w-full max-w-4xl mx-auto flex justify-end gap-3">
                        <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-xl text-[14px] font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-xl text-[14px] font-bold text-white flex items-center gap-2 shadow-sm transition-colors">
                            <Save size={18} /> {saving ? 'Saving...' : 'Save Active Quiz'}
                        </button>
                    </div>
                </div>
            </div>
    );
}
