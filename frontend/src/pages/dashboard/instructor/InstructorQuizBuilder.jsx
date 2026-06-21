import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, CheckCircle, ChevronDown, ChevronUp, CheckSquare, Circle, Type, FileText } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { coursesAPI, quizzesAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const QUESTION_TYPES = [
    { value: 'MCQ_SINGLE', label: 'Single Choice (Radio)', icon: Circle },
    { value: 'MCQ_MULTI', label: 'Multiple Choice (Checkbox)', icon: CheckSquare },
    { value: 'FILL_BLANK', label: 'Fill in the Blank', icon: Type },
    { value: 'LONG_ANSWER', label: 'Custom Long Answer', icon: FileText }
];

export default function InstructorQuizBuilder() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [saving, setSaving] = useState(false);

    const [quizInfo, setQuizInfo] = useState({
        courseId: '', title: '', instructions: '', timeLimit: 30, passingScore: 80
    });

    const [questions, setQuestions] = useState([
        { id: `q${Date.now()}`, type: 'MCQ_SINGLE', text: '', options: ['', ''], correctAnswers: [0], isExpanded: true }
    ]);

    useEffect(() => {
        coursesAPI.getByInstructor(user.id).then(setCourses);
    }, [user.id]);

    const handleInfoChange = (e) => {
        setQuizInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const addQuestion = (type) => {
        setQuestions([...questions, {
            id: `q${Date.now()}`, type, text: '',
            options: type.includes('MCQ') ? ['', ''] : [],
            correctAnswers: type === 'MCQ_SINGLE' ? [0] : [],
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
        // clean up correctAnswers array if needed
        newQs[qIdx].correctAnswers = newQs[qIdx].correctAnswers.filter(i => i !== optIdx).map(i => i > optIdx ? i - 1 : i);
        setQuestions(newQs);
    };

    const toggleCorrectOption = (qIdx, optIdx) => {
        const newQs = [...questions];
        const q = newQs[qIdx];

        if (q.type === 'MCQ_SINGLE') {
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

    const handleSave = async () => {
        if (!quizInfo.courseId || !quizInfo.title) {
            toast.error('Please assign a course and quiz title!');
            return;
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) { toast.error(`Question ${i + 1} is missing text.`); return; }
            if (q.type.includes('MCQ') && q.options.some(o => !o.trim())) { toast.error(`Question ${i + 1} has empty options.`); return; }
            if (q.type.includes('MCQ') && q.correctAnswers.length === 0) { toast.error(`Question ${i + 1} has no correct answer selected.`); return; }
            if (q.type === 'FILL_BLANK' && (!q.correctAnswers[0] || !q.correctAnswers[0].trim())) { toast.error(`Question ${i + 1} requires a valid blank answer.`); return; }
        }

        setSaving(true);
        try {
            await quizzesAPI.createQuiz({
                courseId: quizInfo.courseId,
                title: quizInfo.title,
                instructions: quizInfo.instructions,
                timeLimit: parseInt(quizInfo.timeLimit),
                passingScore: parseInt(quizInfo.passingScore),
                questions: questions.map(q => ({
                    id: q.id,
                    type: q.type,
                    text: q.text,
                    options: q.options,
                    correctAnswer: q.type === 'MCQ_SINGLE' ? String(q.options[q.correctAnswers[0]])
                        : q.type === 'MCQ_MULTI' ? q.correctAnswers.map(idx => String(q.options[idx]))
                            : q.type === 'FILL_BLANK' ? String(q.correctAnswers[0])
                                : null
                }))
            });
            toast.success('Quiz generated and published perfectly!');
            navigate('/instructor/courses');
        } catch (err) {
            toast.error('Failed to create quiz: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const InputClass = "w-full bg-card border border-border text-foreground placeholder:text-muted-foreground/60 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow text-[15px]";

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div>
                <h1 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">Quiz Builder</h1>
                <p className="text-muted-foreground font-medium">Create powerful assessments with varying answer types and anti-cheat enforcements.</p>
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
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Time Limit (mins)</label>
                        <input type="number" name="timeLimit" value={quizInfo.timeLimit} onChange={handleInfoChange} className={InputClass} min="1" />
                    </div>
                    <div>
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Passing Score (%)</label>
                        <input type="number" name="passingScore" value={quizInfo.passingScore} onChange={handleInfoChange} className={InputClass} min="1" max="100" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Instructions</label>
                        <textarea name="instructions" value={quizInfo.instructions} onChange={handleInfoChange} className={`${InputClass} min-h-[100px] resize-y`} placeholder="Specific instructions for taking this exam..." />
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                {questions.map((q, qIdx) => {
                    const QIcon = QUESTION_TYPES.find(t => t.value === q.type)?.icon || FileText;
                    return (
                        <div key={q.id} className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden transition-all">
                            <div className="bg-muted/40 border-b border-border p-4 flex items-center gap-3">
                                <GripVertical size={18} className="text-muted-foreground/60 cursor-move" />
                                <span className="bg-indigo-100 text-indigo-700 text-[11px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">Q{qIdx + 1}</span>
                                <QIcon size={18} className="text-muted-foreground" />
                                <span className="text-foreground/80 font-bold text-[14px] flex-1">{QUESTION_TYPES.find(t => t.value === q.type)?.label}</span>
                                <button onClick={() => updateQuestion(qIdx, 'isExpanded', !q.isExpanded)} className="p-2 text-muted-foreground/60 hover:bg-muted hover:text-foreground/80 rounded-lg transition-colors"><ChevronDown size={18} className={q.isExpanded ? "rotate-180 transition-transform" : "transition-transform"} /></button>
                                <button onClick={() => removeQuestion(qIdx)} className="p-2 text-rose-500/70 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"><Trash2 size={18} /></button>
                            </div>

                            {q.isExpanded && (
                                <div className="p-6 space-y-5">
                                    <div>
                                        <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Question Prompt *</label>
                                        <textarea value={q.text} onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)} className={`${InputClass} min-h-[80px]`} placeholder="What is the output of..." />
                                    </div>

                                    {(q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI') && (
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

                                    {q.type === 'FILL_BLANK' && (
                                        <div className="bg-muted/40 border border-border rounded-xl p-5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Acceptable Answer(s) (Case-insensitive)</label>
                                            <input type="text" value={q.correctAnswers[0] || ''} onChange={e => {
                                                const newQs = [...questions]; newQs[qIdx].correctAnswers = [e.target.value]; setQuestions(newQs);
                                            }} className={InputClass} placeholder="Exact valid text..." />
                                        </div>
                                    )}

                                    {q.type === 'LONG_ANSWER' && (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                                            <span className="w-1.5 rounded-full bg-amber-400"></span>
                                            <p className="text-[13px] font-semibold text-amber-800">Instructors must manually grade LONG_ANSWER questions in the analytics tab.</p>
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
