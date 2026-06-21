import { useState, useEffect } from 'react';
import { CreditCard, Check, Star, Edit2, Save, X, Users } from 'lucide-react';
import { subscriptionsAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import toast from 'react-hot-toast';

const PLAN_COLORS = { FREE: '#94a3b8', BASIC: '#3b82f6', PRO: '#a855f7', ENTERPRISE: '#f59e0b' };

export default function SubscriptionPlans() {
    const [plans, setPlans] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editData, setEditData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        subscriptionsAPI.getPlans().then(setPlans).finally(() => setLoading(false));
    }, []);

    const startEdit = (plan) => {
        setEditing(plan.id);
        setEditData({ ...plan, price: plan.price, duration: plan.duration });
    };

    const saveEdit = async (planId) => {
        try {
            const updated = await subscriptionsAPI.updatePlan(planId, {
                ...editData,
                price: Number(editData.price),
                duration: Number(editData.duration)
            });
            setPlans(plans.map(p => p.id === planId ? updated : p));
            setEditing(null);
            toast.success('Subscription plan updated and persisted platform-wide!');
        } catch (err) {
            toast.error('Failed to update plan');
        }
    };

    const PLAN_ENROLLMENTS = { plan_free: 1243, plan_basic: 4328, plan_premium: 6812, plan_enterprise: 2109 };

    if (loading) return <div className="p-8 text-center text-muted-foreground font-medium">Loading plans...</div>;

    return (
        <div className="space-y-8 max-w-5xl">
            <PageHeader
                title="Subscription Plans"
                subtitle="Manage pricing tiers and feature access for each subscription plan"
            />

            <div className="grid lg:grid-cols-2 gap-6">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-border" style={{ borderTop: `4px solid ${PLAN_COLORS[plan.name] || '#94a3b8'}` }}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {plan.popular && <Star size={15} fill="currentColor" className="text-amber-500" />}
                                        <h3 className="text-foreground font-extrabold text-lg">{plan.name}</h3>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {editing === plan.id ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => saveEdit(plan.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors">
                                                <Save size={12} /> Save
                                            </button>
                                            <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted transition-colors">
                                                <X size={12} /> Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEdit(plan)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/40 transition-colors">
                                            <Edit2 size={12} /> Edit Pricing
                                        </button>
                                    )}
                                </div>
                            </div>

                            {editing === plan.id ? (
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    {[
                                        { key: 'price', label: 'Price (₹)' },
                                        { key: 'duration', label: 'Duration (Days)' },
                                    ].map(({ key, label }) => (
                                        <div key={key}>
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
                                            <input
                                                type="number"
                                                value={editData[key]}
                                                onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))}
                                                className="w-full bg-card border border-border rounded-lg py-2 px-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-indigo-100 outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-end gap-3 mt-4">
                                    <div>
                                        <p className="text-3xl font-extrabold text-foreground" style={{ color: PLAN_COLORS[plan.name] || '#94a3b8' }}>
                                            {Number(plan.price) === 0 ? 'Free' : `₹${Number(plan.price).toLocaleString()}`}
                                        </p>
                                    </div>
                                    {plan.duration > 0 && (
                                        <div className="pb-1 text-muted-foreground text-sm font-medium">
                                            {plan.duration} Days
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6">
                            <p className="text-[11px] font-extrabold text-muted-foreground/60 uppercase tracking-wider mb-3">Features Included</p>
                            <ul className="space-y-2 mb-4">
                                {(plan.features || []).map(f => (
                                    <li key={f} className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                                        <Check size={14} className="text-emerald-500 flex-shrink-0" /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
