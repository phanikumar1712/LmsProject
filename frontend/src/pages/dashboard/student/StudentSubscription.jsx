import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { subscriptionsAPI } from '../../../services/api';
import { Check, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentSubscription() {
    const { user, updateUser } = useAuth();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        subscriptionsAPI.getPlans()
            .then(setPlans)
            .finally(() => setLoading(false));
    }, []);

    const handleUpgrade = async (planId) => {
        setProcessingId(planId);
        try {
            const { plan, user: updatedUser } = await subscriptionsAPI.upgrade(user.id, planId);
            if (updatedUser) {
                updateUser({
                    subscriptionPlan: updatedUser.subscriptionPlan,
                    subscriptionExpiry: updatedUser.subscriptionExpiry,
                });
            } else {
                const expiryDate = plan.duration > 0
                    // eslint-disable-next-line react-hooks/purity
                    ? new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : null;
                updateUser({ subscriptionPlan: plan.name.toUpperCase(), subscriptionExpiry: expiryDate });
            }
            toast.success(`Successfully switched to ${plan.name} plan! 🎉`);
        } catch (err) {
            toast.error(err.message || 'Action failed');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="text-center py-20 text-muted-foreground font-medium">Loading plans...</div>;

    const currentPlanName = user?.subscriptionPlan || 'FREE';

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Active Subscription</h1>
                    <p className="text-muted-foreground font-medium mt-1">Manage your billing and plan details</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl text-center md:text-right">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Current Plan</p>
                    <p className="text-lg font-black text-indigo-700 leading-tight">{currentPlanName}</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map(plan => {
                    const planNameUpper = plan.name.toUpperCase();
                    const isCurrent = planNameUpper === currentPlanName;
                    const isProcessing = processingId === plan.id;
                    const isAnyProcessing = processingId !== null;

                    return (
                        <div key={plan.id} className={`bg-card border rounded-2xl p-6 shadow-sm flex flex-col relative transition-all ${isCurrent ? 'border-2 border-indigo-500 shadow-md ring-4 ring-indigo-50' : 'border-border opacity-90 hover:opacity-100 hover:border-indigo-300 hover:shadow-md'}`}>
                            {isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm z-10">
                                    Active Plan
                                </div>
                            )}

                            <h3 className="text-xl font-extrabold text-foreground mb-2">{plan.name}</h3>
                            <div className="flex items-end gap-1 mb-6">
                                <span className="text-3xl font-black text-foreground">
                                    {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
                                </span>
                                {plan.price > 0 && <span className="text-muted-foreground/60 text-sm font-medium mb-1">/mo</span>}
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {plan.features.slice(0, 4).map(f => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground font-medium leading-snug">
                                        <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleUpgrade(plan.id)}
                                disabled={isCurrent || isAnyProcessing}
                                className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200
                                    ${isCurrent ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default' :
                                        isProcessing ? 'bg-indigo-600 text-white opacity-90' :
                                            'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}
                            >
                                {isProcessing ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Updating...
                                    </span>
                                ) : isCurrent ? 'Active' : `Switch to ${plan.name}`}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="bg-muted/40 border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert size={20} />
                </div>
                <div>
                    <h4 className="text-foreground font-bold mb-1">Secure Payments</h4>
                    <p className="text-muted-foreground text-sm">All transactions are secured with military-grade encryption. You can cancel your subscription at any time without hidden fees.</p>
                </div>
            </div>
        </div>
    );
}
