import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    GraduationCap, CheckCircle, Users, BookOpen, DollarSign,
    Star, ArrowRight, Zap, Globe, Award, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import toast from 'react-hot-toast';

const BENEFITS = [
    { icon: DollarSign, color: '#16a34a', bg: '#dcfce7', title: 'Earn Revenue', desc: 'Get up to 70% revenue share on every course sale. Build a passive income stream.' },
    { icon: Users, color: '#4f46e5', bg: '#e0e7ff', title: 'Reach Thousands', desc: 'Publish to our platform with 15,000+ active learners across 50+ countries.' },
    { icon: BookOpen, color: '#0891b2', bg: '#cffafe', title: 'Powerful Tools', desc: 'Use our curriculum builder, quiz maker, and analytics dashboard to create world-class courses.' },
    { icon: Star, color: '#d97706', bg: '#fef3c7', title: 'Build Your Brand', desc: 'Get a verified instructor badge and your own profile page to grow your reputation.' },
    { icon: Globe, color: '#7c3aed', bg: '#ede9fe', title: 'Flexible Schedule', desc: 'Teach at your own pace. Upload content whenever you want, from anywhere.' },
    { icon: Award, color: '#e11d48', bg: '#ffe4e6', title: 'Certificates', desc: 'Your students earn certificates, driving more enrollments through social sharing.' },
];

const REQUIREMENTS = [
    'Expertise in at least one subject area',
    'Ability to create high-quality video content',
    'Commitment to respond to student questions within 48 hours',
    'Agree to our Instructor Agreement and Code of Conduct',
];

const FAQS = [
    { q: 'How long does approval take?', a: 'Our team reviews applications within 2–3 business days. You\'ll receive an email with the decision.' },
    { q: 'How much can I earn?', a: 'Instructors earn up to 70% of course revenue. Top instructors on our platform earn ₹1,00,000+ per month.' },
    { q: 'Can I still be a student?', a: 'Yes! Your enrollments and progress stay on your account. After approval you teach as an instructor; use a separate student account if you also want the student learning dashboard.' },
    { q: 'What equipment do I need?', a: 'A decent microphone and screen recording software is a good start. We provide guides on production best practices.' },
];

export default function BecomeInstructorPage() {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);
    const [form, setForm] = useState({
        bio: '',
        expertise: '',
        experience: '',
        linkedin: '',
        youtube: '',
        sampleTopic: '',
        agree: false,
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.error('Please sign in to submit your application.');
            navigate('/login', { state: { from: '/become-instructor' } });
            return;
        }
        if (user.role === 'INSTRUCTOR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
            toast.error('You already have instructor access.');
            navigate('/instructor');
            return;
        }
        if (!form.bio || !form.expertise || !form.experience || !form.sampleTopic) {
            toast.error('Please fill in all required fields.');
            return;
        }
        if (!form.agree) {
            toast.error('You must agree to the Instructor Agreement.');
            return;
        }
        setLoading(true);
        try {
            await usersAPI.submitInstructorRequest(form);
            setStep(3);
        } catch (error) {
            toast.error(error.message || 'Failed to submit application.');
        } finally {
            setLoading(false);
        }
    };

    const inputCls = 'w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition-shadow text-sm font-medium';

    if (step === 3) {
        return (
            <div className="max-w-xl mx-auto py-20 text-center px-4">
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-emerald-200">
                    <CheckCircle size={40} className="text-emerald-600" />
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Application Submitted!</h1>
                <p className="text-slate-500 text-lg font-medium mb-3">
                    Thanks for applying, <strong className="text-slate-700">{user?.name?.split(' ')[0]}</strong>!
                </p>
                <p className="text-slate-500 mb-10">
                    Our team will review your application and send a decision to <strong className="text-slate-700">{user?.email}</strong> within 2–3 business days.
                </p>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 text-left">
                    <h3 className="text-indigo-900 font-bold mb-3">What happens next?</h3>
                    <ul className="space-y-2 text-sm text-indigo-700 font-medium">
                        <li className="flex items-center gap-2"><CheckCircle size={14} /> Application review (2–3 days)</li>
                        <li className="flex items-center gap-2"><CheckCircle size={14} /> Receive approval email</li>
                        <li className="flex items-center gap-2"><CheckCircle size={14} /> Access instructor dashboard</li>
                        <li className="flex items-center gap-2"><CheckCircle size={14} /> Create and publish your first course</li>
                    </ul>
                </div>
                <button
                    onClick={() => navigate('/student')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-10">
            {/* Hero */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-10 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6">
                            <Zap size={14} fill="currentColor" /> Instructor Program
                        </div>
                        <h1 className="text-4xl font-extrabold mb-4 tracking-tight leading-tight">
                            Share Your Knowledge,<br />Earn While You Teach
                        </h1>
                        <p className="text-white/80 text-lg font-medium max-w-lg">
                            Join 1,800+ instructors teaching on EduNexus. Create courses, build your audience, and earn revenue doing what you love.
                        </p>
                    </div>
                    <div className="flex flex-col gap-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex-shrink-0 min-w-[220px]">
                        <div className="text-center">
                            <p className="text-4xl font-extrabold">₹1L+</p>
                            <p className="text-white/70 text-sm font-medium">Top monthly earnings</p>
                        </div>
                        <div className="border-t border-white/20 pt-4 text-center">
                            <p className="text-3xl font-extrabold">15K+</p>
                            <p className="text-white/70 text-sm font-medium">Active students</p>
                        </div>
                        <div className="border-t border-white/20 pt-4 text-center">
                            <p className="text-3xl font-extrabold">70%</p>
                            <p className="text-white/70 text-sm font-medium">Revenue share</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Benefits */}
            <div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-6 tracking-tight">Why Teach on EduNexus?</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {BENEFITS.map(({ icon: Icon, color, bg, title, desc }) => (
                        <div key={title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: bg }}>
                                <Icon size={22} style={{ color }} />
                            </div>
                            <h3 className="text-slate-900 font-bold text-base mb-2">{title}</h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Application form or requirements */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Requirements */}
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-slate-900 font-bold mb-4 flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-600" /> Requirements
                        </h3>
                        <ul className="space-y-3">
                            {REQUIREMENTS.map(r => (
                                <li key={r} className="flex items-start gap-2.5 text-sm text-slate-600 font-medium">
                                    <CheckCircle size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* FAQ */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-slate-900 font-bold mb-4">FAQs</h3>
                        <div className="space-y-3">
                            {FAQS.map((faq, i) => (
                                <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-center justify-between p-4 text-left text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors"
                                    >
                                        {faq.q}
                                        <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openFaq === i && (
                                        <div className="px-4 pb-4 text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-3">
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Application Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                                <GraduationCap size={22} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-900">Instructor Application</h2>
                                <p className="text-slate-500 text-sm font-medium">Takes about 5 minutes to complete</p>
                            </div>
                        </div>

                        {!user && (
                            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                                <p className="font-bold mb-1">Sign in required</p>
                                <p className="text-amber-800">
                                    <Link to="/login" state={{ from: '/become-instructor' }} className="text-indigo-600 font-bold hover:underline">Log in</Link>
                                    {' '}or{' '}
                                    <Link to="/register" className="text-indigo-600 font-bold hover:underline">create an account</Link>
                                    {' '}before submitting your application.
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Your Bio / About You *</label>
                                <textarea
                                    name="bio"
                                    value={form.bio}
                                    onChange={handleChange}
                                    className={`${inputCls} min-h-[100px] resize-y`}
                                    placeholder="Tell us about yourself, your background, and what makes you a great instructor..."
                                    required
                                />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Area of Expertise *</label>
                                    <input
                                        type="text"
                                        name="expertise"
                                        value={form.expertise}
                                        onChange={handleChange}
                                        className={inputCls}
                                        placeholder="e.g. Web Development, Data Science"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Years of Experience *</label>
                                    <select name="experience" value={form.experience} onChange={handleChange} className={inputCls} required>
                                        <option value="">Select experience</option>
                                        <option value="1-2">1–2 years</option>
                                        <option value="3-5">3–5 years</option>
                                        <option value="5-10">5–10 years</option>
                                        <option value="10+">10+ years</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Sample Course Topic *</label>
                                <input
                                    type="text"
                                    name="sampleTopic"
                                    value={form.sampleTopic}
                                    onChange={handleChange}
                                    className={inputCls}
                                    placeholder="What would your first course be about?"
                                    required
                                />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">LinkedIn Profile (optional)</label>
                                    <input
                                        type="url"
                                        name="linkedin"
                                        value={form.linkedin}
                                        onChange={handleChange}
                                        className={inputCls}
                                        placeholder="https://linkedin.com/in/..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wide block mb-2">YouTube / Portfolio (optional)</label>
                                    <input
                                        type="url"
                                        name="youtube"
                                        value={form.youtube}
                                        onChange={handleChange}
                                        className={inputCls}
                                        placeholder="https://youtube.com/..."
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="agree"
                                        checked={form.agree}
                                        onChange={handleChange}
                                        className="w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 flex-shrink-0"
                                    />
                                    <span className="text-sm text-slate-600 font-medium leading-relaxed">
                                        I agree to the <span className="text-indigo-600 font-bold cursor-pointer hover:underline">Instructor Agreement</span> and{' '}
                                        <span className="text-indigo-600 font-bold cursor-pointer hover:underline">Code of Conduct</span>. I understand that my application
                                        will be reviewed and I'll receive a response within 2–3 business days.
                                    </span>
                                </label>
                            </div>

                            <div className="flex items-center gap-4 pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting...</>
                                    ) : (
                                        <>Submit Application <ArrowRight size={18} /></>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
