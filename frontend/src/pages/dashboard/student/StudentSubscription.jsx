import { BookOpen, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export default function StudentSubscription() {
    const { user } = useAuth();
    const currentPlanName = user?.subscriptionPlan || 'FREE';

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Subscription</h1>
                    <p className="text-muted-foreground font-medium mt-1">All courses are free — no subscription needed</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl text-center md:text-right">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Current Plan</p>
                    <p className="text-lg font-black text-indigo-700 leading-tight">{currentPlanName}</p>
                </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-emerald-800 mb-2">All Courses Are Free 🎉</h2>
                <p className="text-emerald-700 font-medium max-w-md mx-auto">
                    Your department provides free access to all courses. No subscription or payment is required to enroll in any course.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { icon: BookOpen, title: 'Enroll Freely', desc: 'Enroll in any course without any payment or subscription.' },
                    { icon: BookOpen, title: 'Full Access', desc: 'Access all lessons, quizzes, and resources completely free.' },
                    { icon: BookOpen, title: 'Certificates', desc: 'Earn certificates of completion at no cost.' },
                ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Icon size={24} className="text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-foreground mb-2">{title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
