import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Upload, Plus, Trash2, GripVertical, CheckCircle, Video, FileText, Image as ImageIcon, ChevronDown, ChevronUp, HelpCircle, Clock, Award, Play, FileSpreadsheet, Download, Shuffle } from 'lucide-react';
import { coursesAPI, statsAPI, quizzesAPI, uploadAPI } from '../../../services/api';
import { parseQuestionFile, downloadQuestionTemplate } from '../../../utils/quizImport';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function CreateCourseForm() {
    useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const editId = params.get('edit');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);

    const [formData, setFormData] = useState({
        title: '', description: '', categoryId: '', customCategory: '', level: 'Beginner',
        duration: '',
        certificate: true,
        tags: '', prerequisites: '', learningOutcomes: '', dripMode: 'none'
    });

    const [thumbnailPreview, setThumbnailPreview] = useState('');
    const [courseStatus, setCourseStatus] = useState(null); // current status when editing
    const thumbnailInputRef = useRef(null);

    const [deletedSections, setDeletedSections] = useState([]);
    const [deletedLessons, setDeletedLessons] = useState([]);

    const [curriculum, setCurriculum] = useState([
        {
            id: 's1', title: 'Introduction', isExpanded: true, lessons: [
                { id: 'l1', title: 'Welcome to the course', type: 'video', contentUrl: '', duration: '5:00', preview: true }
            ]
        }
    ]);

    useEffect(() => {
        statsAPI.getCategories().then(setCategories);

        if (editId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(true);
            Promise.all([
                coursesAPI.getById(editId),
                coursesAPI.getLessons(editId),
                quizzesAPI.getByCourse(editId).catch(() => [])
            ]).then(([course, curriculumData, quizzes]) => {
                setFormData({
                    title: course.title || '',
                    description: course.description || '',
                    categoryId: course.categoryId || '',
                    customCategory: '',
                    level: course.level || 'Beginner',
                    duration: course.duration || '',
                    certificate: course.certificate ?? true,
                    tags: course.tags?.join(', ') || '',
                    prerequisites: course.prerequisites?.join(', ') || '',
                    learningOutcomes: course.learningOutcomes?.join('\n') || '',
                    dripMode: course.dripMode || 'none'
                });
                setThumbnailPreview(course.thumbnail || '');
                setCourseStatus(course.status || null);

                // Map curriculum data for the UI
                if (curriculumData.sections && curriculumData.sections.length > 0) {
                    // Existing quiz questions keyed by lesson, mapped back to the builder format
                    const quizByLesson = {};
                    const quizSettingsByLesson = {};
                    (Array.isArray(quizzes) ? quizzes : []).forEach(quiz => {
                        if (!quiz.lessonId) return;
                        quizSettingsByLesson[quiz.lessonId] = {
                            passingScore: quiz.passingScore ?? 70,
                            timeLimit: quiz.timeLimit ?? 30,
                            selectionConfig: quiz.selectionConfig || null
                        };
                        quizByLesson[quiz.lessonId] = (quiz.questions || []).map(q => ({
                            id: q.id,
                            type: q.type,
                            text: q.text,
                            difficulty: q.difficulty || 'MEDIUM',
                            options: q.options || [],
                            correctAnswers: q.type === 'FILL_BLANK'
                                ? [q.correctAnswer || '']
                                : q.type === 'MCQ_MULTI'
                                    ? (q.correctAnswer || []).map(ans => (q.options || []).indexOf(ans)).filter(idx => idx >= 0)
                                    : [Math.max(0, (q.options || []).indexOf(q.correctAnswer))]
                        }));
                    });

                    const mappedCurr = curriculumData.sections.map(sec => ({
                        id: sec.id,
                        dbId: sec.id, // Track real DB ID
                        title: sec.title,
                        isExpanded: true,
                        lessons: curriculumData.lessons
                            .filter(l => l.section_id === sec.id)
                            .map(l => ({
                                id: l.id,
                                dbId: l.id, // Track real DB ID
                                title: l.title,
                                type: l.type,
                                contentUrl: l.contentUrl,
                                duration: l.duration,
                                preview: l.preview,
                                questions: quizByLesson[l.id] || [],
                                passingScore: quizSettingsByLesson[l.id]?.passingScore ?? 70,
                                timeLimit: quizSettingsByLesson[l.id]?.timeLimit ?? 30,
                                selectionMode: quizSettingsByLesson[l.id]?.selectionConfig?.mode || 'ALL',
                                selectionCount: quizSettingsByLesson[l.id]?.selectionConfig?.count || 10,
                                selectionEasy: quizSettingsByLesson[l.id]?.selectionConfig?.easy || 0,
                                selectionMedium: quizSettingsByLesson[l.id]?.selectionConfig?.medium || 0,
                                selectionHard: quizSettingsByLesson[l.id]?.selectionConfig?.hard || 0
                            }))
                    }));
                    setCurriculum(mappedCurr);
                }

                toast.success('Course details and curriculum loaded!');
            }).catch((err) => {
                console.error(err);
                toast.error('Failed to load course data');
                navigate('/instructor/courses');
            }).finally(() => setLoading(false));
        }
    }, [editId, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleThumbnailUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Thumbnail must be less than 5MB');
                return;
            }
            const loadToast = toast.loading('Uploading thumbnail to Cloudinary...');
            try {
                const res = await uploadAPI.uploadMedia(file);
                setThumbnailPreview(res.url);
                toast.success('Thumbnail uploaded!', { id: loadToast });
            } catch (err) {
                toast.error('Failed to upload thumbnail: ' + err.message, { id: loadToast });
            }
        }
    };

    // Curriculum functions
    const addSection = () => {
        setCurriculum([...curriculum, { id: `s${Date.now()}`, title: '', isExpanded: true, lessons: [] }]);
    };

    const updateSection = (secIdx, field, value) => {
        const newCurr = [...curriculum];
        newCurr[secIdx][field] = value;
        setCurriculum(newCurr);
    };

    const deleteSection = (secIdx) => {
        if (window.confirm('Are you sure you want to delete this module and all its lessons?')) {
            const newCurr = [...curriculum];
            const sec = newCurr[secIdx];
            if (sec.dbId) setDeletedSections(prev => [...prev, sec.dbId]);
            newCurr.splice(secIdx, 1);
            setCurriculum(newCurr);
        }
    };

    const addLesson = (secIdx) => {
        const newCurr = [...curriculum];
        newCurr[secIdx].lessons.push({ id: `l${Date.now()}`, title: '', type: 'video', contentUrl: '', duration: '', preview: false });
        newCurr[secIdx].isExpanded = true;
        setCurriculum(newCurr);
    };

    const updateLesson = (secIdx, lessIdx, field, value) => {
        const newCurr = [...curriculum];
        newCurr[secIdx].lessons[lessIdx][field] = value;
        setCurriculum(newCurr);
    };

    const deleteLesson = (secIdx, lessIdx) => {
        const newCurr = [...curriculum];
        const ls = newCurr[secIdx].lessons[lessIdx];
        if (ls.dbId) setDeletedLessons(prev => [...prev, ls.dbId]);
        newCurr[secIdx].lessons.splice(lessIdx, 1);
        setCurriculum(newCurr);
    };

    const handleLessonFileUpload = async (e, secIdx, lessIdx) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) {
                toast.error('File must be less than 100MB. For larger videos, upload to YouTube/Vimeo and paste the link.');
                e.target.value = '';
                return;
            }
            const loadToast = toast.loading(`Uploading ${file.name} to Cloudinary...`);
            try {
                const res = await uploadAPI.uploadMedia(file);
                updateLesson(secIdx, lessIdx, 'contentUrl', res.url);
                updateLesson(secIdx, lessIdx, 'fileName', file.name);
                toast.success(`File ${file.name} uploaded successfully!`, { id: loadToast });
            } catch (err) {
                toast.error('Upload failed: ' + err.message, { id: loadToast });
            } finally {
                e.target.value = ''; // allow re-selecting the same file
            }
        }
    };

    const addLessonQuestion = (sIdx, lIdx) => {
        const newCurr = [...curriculum];
        if (!newCurr[sIdx].lessons[lIdx].questions) {
            newCurr[sIdx].lessons[lIdx].questions = [];
        }
        newCurr[sIdx].lessons[lIdx].questions.push({
            id: `q${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'MCQ_SINGLE',
            text: '',
            difficulty: 'MEDIUM',
            options: ['', ''],
            correctAnswers: [0]
        });
        setCurriculum(newCurr);
    };

    // Bulk import questions from CSV/Excel into a quiz lesson
    const handleQuestionImport = async (e, sIdx, lIdx) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const loadToast = toast.loading(`Parsing ${file.name}...`);
        try {
            const { questions, errors, total } = await parseQuestionFile(file);
            if (questions.length === 0) {
                toast.error(errors[0] || 'No valid questions found in the file.', { id: loadToast });
                return;
            }
            const newCurr = [...curriculum];
            const lesson = newCurr[sIdx].lessons[lIdx];
            lesson.questions = [...(lesson.questions || []), ...questions];
            setCurriculum(newCurr);
            if (errors.length > 0) {
                toast.success(`Imported ${questions.length} of ${total} questions. ${errors.length} row(s) skipped — check the format.`, { id: loadToast, duration: 6000 });
                console.warn('Question import issues:', errors);
            } else {
                toast.success(`Imported ${questions.length} questions from ${file.name}!`, { id: loadToast });
            }
        } catch (err) {
            toast.error('Could not read file: ' + err.message, { id: loadToast });
        }
    };

    const updateLessonQuestion = (sIdx, lIdx, qIdx, field, value) => {
        const newCurr = [...curriculum];
        const q = newCurr[sIdx].lessons[lIdx].questions[qIdx];
        q[field] = value;
        // Reset answers when switching type so indexes/strings don't get mixed up
        if (field === 'type') {
            q.correctAnswers = value === 'FILL_BLANK' ? [''] : [];
            if (value !== 'FILL_BLANK' && q.options.length < 2) q.options = ['', ''];
        }
        setCurriculum(newCurr);
    };

    const addQuestionOption = (sIdx, lIdx, qIdx) => {
        const newCurr = [...curriculum];
        newCurr[sIdx].lessons[lIdx].questions[qIdx].options.push('');
        setCurriculum(newCurr);
    };

    const updateQuestionOption = (sIdx, lIdx, qIdx, oIdx, value) => {
        const newCurr = [...curriculum];
        newCurr[sIdx].lessons[lIdx].questions[qIdx].options[oIdx] = value;
        setCurriculum(newCurr);
    };

    const removeQuestionOption = (sIdx, lIdx, qIdx, oIdx) => {
        const newCurr = [...curriculum];
        newCurr[sIdx].lessons[lIdx].questions[qIdx].options.splice(oIdx, 1);
        newCurr[sIdx].lessons[lIdx].questions[qIdx].correctAnswers = newCurr[sIdx].lessons[lIdx].questions[qIdx].correctAnswers
            .filter(i => i !== oIdx)
            .map(i => i > oIdx ? i - 1 : i);
        setCurriculum(newCurr);
    };

    const deleteLessonQuestion = (sIdx, lIdx, qIdx) => {
        const newCurr = [...curriculum];
        newCurr[sIdx].lessons[lIdx].questions.splice(qIdx, 1);
        setCurriculum(newCurr);
    };

    const toggleCorrectOptionInline = (sIdx, lIdx, qIdx, oIdx) => {
        const newCurr = [...curriculum];
        const q = newCurr[sIdx].lessons[lIdx].questions[qIdx];
        if (q.type === 'MCQ_SINGLE') {
            q.correctAnswers = [oIdx];
        } else if (q.type === 'MCQ_MULTI') {
            if (q.correctAnswers.includes(oIdx)) {
                q.correctAnswers = q.correctAnswers.filter(i => i !== oIdx);
            } else {
                q.correctAnswers.push(oIdx);
            }
        }
        setCurriculum(newCurr);
    };

    // A question is complete when it has a prompt and valid answers — incomplete
    // ones are allowed in drafts but skipped when syncing quizzes to the server.
    const isQuestionComplete = (q) => {
        if (!q.text.trim()) return false;
        if (q.type === 'FILL_BLANK') return !!String(q.correctAnswers[0] || '').trim();
        const filled = q.options.filter(o => o.trim());
        return filled.length >= 2 && filled.length === q.options.length
            && new Set(q.options.map(o => o.trim())).size === q.options.length
            && q.correctAnswers.length > 0;
    };

    const handleSubmit = async (e, type = 'PUBLISHED') => {
        e.preventDefault();
        if (saving) return;
        if (!formData.title || (!formData.categoryId && !formData.customCategory) || !formData.description) {
            toast.error('Please fill in all required fields (Title, Category, Description)');
            return;
        }

        if (curriculum.length === 0 || curriculum.some(s => !s.title || s.lessons.length === 0 || s.lessons.some(l => !l.title.trim()))) {
            toast.error('Please ensure all modules have a title, at least one lesson, and every lesson has a title.');
            return;
        }

        // Validate quiz lessons up-front so a bad question doesn't fail mid-sync.
        // Drafts are allowed to be incomplete — only full-check on submit for approval.
        const isDraft = type === 'DRAFT';
        for (const section of curriculum) {
            for (const lesson of section.lessons) {
                if (lesson.type !== 'quiz') {
                    if (!isDraft && !lesson.contentUrl?.trim()) {
                        toast.error(`Lesson "${lesson.title}" needs a ${lesson.type === 'video' ? 'video' : 'document'} — upload a file or paste a link.`);
                        return;
                    }
                    continue;
                }
                const questions = lesson.questions || [];
                if (questions.length === 0) {
                    if (isDraft) continue;
                    toast.error(`Quiz "${lesson.title}" has no questions. Add at least one question.`);
                    return;
                }
                if (isDraft) continue; // incomplete questions are fine in drafts
                // Selection config must be satisfiable by the question bank
                if (lesson.selectionMode === 'RANDOM') {
                    const count = parseInt(lesson.selectionCount, 10) || 0;
                    if (count < 1 || count > questions.length) {
                        toast.error(`Quiz "${lesson.title}": random question count must be between 1 and ${questions.length}.`);
                        return;
                    }
                } else if (lesson.selectionMode === 'BY_DIFFICULTY') {
                    const avail = { EASY: 0, MEDIUM: 0, HARD: 0 };
                    questions.forEach(q => { avail[q.difficulty || 'MEDIUM']++; });
                    const wantE = parseInt(lesson.selectionEasy, 10) || 0;
                    const wantM = parseInt(lesson.selectionMedium, 10) || 0;
                    const wantH = parseInt(lesson.selectionHard, 10) || 0;
                    if (wantE + wantM + wantH < 1) {
                        toast.error(`Quiz "${lesson.title}": select at least 1 question across difficulty levels.`);
                        return;
                    }
                    if (wantE > avail.EASY || wantM > avail.MEDIUM || wantH > avail.HARD) {
                        toast.error(`Quiz "${lesson.title}": bank has ${avail.EASY} easy / ${avail.MEDIUM} medium / ${avail.HARD} hard — you asked for ${wantE}/${wantM}/${wantH}.`);
                        return;
                    }
                }
                for (let qi = 0; qi < questions.length; qi++) {
                    const q = questions[qi];
                    if (!q.text.trim()) {
                        toast.error(`Quiz "${lesson.title}": question ${qi + 1} is missing its prompt.`);
                        return;
                    }
                    if (q.type === 'FILL_BLANK') {
                        if (!String(q.correctAnswers[0] || '').trim()) {
                            toast.error(`Quiz "${lesson.title}": question ${qi + 1} needs a correct answer.`);
                            return;
                        }
                    } else {
                        const filled = q.options.filter(o => o.trim());
                        if (filled.length < 2 || filled.length !== q.options.length) {
                            toast.error(`Quiz "${lesson.title}": question ${qi + 1} needs at least 2 options and none can be empty.`);
                            return;
                        }
                        if (new Set(q.options.map(o => o.trim())).size !== q.options.length) {
                            toast.error(`Quiz "${lesson.title}": question ${qi + 1} has duplicate options.`);
                            return;
                        }
                        if (q.correctAnswers.length === 0) {
                            toast.error(`Quiz "${lesson.title}": question ${qi + 1} needs a correct answer marked.`);
                            return;
                        }
                    }
                }
            }
        }

        setSaving(true);
        try {
            const dbFormat = {
                title: formData.title,
                description: formData.description,
                short_desc: '',
                category_id: formData.categoryId === 'custom' ? null : formData.categoryId,
                custom_category: formData.categoryId === 'custom' ? formData.customCategory.trim() : undefined,
                level: formData.level,
                duration: formData.duration,
                thumbnail: thumbnailPreview || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
                certificate: formData.certificate,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                requirements: formData.prerequisites.split(',').map(t => t.trim()).filter(Boolean),
                what_you_learn: formData.learningOutcomes.split('\n').filter(Boolean),
                drip_mode: formData.dripMode || 'none',
                // Don't silently unpublish a live course on edit — keep PUBLISHED
                // unless the instructor explicitly saves as draft.
                status: type === 'DRAFT'
                    ? 'DRAFT'
                    : (editId && courseStatus === 'PUBLISHED') ? undefined : 'PENDING'
            };

            let targetCourseId = editId;
            if (editId) {
                await coursesAPI.update(editId, dbFormat);
            } else {
                const newCourse = await coursesAPI.create(dbFormat);
                targetCourseId = newCourse.id;
            }

            // Handle deletions first
            for (const dLesson of deletedLessons) {
                await coursesAPI.deleteLesson(dLesson).catch(() => { });
            }
            for (const dSection of deletedSections) {
                await coursesAPI.deleteSection(dSection).catch(() => { });
            }

            // Sync curriculum
            for (let sIdx = 0; sIdx < curriculum.length; sIdx++) {
                const section = curriculum[sIdx];
                let sectionId = section.dbId;

                if (sectionId) {
                    await coursesAPI.updateSection(sectionId, { title: section.title, order: sIdx + 1 });
                } else {
                    const secRes = await coursesAPI.createSection(targetCourseId, { title: section.title, order: sIdx + 1 });
                    sectionId = secRes.id;
                }

                for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
                    const lesson = section.lessons[lIdx];
                    let lessonId = lesson.dbId;

                    const lessonData = {
                        section_id: sectionId,
                        title: lesson.title,
                        type: lesson.type,
                        content_url: lesson.contentUrl || '',
                        duration: lesson.duration || '',
                        preview: lesson.preview || false,
                        order: lIdx + 1
                    };

                    if (lessonId) {
                        await coursesAPI.updateLesson(lessonId, lessonData);
                    } else {
                        const lessonRes = await coursesAPI.createLesson(targetCourseId, lessonData);
                        lessonId = lessonRes.id;
                    }

                    // Handle Quizzes — sync only complete questions (drafts may hold partial ones)
                    if (lesson.type === 'quiz' && lesson.questions && lesson.questions.length > 0) {
                        const completeQuestions = lesson.questions.filter(isQuestionComplete);
                        if (completeQuestions.length === 0) continue;
                        const formattedQuestions = completeQuestions.map(q => ({
                            id: q.id,
                            text: q.text,
                            type: q.type,
                            difficulty: q.difficulty || 'MEDIUM',
                            options: q.options || [],
                            correctAnswer: q.type === 'FILL_BLANK'
                                ? (q.correctAnswers[0] || '')
                                : q.type === 'MCQ_MULTI'
                                    ? q.correctAnswers.map(index => q.options[index])
                                    : q.options[q.correctAnswers[0]]
                        }));

                        // Per-attempt question selection: all, N random, or N per difficulty.
                        // Clamp to what's actually synced — drafts may filter out
                        // incomplete questions, and the backend rejects over-requests.
                        let selectionConfig = { mode: 'ALL' };
                        if (lesson.selectionMode === 'RANDOM') {
                            selectionConfig = {
                                mode: 'RANDOM',
                                count: Math.min(formattedQuestions.length, Math.max(1, parseInt(lesson.selectionCount, 10) || 1))
                            };
                        } else if (lesson.selectionMode === 'BY_DIFFICULTY') {
                            const avail = { EASY: 0, MEDIUM: 0, HARD: 0 };
                            formattedQuestions.forEach(q => { avail[q.difficulty] = (avail[q.difficulty] || 0) + 1; });
                            selectionConfig = {
                                mode: 'BY_DIFFICULTY',
                                easy: Math.min(avail.EASY, Math.max(0, parseInt(lesson.selectionEasy, 10) || 0)),
                                medium: Math.min(avail.MEDIUM, Math.max(0, parseInt(lesson.selectionMedium, 10) || 0)),
                                hard: Math.min(avail.HARD, Math.max(0, parseInt(lesson.selectionHard, 10) || 0))
                            };
                            // Everything clamped to zero → fall back to ALL so the save succeeds
                            if (selectionConfig.easy + selectionConfig.medium + selectionConfig.hard < 1) {
                                selectionConfig = { mode: 'ALL' };
                            }
                        }

                        await quizzesAPI.createQuiz({
                            courseId: targetCourseId,
                            lessonId: lessonId,
                            title: lesson.title,
                            instructions: 'Please complete this quiz to proceed.',
                            passingScore: Math.min(100, Math.max(0, parseInt(lesson.passingScore, 10) || 70)),
                            timeLimit: Math.min(180, Math.max(1, parseInt(lesson.timeLimit, 10) || 30)),
                            selectionConfig,
                            questions: formattedQuestions
                        });
                    }
                }
            }

            toast.success(editId ? `Course and curriculum updated successfully!` : `Course created successfully and is pending approval!`);
            navigate('/instructor/courses');
        } catch (err) {
            toast.error('Failed to save course: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading && editId) return <div className="p-8 text-center text-gray-500">Loading course data...</div>;

    const InputClass = "w-full bg-card border border-border text-foreground placeholder:text-muted-foreground/60 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow";

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">
                    {editId ? 'Edit Course Details' : 'Create New Course'}
                </h1>
                <p className="text-muted-foreground font-medium">Design your curriculum and manage media</p>
            </div>

            <form className="space-y-8" onSubmit={(e) => handleSubmit(e, 'PENDING')}>

                {/* Basic Info */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2"><CheckCircle size={20} className="text-indigo-600" /> Basic Information</h2>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Course Title *</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} className={InputClass} placeholder="e.g. Advanced JavaScript Masterclass" required />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Category *</label>
                                <select name="categoryId" value={formData.categoryId} onChange={handleChange} className={InputClass} required>
                                    <option value="">Select Category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    <option value="custom">+ Create Custom Category</option>
                                </select>
                                {formData.categoryId === 'custom' && (
                                    <input type="text" name="customCategory" value={formData.customCategory} onChange={handleChange} className={`${InputClass} mt-3`} placeholder="Enter your custom category" required />
                                )}
                            </div>
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Difficulty Level</label>
                                <select name="level" value={formData.level} onChange={handleChange} className={InputClass}>
                                    <option value="Beginner">Beginner</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Advanced">Advanced</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Course Description *</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} className={`${InputClass} min-h-[120px] resize-y`} placeholder="Describe what students will learn..." required />
                        </div>
                    </div>
                </div>

                {/* Media & Thumbnail */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-cyan-600" /> Thumbnail & Settings</h2>
                    <div className="space-y-6">
                        {/* Thumbnail Upload */}
                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-3">Course Thumbnail</label>
                            <div className="flex gap-6 items-start">
                                <div
                                    className="w-64 h-36 border-2 border-dashed border-border rounded-xl bg-muted/40 flex flex-col items-center justify-center cursor-pointer hover:bg-muted hover:border-indigo-300 transition-colors overflow-hidden relative group shadow-sm"
                                    onClick={() => thumbnailInputRef.current?.click()}
                                >
                                    <input type="file" ref={thumbnailInputRef} onChange={handleThumbnailUpload} accept="image/*" className="hidden" />
                                    {thumbnailPreview ? (
                                        <>
                                            <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <p className="text-white text-sm font-bold flex items-center gap-2"><Upload size={16} /> Change Image</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4">
                                            <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm mx-auto mb-3">
                                                <ImageIcon size={20} className="text-muted-foreground/60" />
                                            </div>
                                            <p className="text-[13px] font-bold text-muted-foreground leading-tight">Click to upload image<br />(Max 5MB)</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 bg-muted/40 p-4 rounded-xl border border-border">
                                    <p className="text-[13px] font-semibold text-muted-foreground leading-relaxed">
                                        Upload your course image here. It must meet our course image quality standards to be accepted.<br /><br />
                                        Important guidelines: 750x422 pixels; .jpg, .jpeg,. gif, or .png. No text on the image.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5 border-t border-border pt-6">
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Est. Total Duration</label>
                                <input type="text" name="duration" value={formData.duration} onChange={handleChange} className={InputClass} placeholder="e.g. 10 hours" />
                            </div>
                            <div className="flex items-center gap-3 pt-8">
                                <input type="checkbox" id="cert" name="certificate" checked={formData.certificate} onChange={handleChange} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-border" />
                                <label htmlFor="cert" className="text-[14px] font-semibold text-foreground/80 cursor-pointer">Offer Certificate on completion</label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Curriculum Builder */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Video size={20} className="text-purple-600" /> Curriculum Builder</h2>
                        <button type="button" onClick={addSection} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
                            <Plus size={16} /> Add Module
                        </button>
                    </div>

                    <div className="space-y-5">
                        {curriculum.map((section, sIdx) => (
                            <div key={section.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                                <div className="p-4 bg-muted/40 border-b border-border flex items-center gap-3">
                                    <GripVertical size={18} className="text-muted-foreground/60 cursor-move" />
                                    <span className="font-bold text-foreground/80">Module {sIdx + 1}:</span>
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={e => updateSection(sIdx, 'title', e.target.value)}
                                        className="flex-1 bg-card border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 rounded-lg outline-none text-foreground px-3 py-1.5 font-bold shadow-sm"
                                        placeholder="Enter module title..."
                                    />
                                    <button type="button" onClick={() => deleteSection(sIdx)} className="p-2 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                    <button type="button" onClick={() => updateSection(sIdx, 'isExpanded', !section.isExpanded)} className="p-2 text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted rounded-lg transition-colors">
                                        {section.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>

                                {section.isExpanded && (
                                    <div className="p-5 space-y-4 bg-card">
                                        {section.lessons.map((lesson, lIdx) => (
                                            <div key={lesson.id} className={`ml-4 md:ml-12 border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${lesson.type === 'video' ? 'border-blue-100 bg-blue-50/20' : lesson.type === 'quiz' ? 'border-purple-100 bg-purple-50/20' : 'border-emerald-100 bg-emerald-50/20'}`}>
                                                <div className="p-4 flex flex-col md:flex-row items-center gap-4 bg-card/60 backdrop-blur-sm">
                                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                                        <GripVertical size={18} className="text-muted-foreground/30 cursor-move" />
                                                        <div className={`p-2 rounded-lg ${lesson.type === 'video' ? 'bg-blue-100 text-blue-600' : lesson.type === 'quiz' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {lesson.type === 'video' && <Play size={18} />}
                                                            {lesson.type === 'document' && <FileText size={18} />}
                                                            {lesson.type === 'quiz' && <HelpCircle size={18} />}
                                                        </div>
                                                        <div className="flex rounded-lg bg-muted/60 p-0.5 border border-border shadow-sm">
                                                            {[
                                                                { value: 'video', icon: Play, label: 'Video' },
                                                                { value: 'document', icon: FileText, label: 'Document' },
                                                                { value: 'quiz', icon: HelpCircle, label: 'Quiz' }
                                                            ].map(({ value, icon: TypeIcon, label }) => (
                                                                <button
                                                                    key={value}
                                                                    type="button"
                                                                    onClick={() => updateLesson(sIdx, lIdx, 'type', value)}
                                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                                                        lesson.type === value
                                                                            ? value === 'video' ? 'bg-blue-500 text-white shadow-sm'
                                                                            : value === 'document' ? 'bg-emerald-500 text-white shadow-sm'
                                                                            : 'bg-purple-500 text-white shadow-sm'
                                                                            : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'
                                                                    }`}
                                                                    title={label}
                                                                >
                                                                    <TypeIcon size={14} />
                                                                    <span className="hidden sm:inline">{label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 w-full relative">
                                                        <input
                                                            type="text"
                                                            value={lesson.title}
                                                            onChange={e => updateLesson(sIdx, lIdx, 'title', e.target.value)}
                                                            className="w-full bg-transparent border-b-2 border-transparent focus:border-indigo-500 outline-none text-[15px] font-bold text-foreground py-1 transition-all"
                                                            placeholder="Lesson title (e.g., Intro to React)"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                                                        <div className="relative group">
                                                            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                                                            <input
                                                                type="text"
                                                                value={lesson.duration}
                                                                onChange={e => updateLesson(sIdx, lIdx, 'duration', e.target.value)}
                                                                className="w-24 pl-8 pr-3 py-2 bg-muted/40 border-0 text-[13px] font-semibold text-muted-foreground rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 text-center transition-all"
                                                                placeholder="Duration"
                                                            />
                                                        </div>
                                                        <button type="button" onClick={() => deleteLesson(sIdx, lIdx)} className="p-2.5 text-muted-foreground/60 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm md:shadow-none hover:shadow-md"><Trash2 size={18} /></button>
                                                    </div>
                                                </div>

                                                <div className="p-4 md:p-6 bg-card/40 border-t border-border">
                                                    {/* Type-specific header banner */}
                                                    <div className={`mb-5 rounded-2xl p-4 flex items-center gap-4 ${
                                                        lesson.type === 'video' ? 'bg-blue-50 border border-blue-200' :
                                                        lesson.type === 'document' ? 'bg-emerald-50 border border-emerald-200' :
                                                        'bg-purple-50 border border-purple-200'
                                                    }`}>
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                                                            lesson.type === 'video' ? 'bg-blue-500 text-white' :
                                                            lesson.type === 'document' ? 'bg-emerald-500 text-white' :
                                                            'bg-purple-500 text-white'
                                                        }`}>
                                                            {lesson.type === 'video' && <Video size={22} />}
                                                            {lesson.type === 'document' && <FileText size={22} />}
                                                            {lesson.type === 'quiz' && <HelpCircle size={22} />}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[15px] font-extrabold text-foreground">
                                                                {lesson.type === 'video' && 'Video Content'}
                                                                {lesson.type === 'document' && 'Document Resource'}
                                                                {lesson.type === 'quiz' && 'Assessment Quiz'}
                                                            </h4>
                                                            <p className="text-[12px] text-muted-foreground/80 font-medium mt-0.5">
                                                                {lesson.type === 'video' && 'Upload a video file or paste a YouTube/Vimeo link. Students will watch this lesson.'}
                                                                {lesson.type === 'document' && 'Upload a PDF, DOC, or share a link to reading material. Students can view or download it.'}
                                                                {lesson.type === 'quiz' && 'Create auto-graded assessments with multiple-choice or fill-in-the-blank questions.'}
                                                            </p>
                                                            {/* Quick stats for quiz type */}
                                                            {lesson.type === 'quiz' && (lesson.questions || []).length > 0 && (
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="bg-white/80 text-purple-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm border border-purple-200">
                                                                        {(lesson.questions || []).length} questions
                                                                    </span>
                                                                    <span className="bg-white/80 text-amber-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm border border-amber-200">
                                                                        Pass: {lesson.passingScore || 70}%
                                                                    </span>
                                                                    <span className="bg-white/80 text-cyan-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm border border-cyan-200">
                                                                        {lesson.timeLimit || 30} min
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {lesson.type !== 'quiz' ? (
                                                        <div className="space-y-6">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                                                    <label className="text-[12px] font-extrabold text-foreground/80 uppercase tracking-widest">Content Resource</label>
                                                                </div>
                                                                <div className="flex flex-col sm:flex-row gap-4">
                                                                    <div className="flex-1 flex flex-col gap-2">
                                                                        <div className="flex flex-wrap gap-3 items-center">
                                                                            <label className="cursor-pointer bg-card border border-border hover:border-indigo-400 hover:shadow-md px-5 py-2.5 rounded-xl text-[13px] text-foreground/80 font-bold flex items-center gap-2.5 transition-all group">
                                                                                <Upload size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                                                                                <span>Upload {lesson.type === 'video' ? 'Video' : 'Document'}</span>
                                                                                <input type="file" className="hidden" onChange={(e) => handleLessonFileUpload(e, sIdx, lIdx)} accept={lesson.type === 'video' ? 'video/*' : 'application/pdf,.doc,.docx'} />
                                                                            </label>
                                                                            <div className="h-4 w-px bg-muted hidden sm:block" />
                                                                            <div className="relative flex-1 group">
                                                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-indigo-500">
                                                                                    {lesson.type === 'video' ? <Play size={14} /> : <FileText size={14} />}
                                                                                </div>
                                                                                <input
                                                                                    type="text"
                                                                                    value={lesson.contentUrl || ''}
                                                                                    onChange={e => updateLesson(sIdx, lIdx, 'contentUrl', e.target.value)}
                                                                                    className="w-full bg-muted border-0 pl-10 pr-4 py-2.5 text-[13px] rounded-xl text-foreground focus:bg-card focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                                                                                    placeholder={lesson.fileName ? `File: ${lesson.fileName}` : lesson.type === 'video' ? "Paste YouTube/Vimeo link" : "Paste shareable document link"}
                                                                                    disabled={!!lesson.fileName}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {lesson.fileName && (
                                                                            <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-2 mt-1 ml-1">
                                                                                <CheckCircle size={12} /> {lesson.fileName} uploaded
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { updateLesson(sIdx, lIdx, 'fileName', ''); updateLesson(sIdx, lIdx, 'contentUrl', ''); }}
                                                                                    className="text-rose-500 hover:text-rose-600 underline font-bold"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 w-max">
                                                                <div className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={lesson.preview}
                                                                        onChange={e => updateLesson(sIdx, lIdx, 'preview', e.target.checked)}
                                                                        id={`prev-${lesson.id}`}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                </div>
                                                                <label htmlFor={`prev-${lesson.id}`} className="text-[13px] font-bold text-muted-foreground cursor-pointer select-none">Make this lesson Free Preview</label>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-6">
                                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                                                <div>
                                                                    <h4 className="text-purple-900 font-extrabold text-sm flex items-center gap-2">
                                                                        <Award size={18} /> SMART ASSESSMENT BUILDER
                                                                    </h4>
                                                                    <p className="text-purple-600 text-[11px] font-bold mt-1 uppercase tracking-wider">Configure questions, options, and passing criteria</p>
                                                                </div>
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <div>
                                                                        <label className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest block mb-1">Pass %</label>
                                                                        <input
                                                                            type="number" min="0" max="100"
                                                                            value={lesson.passingScore ?? 70}
                                                                            onChange={e => updateLesson(sIdx, lIdx, 'passingScore', e.target.value)}
                                                                            className="w-20 bg-card border border-purple-200 rounded-xl px-3 py-2 text-[13px] font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-200"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest block mb-1">Time (min)</label>
                                                                        <input
                                                                            type="number" min="1" max="180"
                                                                            value={lesson.timeLimit ?? 30}
                                                                            onChange={e => updateLesson(sIdx, lIdx, 'timeLimit', e.target.value)}
                                                                            className="w-20 bg-card border border-purple-200 rounded-xl px-3 py-2 text-[13px] font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-200"
                                                                        />
                                                                    </div>
                                                                    <label className="cursor-pointer bg-card border border-purple-300 hover:bg-purple-100 text-purple-700 font-bold py-2 px-4 rounded-xl text-[13px] transition-all flex items-center gap-2 self-end">
                                                                        <FileSpreadsheet size={16} /> IMPORT CSV/EXCEL
                                                                        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => handleQuestionImport(e, sIdx, lIdx)} />
                                                                    </label>
                                                                    <button type="button" onClick={downloadQuestionTemplate} title="Download import template" className="bg-card border border-purple-200 hover:bg-purple-100 text-purple-500 p-2.5 rounded-xl transition-all self-end">
                                                                        <Download size={16} />
                                                                    </button>
                                                                    <button type="button" onClick={() => addLessonQuestion(sIdx, lIdx)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-[13px] shadow-lg shadow-purple-200 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 self-end">
                                                                        <Plus size={16} /> ADD QUESTION
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Question selection strategy */}
                                                            {(lesson.questions || []).length > 0 && (() => {
                                                                const bank = { EASY: 0, MEDIUM: 0, HARD: 0 };
                                                                (lesson.questions || []).forEach(q => { bank[q.difficulty || 'MEDIUM']++; });
                                                                const NumInput = "w-16 bg-card border border-border rounded-lg px-2 py-1.5 text-[13px] font-bold text-foreground text-center outline-none focus:ring-2 focus:ring-indigo-100";
                                                                return (
                                                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                                                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                                                            <h4 className="text-indigo-900 font-extrabold text-[13px] flex items-center gap-2 uppercase tracking-wide">
                                                                                <Shuffle size={16} /> Question Selection per Attempt
                                                                            </h4>
                                                                            <div className="flex items-center gap-2 text-[11px] font-bold">
                                                                                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg">{bank.EASY} Easy</span>
                                                                                <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg">{bank.MEDIUM} Medium</span>
                                                                                <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg">{bank.HARD} Hard</span>
                                                                                <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg">{(lesson.questions || []).length} Total</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 flex-wrap">
                                                                            <select
                                                                                value={lesson.selectionMode || 'ALL'}
                                                                                onChange={e => updateLesson(sIdx, lIdx, 'selectionMode', e.target.value)}
                                                                                className="bg-card border border-border rounded-xl px-3 py-2 text-[13px] font-bold text-foreground/80 outline-none focus:ring-2 focus:ring-indigo-100"
                                                                            >
                                                                                <option value="ALL">All questions (shuffled)</option>
                                                                                <option value="RANDOM">Fully random — pick N</option>
                                                                                <option value="BY_DIFFICULTY">By difficulty — N per level</option>
                                                                            </select>
                                                                            {lesson.selectionMode === 'RANDOM' && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <label className="text-[12px] font-bold text-muted-foreground">Questions per attempt:</label>
                                                                                    <input type="number" min="1" max={(lesson.questions || []).length}
                                                                                        value={lesson.selectionCount ?? 10}
                                                                                        onChange={e => updateLesson(sIdx, lIdx, 'selectionCount', e.target.value)}
                                                                                        className={NumInput} />
                                                                                    <span className="text-[12px] font-bold text-muted-foreground/60">of {(lesson.questions || []).length}</span>
                                                                                </div>
                                                                            )}
                                                                            {lesson.selectionMode === 'BY_DIFFICULTY' && (
                                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[12px] font-bold text-emerald-600">Easy</span>
                                                                                        <input type="number" min="0" max={bank.EASY} value={lesson.selectionEasy ?? 0}
                                                                                            onChange={e => updateLesson(sIdx, lIdx, 'selectionEasy', e.target.value)} className={NumInput} />
                                                                                        <span className="text-[11px] font-bold text-muted-foreground/60">/{bank.EASY}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[12px] font-bold text-amber-600">Medium</span>
                                                                                        <input type="number" min="0" max={bank.MEDIUM} value={lesson.selectionMedium ?? 0}
                                                                                            onChange={e => updateLesson(sIdx, lIdx, 'selectionMedium', e.target.value)} className={NumInput} />
                                                                                        <span className="text-[11px] font-bold text-muted-foreground/60">/{bank.MEDIUM}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[12px] font-bold text-rose-600">Hard</span>
                                                                                        <input type="number" min="0" max={bank.HARD} value={lesson.selectionHard ?? 0}
                                                                                            onChange={e => updateLesson(sIdx, lIdx, 'selectionHard', e.target.value)} className={NumInput} />
                                                                                        <span className="text-[11px] font-bold text-muted-foreground/60">/{bank.HARD}</span>
                                                                                    </div>
                                                                                    <span className="text-[12px] font-extrabold text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-lg">
                                                                                        = {(parseInt(lesson.selectionEasy, 10) || 0) + (parseInt(lesson.selectionMedium, 10) || 0) + (parseInt(lesson.selectionHard, 10) || 0)} per attempt
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {(lesson.questions || []).length === 0 ? (
                                                                <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-3xl">
                                                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                                                        <HelpCircle size={32} className="text-muted-foreground/30" />
                                                                    </div>
                                                                    <h5 className="text-foreground font-bold mb-1">No Questions Yet</h5>
                                                                    <p className="text-muted-foreground text-[13px] max-w-[280px] mx-auto font-medium">Add some multiple-choice or fill-in-the-blank questions to test your students' knowledge.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-6">
                                                                    {(lesson.questions || []).map((q, qIdx) => (
                                                                        <div key={q.id} className="group relative bg-card border border-border rounded-3xl p-6 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-100/50 transition-all duration-300">
                                                                            <div className="absolute -left-3 top-6 w-8 h-8 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-purple-200 border-2 border-white">
                                                                                {qIdx + 1}
                                                                            </div>

                                                                            <button type="button" onClick={() => deleteLessonQuestion(sIdx, lIdx, qIdx)} className="absolute -right-3 -top-3 w-8 h-8 bg-card text-muted-foreground/60 hover:text-rose-600 rounded-full flex items-center justify-center shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <Trash2 size={14} />
                                                                            </button>

                                                                            <div className="space-y-5 ml-2">
                                                                                <div className="flex flex-col md:flex-row gap-4">
                                                                                    <div className="md:w-1/4">
                                                                                        <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Question Type</label>
                                                                                        <select value={q.type} onChange={e => updateLessonQuestion(sIdx, lIdx, qIdx, 'type', e.target.value)} className="w-full bg-muted/40 border-0 rounded-xl px-4 py-3 text-[13px] font-bold text-foreground/80 outline-none focus:ring-2 focus:ring-purple-100 transition-all">
                                                                                            <option value="MCQ_SINGLE">Single Choice</option>
                                                                                            <option value="MCQ_MULTI">Multiple Choice</option>
                                                                                            <option value="FILL_BLANK">Fill in the Blank</option>
                                                                                        </select>
                                                                                    </div>
                                                                                    <div className="md:w-1/5">
                                                                                        <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Difficulty</label>
                                                                                        <select
                                                                                            value={q.difficulty || 'MEDIUM'}
                                                                                            onChange={e => updateLessonQuestion(sIdx, lIdx, qIdx, 'difficulty', e.target.value)}
                                                                                            className={`w-full border-0 rounded-xl px-4 py-3 text-[13px] font-bold outline-none focus:ring-2 focus:ring-purple-100 transition-all ${(q.difficulty || 'MEDIUM') === 'EASY' ? 'bg-emerald-50 text-emerald-700' : (q.difficulty || 'MEDIUM') === 'HARD' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}
                                                                                        >
                                                                                            <option value="EASY">Easy</option>
                                                                                            <option value="MEDIUM">Medium</option>
                                                                                            <option value="HARD">Hard</option>
                                                                                        </select>
                                                                                    </div>
                                                                                    <div className="flex-1">
                                                                                        <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Question Prompt</label>
                                                                                        <input type="text" value={q.text} onChange={e => updateLessonQuestion(sIdx, lIdx, qIdx, 'text', e.target.value)} className="w-full bg-muted border-0 rounded-xl px-4 py-3 text-[14px] font-bold text-foreground outline-none focus:bg-card focus:ring-2 focus:ring-purple-100 transition-all" placeholder="Ask your question here..." />
                                                                                    </div>
                                                                                </div>

                                                                                {q.type.includes('MCQ') && (
                                                                                    <div className="pt-2">
                                                                                        <label className="text-[11px] font-extrabold text-purple-600 uppercase tracking-widest mb-3 block ml-1">Options & Correct Answers</label>
                                                                                        <div className="grid gap-3">
                                                                                            {q.options.map((opt, oIdx) => (
                                                                                                <div key={oIdx} className="group/opt flex items-center gap-3">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => toggleCorrectOptionInline(sIdx, lIdx, qIdx, oIdx)}
                                                                                                        className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${q.correctAnswers.includes(oIdx) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-muted text-transparent hover:bg-muted group-hover/opt:text-muted-foreground/30'}`}
                                                                                                    >
                                                                                                        <CheckCircle size={20} />
                                                                                                    </button>
                                                                                                    <div className="flex-1 relative">
                                                                                                        <input
                                                                                                            type="text"
                                                                                                            value={opt}
                                                                                                            onChange={e => updateQuestionOption(sIdx, lIdx, qIdx, oIdx, e.target.value)}
                                                                                                            className={`w-full border-0 rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition-all ${q.correctAnswers.includes(oIdx) ? 'bg-emerald-50 text-emerald-900 selection:bg-emerald-200' : 'bg-muted/40 text-foreground/80 hover:bg-muted focus:bg-card focus:ring-2 focus:ring-purple-100'}`}
                                                                                                            placeholder={`Option ${oIdx + 1}`}
                                                                                                        />
                                                                                                        <button type="button" onClick={() => removeQuestionOption(sIdx, lIdx, qIdx, oIdx)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground/30 hover:text-rose-500 transition-colors opacity-0 group-hover/opt:opacity-100"><Trash2 size={16} /></button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                            <button type="button" onClick={() => addQuestionOption(sIdx, lIdx, qIdx)} className="w-full h-11 border-2 border-dashed border-border hover:border-purple-300 hover:bg-purple-50 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-extrabold text-muted-foreground/60 hover:text-purple-600 transition-all mt-1">
                                                                                                <Plus size={16} /> ADD ANOTHER OPTION
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {q.type === 'FILL_BLANK' && (
                                                                                    <div className="bg-muted/40 rounded-2xl p-4 border border-border">
                                                                                        <label className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2 ml-1">Acceptable Correct Answer</label>
                                                                                        <input type="text" value={q.correctAnswers[0] || ''} onChange={e => {
                                                                                            const newCurr = [...curriculum];
                                                                                            newCurr[sIdx].lessons[lIdx].questions[qIdx].correctAnswers = [e.target.value];
                                                                                            setCurriculum(newCurr);
                                                                                        }} className="w-full bg-card border-0 rounded-xl px-4 py-3 text-[14px] font-bold text-foreground focus:ring-2 focus:ring-purple-100 outline-none shadow-sm" placeholder="e.g., React Context API" />
                                                                                        <p className="text-[10px] text-muted-foreground/60 font-bold mt-2 ml-1 uppercase">Note: Answer comparison is case-insensitive and ignores leading/trailing whitespace.</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addLesson(sIdx)} className="ml-8 mt-3 text-[13px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1.5 py-2 px-4 rounded-lg transition-colors shadow-sm">
                                            <Plus size={16} /> Add Lesson
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Metadata */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-foreground mb-6">Course Metadata</h2>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Tags (comma separated)</label>
                            <input type="text" name="tags" value={formData.tags} onChange={handleChange} className={InputClass} placeholder="React, Frontend, Web Dev" />
                        </div>
                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Prerequisites (comma separated)</label>
                            <input type="text" name="prerequisites" value={formData.prerequisites} onChange={handleChange} className={InputClass} placeholder="Basic JavaScript, HTML/CSS" />
                        </div>
                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Learning Outcomes (one per line)</label>
                            <textarea name="learningOutcomes" value={formData.learningOutcomes} onChange={handleChange} className={`${InputClass} min-h-[120px]`} placeholder="Build functional React applications&#10;Understand state management" />
                        </div>
                    </div>
                </div>

                {/* Drip Content Schedule */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2"><Clock size={20} className="text-amber-600" /> Drip Content Schedule</h2>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Release Mode</label>
                            <select name="dripMode" value={formData.dripMode} onChange={handleChange} className={InputClass}>
                                <option value="none">No Drip — All content available immediately</option>
                                <option value="absolute">Absolute Dates — Release on specific dates</option>
                                <option value="relative">Relative — Release X days after enrollment</option>
                                <option value="both">Both — Use the later of absolute date and relative delay</option>
                            </select>
                            <p className="text-[11px] text-muted-foreground/70 font-medium mt-2">
                                {formData.dripMode === 'none' && 'Students can access all lessons immediately upon enrollment.'}
                                {formData.dripMode === 'absolute' && 'Set a specific release date for each lesson. Students can only access lessons whose release date has passed.'}
                                {formData.dripMode === 'relative' && 'Lessons unlock X days after each student enrolls. Perfect for cohort-based courses.'}
                                {formData.dripMode === 'both' && 'Lessons unlock when BOTH conditions are met: the release date has passed AND the relative delay has elapsed.'}
                            </p>
                        </div>
                        {formData.dripMode !== 'none' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                                <strong>📅 Schedule per lesson:</strong> Go to the Curriculum Builder above and set the release date or delay days for each lesson. Lessons without a schedule are available immediately.
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4 sticky bottom-0 bg-card/90 backdrop-blur-md p-5 rounded-2xl z-10 border border-border shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                    <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 rounded-xl text-[14px] font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted transition-colors">
                        Cancel
                    </button>
                    <div className="flex-1" />
                    <button type="button" onClick={(e) => handleSubmit(e, 'DRAFT')} disabled={saving} className="px-6 py-3 rounded-xl text-[14px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={18} /> {saving ? 'Saving...' : 'Save as Draft'}
                    </button>
                    <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl text-[14px] font-bold text-white flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <CheckCircle size={18} /> {saving ? 'Saving...' : editId ? 'Save Changes' : 'Submit for Approval'}
                    </button>
                </div>
            </form>
        </div>
    );
}
