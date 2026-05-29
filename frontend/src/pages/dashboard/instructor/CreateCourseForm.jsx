import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Upload, Plus, Trash2, GripVertical, CheckCircle, Video, FileText, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
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
            coursesAPI.getById(editId).then(course => {
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
                toast.success('Loaded course details. Curriculum structure is ready to be edited!');
            }).catch(() => {
                toast.error('Course not found');
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
            id: `q${Date.now()}`,
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

            if (editId) {
                await coursesAPI.update(editId, dbFormat);
                toast.success(`Course updated successfully!`);
            } else {
                const newCourse = await coursesAPI.create(dbFormat);
                const courseId = newCourse.id;

                // Create curriculum iteratively
                for (let sIdx = 0; sIdx < curriculum.length; sIdx++) {
                    const section = curriculum[sIdx];
                    const secRes = await coursesAPI.createSection(courseId, { title: section.title, order: sIdx + 1 });
                    const sectionId = secRes.id;

                    for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
                        const lesson = section.lessons[lIdx];
                        const lessonRes = await coursesAPI.createLesson(courseId, {
                            section_id: sectionId,
                            title: lesson.title,
                            type: lesson.type,
                            content_url: lesson.contentUrl || '',
                            duration: lesson.duration || '',
                            preview: lesson.preview || false,
                            order: lIdx + 1
                        });

                        if (lesson.type === 'quiz' && lesson.questions && lesson.questions.length > 0) {
                            const formattedQuestions = lesson.questions.map(q => ({
                                id: q.id,
                                text: q.text,
                                type: q.type,
                                options: q.options,
                                correctAnswer: q.type === 'FILL_BLANK' ? (q.correctAnswers[0] || '') : q.correctAnswers[0]
                            }));

                            await quizzesAPI.createQuiz({
                                courseId: courseId,
                                lessonId: lessonRes.id,
                                title: lesson.title,
                                instructions: 'Please complete this quiz to proceed.',
                                passingScore: 70,
                                timeLimit: 30,
                                questions: formattedQuestions
                            });
                        }
                    }
                }
                toast.success(`Course created successfully and is pending approval!`);
            }
            navigate('/instructor/courses');
        } catch (err) {
            toast.error('Failed to save course: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && editId) return <div className="p-8 text-center text-gray-500">Loading course data...</div>;

    const InputClass = "w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow";

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                    {editId ? 'Edit Course Details' : 'Create New Course'}
                </h1>
                <p className="text-slate-500 font-medium">Design your curriculum and manage media</p>
            </div>

            <form className="space-y-8" onSubmit={(e) => handleSubmit(e, 'PENDING')}>

                {/* Basic Info */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><CheckCircle size={20} className="text-indigo-600" /> Basic Information</h2>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Course Title *</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} className={InputClass} placeholder="e.g. Advanced JavaScript Masterclass" required />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Category *</label>
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
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Difficulty Level</label>
                                <select name="level" value={formData.level} onChange={handleChange} className={InputClass}>
                                    <option value="Beginner">Beginner</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Advanced">Advanced</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Course Description *</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} className={`${InputClass} min-h-[120px] resize-y`} placeholder="Describe what students will learn..." required />
                        </div>
                    </div>
                </div>

                {/* Media & Pricing */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><ImageIcon size={20} className="text-cyan-600" /> Thumbnail & Pricing</h2>
                    <div className="space-y-6">

                        {/* Thumbnail Upload */}
                        <div>
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-3">Course Thumbnail</label>
                            <div className="flex gap-6 items-start">
                                <div
                                    className="w-64 h-36 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-indigo-300 transition-colors overflow-hidden relative group shadow-sm"
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
                                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3">
                                                <ImageIcon size={20} className="text-slate-400" />
                                            </div>
                                            <p className="text-[13px] font-bold text-slate-500 leading-tight">Click to upload image<br />(Max 5MB)</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <p className="text-[13px] font-semibold text-slate-600 leading-relaxed">
                                        Upload your course image here. It must meet our course image quality standards to be accepted.<br /><br />
                                        Important guidelines: 750x422 pixels; .jpg, .jpeg,. gif, or .png. No text on the image.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-5 border-t border-slate-100 pt-6">
                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Est. Total Duration</label>
                                <input type="text" name="duration" value={formData.duration} onChange={handleChange} className={InputClass} placeholder="e.g. 10 hours" />
                            </div>
                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Regular Price (₹)</label>
                                <input type="number" name="price" value={formData.price} onChange={handleChange} className={InputClass} min="0" />
                            </div>
                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Discount Price (₹)</label>
                                <input type="number" name="discountPrice" value={formData.discountPrice} onChange={handleChange} className={InputClass} min="0" />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5 pt-2">
                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Required Plan</label>
                                <select name="requiredPlan" value={formData.requiredPlan} onChange={handleChange} className={InputClass}>
                                    <option value="FREE">Free for all</option>
                                    <option value="BASIC">Basic Plan & above</option>
                                    <option value="PRO">Pro Plan & above</option>
                                    <option value="ENTERPRISE">Enterprise only</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-8">
                                <input type="checkbox" id="cert" name="certificate" checked={formData.certificate} onChange={handleChange} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                                <label htmlFor="cert" className="text-[14px] font-semibold text-slate-700 cursor-pointer">Offer Certificate on completion</label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Curriculum Builder */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Video size={20} className="text-purple-600" /> Curriculum Builder</h2>
                        <button type="button" onClick={addSection} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
                            <Plus size={16} /> Add Module
                        </button>
                    </div>

                    <div className="space-y-5">
                        {curriculum.map((section, sIdx) => (
                            <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                                    <GripVertical size={18} className="text-slate-400 cursor-move" />
                                    <span className="font-bold text-slate-700">Module {sIdx + 1}:</span>
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={e => updateSection(sIdx, 'title', e.target.value)}
                                        className="flex-1 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 rounded-lg outline-none text-slate-900 px-3 py-1.5 font-bold shadow-sm"
                                        placeholder="Enter module title..."
                                    />
                                    <button type="button" onClick={() => deleteSection(sIdx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                    <button type="button" onClick={() => updateSection(sIdx, 'isExpanded', !section.isExpanded)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                        {section.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>

                                {section.isExpanded && (
                                    <div className="p-5 space-y-4 bg-white">
                                        {section.lessons.map((lesson, lIdx) => (
                                            <div key={lesson.id} className="ml-8 border border-slate-200 bg-slate-50/50 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <GripVertical size={16} className="text-slate-400 cursor-move" />
                                                    <select
                                                        value={lesson.type}
                                                        onChange={e => updateLesson(sIdx, lIdx, 'type', e.target.value)}
                                                        className="bg-white shadow-sm text-[13px] font-bold rounded-lg border border-slate-200 text-slate-700 px-3 py-2 outline-none focus:border-indigo-500 w-36"
                                                    >
                                                        <option value="video">Video</option>
                                                        <option value="lecture">Document/Text</option>
                                                        <option value="quiz">Quiz</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={lesson.title}
                                                        onChange={e => updateLesson(sIdx, lIdx, 'title', e.target.value)}
                                                        className="flex-1 bg-white shadow-sm border border-slate-200 focus:border-indigo-500 outline-none text-[14px] font-bold text-slate-900 px-3 py-2 rounded-lg"
                                                        placeholder="Lesson title..."
                                                    />
                                                    <input
                                                        type="text"
                                                        value={lesson.duration}
                                                        onChange={e => updateLesson(sIdx, lIdx, 'duration', e.target.value)}
                                                        className="w-24 bg-white shadow-sm border border-slate-200 focus:border-indigo-500 outline-none text-[13px] font-semibold text-slate-600 px-3 py-2 rounded-lg text-center"
                                                        placeholder="e.g 4:30"
                                                    />
                                                    <button type="button" onClick={() => deleteLesson(sIdx, lIdx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                </div>

                                                <div className="ml-7 flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                    {lesson.type !== 'quiz' ? (
                                                        <div className="flex-1 flex flex-col gap-4">
                                                            <div>
                                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Content Source / Upload</label>
                                                                <div className="flex flex-wrap gap-3 items-center">
                                                                    <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-[13px] text-slate-700 font-bold flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors">
                                                                        <Upload size={14} className="text-indigo-600" /> Upload File
                                                                        <input type="file" className="hidden" onChange={(e) => handleLessonFileUpload(e, sIdx, lIdx)} accept={lesson.type === 'video' ? 'video/*' : 'application/pdf,.doc,.docx'} />
                                                                    </label>
                                                                    <span className="text-[11px] font-bold text-slate-400">OR</span>
                                                                    <input
                                                                        type="text"
                                                                        value={lesson.contentUrl || ''}
                                                                        onChange={e => updateLesson(sIdx, lIdx, 'contentUrl', e.target.value)}
                                                                        className="flex-1 min-w-[200px] bg-white border border-slate-200 shadow-sm text-[13px] rounded-lg px-3 py-2 text-slate-900 disabled:opacity-50 disabled:bg-slate-50 focus:border-indigo-500 outline-none"
                                                                        placeholder={lesson.fileName ? `Uploaded: ${lesson.fileName}` : "Enter external link (YouTube, Vimeo, PDF URL)"}
                                                                        disabled={!!lesson.fileName}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={lesson.preview}
                                                                    onChange={e => updateLesson(sIdx, lIdx, 'preview', e.target.checked)}
                                                                    id={`prev-${lesson.id}`}
                                                                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                                                />
                                                                <label htmlFor={`prev-${lesson.id}`} className="text-[13px] font-semibold text-slate-600 cursor-pointer">Free Preview (Allow guests to view)</label>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 w-full space-y-4">
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                                <label className="text-[13px] text-indigo-600 uppercase font-bold flex items-center gap-2">
                                                                    <FileText size={16} /> Quiz Questions Configurator
                                                                </label>
                                                                <button type="button" onClick={() => addLessonQuestion(sIdx, lIdx)} className="text-[12px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
                                                                    <Plus size={14} /> Add Question
                                                                </button>
                                                            </div>

                                                            {(lesson.questions || []).length === 0 ? (
                                                                <p className="text-[13px] text-slate-500 text-center py-6 font-medium">No questions added yet. Click 'Add Question' to start building this quiz assessment.</p>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {(lesson.questions || []).map((q, qIdx) => (
                                                                        <div key={q.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4 relative">
                                                                            <button type="button" onClick={() => deleteLessonQuestion(sIdx, lIdx, qIdx)} className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 bg-white p-1 rounded-md shadow-sm border border-slate-100"><Trash2 size={14} /></button>
                                                                            <div className="flex flex-col sm:flex-row gap-3 w-full pr-8">
                                                                                <select value={q.type} onChange={e => updateLessonQuestion(sIdx, lIdx, qIdx, 'type', e.target.value)} className="bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-2.5 text-[12px] font-bold uppercase text-slate-700 outline-none w-max focus:border-indigo-500">
                                                                                    <option value="MCQ_SINGLE">Single Choice</option>
                                                                                    <option value="MCQ_MULTI">Multiple Choice</option>
                                                                                    <option value="FILL_BLANK">Fill Blank</option>
                                                                                </select>
                                                                                <input type="text" value={q.text} onChange={e => updateLessonQuestion(sIdx, lIdx, qIdx, 'text', e.target.value)} className="flex-1 bg-white shadow-sm border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] font-bold text-slate-900 outline-none focus:border-indigo-500" placeholder="Enter question text..." />
                                                                            </div>

                                                                            {q.type.includes('MCQ') && (
                                                                                <div className="space-y-3 bg-white p-3 rounded-lg border border-slate-100">
                                                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Options & Correct Answer</label>
                                                                                    {q.options.map((opt, oIdx) => (
                                                                                        <div key={oIdx} className="flex items-center gap-3">
                                                                                            <button type="button" onClick={() => toggleCorrectOptionInline(sIdx, lIdx, qIdx, oIdx)} className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[12px] transition-colors shadow-sm ${q.correctAnswers.includes(oIdx) ? 'bg-emerald-500 text-white border border-emerald-600' : 'bg-slate-50 border border-slate-200 text-transparent hover:border-indigo-300'}`}>✓</button>
                                                                                            <input type="text" value={opt} onChange={e => updateQuestionOption(sIdx, lIdx, qIdx, oIdx, e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-[13px] font-medium text-slate-900 outline-none transition-colors" placeholder={`Option ${oIdx + 1}`} />
                                                                                            <button type="button" onClick={() => removeQuestionOption(sIdx, lIdx, qIdx, oIdx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
                                                                                        </div>
                                                                                    ))}
                                                                                    <button type="button" onClick={() => addQuestionOption(sIdx, lIdx, qIdx)} className="text-[12px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 mt-2 inline-flex"><Plus size={14} /> Add Choice</button>
                                                                                </div>
                                                                            )}

                                                                            {q.type === 'FILL_BLANK' && (
                                                                                <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-100">
                                                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Exact Text Match</label>
                                                                                    <input type="text" value={q.correctAnswers[0] || ''} onChange={e => {
                                                                                        const newCurr = [...curriculum];
                                                                                        newCurr[sIdx].lessons[lIdx].questions[qIdx].correctAnswers = [e.target.value];
                                                                                        setCurriculum(newCurr);
                                                                                    }} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none" placeholder="Valid correct answer..." />
                                                                                </div>
                                                                            )}
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
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Course Metadata</h2>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Tags (comma separated)</label>
                            <input type="text" name="tags" value={formData.tags} onChange={handleChange} className={InputClass} placeholder="React, Frontend, Web Dev" />
                        </div>
                        <div>
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Prerequisites (comma separated)</label>
                            <input type="text" name="prerequisites" value={formData.prerequisites} onChange={handleChange} className={InputClass} placeholder="Basic JavaScript, HTML/CSS" />
                        </div>
                        <div>
                            <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Learning Outcomes (one per line)</label>
                            <textarea name="learningOutcomes" value={formData.learningOutcomes} onChange={handleChange} className={`${InputClass} min-h-[120px]`} placeholder="Build functional React applications&#10;Understand state management" />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4 sticky bottom-0 bg-white/90 backdrop-blur-md p-5 rounded-2xl z-10 border border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                    <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 rounded-xl text-[14px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors">
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
