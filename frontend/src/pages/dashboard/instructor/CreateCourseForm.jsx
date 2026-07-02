import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Upload, Plus, Trash2, GripVertical, CheckCircle, Video, FileText, Image as ImageIcon, ChevronDown, ChevronUp, HelpCircle, Clock, Award, Play } from 'lucide-react';
import { coursesAPI, statsAPI, quizzesAPI, uploadAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function CreateCourseForm() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const editId = params.get('edit');

    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);

    const [formData, setFormData] = useState({
        title: '', description: '', categoryId: '', customCategory: '', level: 'Beginner',
        price: 0, discountPrice: 0, duration: '',
        requiredPlan: 'FREE', certificate: true,
        tags: '', prerequisites: '', learningOutcomes: ''
    });

    const [thumbnailPreview, setThumbnailPreview] = useState('');
    const thumbnailInputRef = useRef(null);

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
            setLoading(true);
            Promise.all([
                coursesAPI.getById(editId),
                coursesAPI.getLessons(editId)
            ]).then(([course, curriculumData]) => {
                setFormData({
                    title: course.title || '',
                    description: course.description || '',
                    categoryId: course.categoryId || '',
                    customCategory: '',
                    level: course.level || 'Beginner',
                    price: course.price || 0,
                    discountPrice: course.discountPrice || 0,
                    duration: course.duration || '',
                    requiredPlan: course.requiredPlan || 'FREE',
                    certificate: course.certificate ?? true,
                    tags: course.tags?.join(', ') || '',
                    prerequisites: course.prerequisites?.join(', ') || '',
                    learningOutcomes: course.learningOutcomes?.join('\n') || ''
                });
                setThumbnailPreview(course.thumbnail || '');

                // Map curriculum data for the UI
                if (curriculumData.sections && curriculumData.sections.length > 0) {
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
                                preview: l.preview
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
        newCurr[secIdx].lessons.splice(lessIdx, 1);
        setCurriculum(newCurr);
    };

    const handleLessonFileUpload = async (e, secIdx, lessIdx) => {
        const file = e.target.files[0];
        if (file) {
            const loadToast = toast.loading(`Uploading ${file.name} to Cloudinary...`);
            try {
                const res = await uploadAPI.uploadMedia(file);
                updateLesson(secIdx, lessIdx, 'contentUrl', res.url);
                updateLesson(secIdx, lessIdx, 'fileName', file.name);
                toast.success(`File ${file.name} uploaded successfully!`, { id: loadToast });
            } catch (err) {
                toast.error('Upload failed: ' + err.message, { id: loadToast });
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
            options: ['', ''],
            correctAnswers: [0]
        });
        setCurriculum(newCurr);
    };

    const updateLessonQuestion = (sIdx, lIdx, qIdx, field, value) => {
        const newCurr = [...curriculum];
        newCurr[sIdx].lessons[lIdx].questions[qIdx][field] = value;
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

    const handleSubmit = async (e, type = 'PUBLISHED') => {
        e.preventDefault();
        if (!formData.title || (!formData.categoryId && !formData.customCategory) || !formData.description) {
            toast.error('Please fill in all required fields (Title, Category, Description)');
            return;
        }

        if (curriculum.length === 0 || curriculum.some(s => !s.title || s.lessons.length === 0)) {
            toast.error('Please ensure all modules have a title and at least one lesson.');
            return;
        }

        setLoading(true);
        try {
            const dbFormat = {
                title: formData.title,
                description: formData.description,
                short_desc: '',
                category_id: formData.categoryId === 'custom' ? null : formData.categoryId,
                level: formData.level,
                duration: formData.duration,
                thumbnail: thumbnailPreview || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
                price: Number(formData.price),
                discount_price: Number(formData.discountPrice),
                certificate: formData.certificate,
                required_plan: formData.requiredPlan,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                requirements: formData.prerequisites.split(',').map(t => t.trim()).filter(Boolean),
                what_you_learn: formData.learningOutcomes.split('\n').filter(Boolean),
                status: type === 'DRAFT' ? 'DRAFT' : 'PENDING'
            };

            let targetCourseId = editId;
            if (editId) {
                await coursesAPI.update(editId, dbFormat);
            } else {
                const newCourse = await coursesAPI.create(dbFormat);
                targetCourseId = newCourse.id;
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

                    // Handle Quizzes (simplified for now: always update/create if type is quiz)
                    if (lesson.type === 'quiz' && lesson.questions && lesson.questions.length > 0) {
                        const formattedQuestions = lesson.questions.map(q => ({
                            id: q.id,
                            text: q.text,
                            type: q.type,
                            options: q.options || [],
                            correctAnswer: q.type === 'FILL_BLANK'
                                ? (q.correctAnswers[0] || '')
                                : q.type === 'MCQ_MULTI'
                                    ? q.correctAnswers.map(index => q.options[index])
                                    : q.options[q.correctAnswers[0]]
                        }));

                        await quizzesAPI.createQuiz({
                            courseId: targetCourseId,
                            lessonId: lessonId,
                            title: lesson.title,
                            instructions: 'Please complete this quiz to proceed.',
                            passingScore: 70,
                            timeLimit: 30,
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
            setLoading(false);
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

                {/* Media & Pricing */}
                <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-cyan-600" /> Thumbnail & Pricing</h2>
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

                        <div className="grid sm:grid-cols-3 gap-5 border-t border-border pt-6">
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Est. Total Duration</label>
                                <input type="text" name="duration" value={formData.duration} onChange={handleChange} className={InputClass} placeholder="e.g. 10 hours" />
                            </div>
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Regular Price (₹)</label>
                                <input type="number" name="price" value={formData.price} onChange={handleChange} className={InputClass} min="0" />
                            </div>
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Discount Price (₹)</label>
                                <input type="number" name="discountPrice" value={formData.discountPrice} onChange={handleChange} className={InputClass} min="0" />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5 pt-2">
                            <div>
                                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">Required Plan</label>
                                <select name="requiredPlan" value={formData.requiredPlan} onChange={handleChange} className={InputClass}>
                                    <option value="FREE">Free for all</option>
                                    <option value="BASIC">Basic Plan & above</option>
                                    <option value="PRO">Pro Plan & above</option>
                                    <option value="ENTERPRISE">Enterprise only</option>
                                </select>
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
                                                            {lesson.type === 'quiz' && <HelpCircle size={18} />}
                                                            {lesson.type === 'lecture' && <FileText size={18} />}
                                                        </div>
                                                        <select
                                                            value={lesson.type}
                                                            onChange={e => updateLesson(sIdx, lIdx, 'type', e.target.value)}
                                                            className="bg-muted/40 border-0 text-[13px] font-bold rounded-lg text-foreground/80 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 w-32 md:w-36 transition-all"
                                                        >
                                                            <option value="video">Video</option>
                                                            <option value="lecture">Document</option>
                                                            <option value="quiz">Quiz</option>
                                                        </select>
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
                                                                        {lesson.fileName && <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1 ml-1"><CheckCircle size={12} /> {lesson.fileName} ready for upload</p>}
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
                                                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                                                <div>
                                                                    <h4 className="text-purple-900 font-extrabold text-sm flex items-center gap-2">
                                                                        <Award size={18} /> SMART ASSESSMENT BUILDER
                                                                    </h4>
                                                                    <p className="text-purple-600 text-[11px] font-bold mt-1 uppercase tracking-wider">Configure questions, options, and passing criteria</p>
                                                                </div>
                                                                <button type="button" onClick={() => addLessonQuestion(sIdx, lIdx)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-[13px] shadow-lg shadow-purple-200 transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                                                                    <Plus size={16} /> ADD QUESTION
                                                                </button>
                                                            </div>

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
                                                                                    <div className="md:w-1/3">
                                                                                        <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5 block ml-1">Question Type</label>
                                                                                        <select value={q.type} onChange={e => updateLessonQuestion(sIdx, lIdx, qIdx, 'type', e.target.value)} className="w-full bg-muted/40 border-0 rounded-xl px-4 py-3 text-[13px] font-bold text-foreground/80 outline-none focus:ring-2 focus:ring-purple-100 transition-all">
                                                                                            <option value="MCQ_SINGLE">Single Choice</option>
                                                                                            <option value="MCQ_MULTI">Multiple Choice</option>
                                                                                            <option value="FILL_BLANK">Fill in the Blank</option>
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

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4 sticky bottom-0 bg-card/90 backdrop-blur-md p-5 rounded-2xl z-10 border border-border shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                    <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 rounded-xl text-[14px] font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted transition-colors">
                        Cancel
                    </button>
                    <div className="flex-1" />
                    <button type="button" onClick={(e) => handleSubmit(e, 'DRAFT')} disabled={loading} className="px-6 py-3 rounded-xl text-[14px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-2">
                        <Save size={18} /> Save as Draft
                    </button>
                    <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl text-[14px] font-bold text-white flex items-center gap-2 shadow-sm transition-colors">
                        <CheckCircle size={18} /> {editId ? 'Save Changes' : 'Submit for Approval'}
                    </button>
                </div>
            </form>
        </div>
    );
}
