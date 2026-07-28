import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getToken = () => localStorage.getItem('lms_token');

const http = async (method, path, body = null) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: body ? JSON.stringify(body) : null
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
};

export default function RubricGradingPanel({ assignmentId, onTotalScore }) {
    const [criteria, setCriteria] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (assignmentId) loadRubric();
    }, [assignmentId]);

    const loadRubric = async () => {
        setLoading(true);
        try {
            const data = await http('GET', `/assignments/${assignmentId}/rubric`);
            if (data && data.length > 0) {
                setCriteria(data.map(c => ({
                    id: c.id,
                    name: c.criterion_name,
                    maxScore: c.max_score,
                    description: c.description || '',
                    order: c.order,
                })));
            } else {
                // Default with one empty criterion
                setCriteria([{ id: `new_1`, name: '', maxScore: 10, description: '', order: 1 }]);
                setEditing(true);
            }
        } catch {
            setCriteria([{ id: `new_1`, name: '', maxScore: 10, description: '', order: 1 }]);
            setEditing(true);
        } finally {
            setLoading(false);
        }
    };

    const addCriterion = () => {
        setCriteria(prev => [...prev, {
            id: `new_${Date.now()}`,
            name: '',
            maxScore: 10,
            description: '',
            order: prev.length + 1
        }]);
    };

    const updateCriterion = (idx, field, value) => {
        setCriteria(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const removeCriterion = (idx) => {
        setCriteria(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        const invalid = criteria.some(c => !c.name.trim() || !c.maxScore || c.maxScore < 1);
        if (invalid) {
            toast.error('Each criterion needs a name and valid max score');
            return;
        }
        setSaving(true);
        try {
            await http('PUT', `/assignments/${assignmentId}/rubric`, {
                criteria: criteria.map(c => ({
                    name: c.name.trim(),
                    maxScore: Number(c.maxScore),
                    description: c.description.trim(),
                }))
            });
            toast.success('Rubric saved! ✓');
            setEditing(false);
            loadRubric();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-sm text-muted-foreground">Loading rubric...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <ListChecks size={16} className="text-indigo-500" />
                    Rubric Criteria
                </h4>
                <div className="flex gap-2">
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 rounded-lg transition-colors"
                        >
                            Edit Rubric
                        </button>
                    )}
                </div>
            </div>

            {editing ? (
                <div className="space-y-3">
                    {criteria.map((c, idx) => (
                        <div key={c.id} className="flex items-start gap-3 bg-muted/30 border border-border rounded-xl p-4">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={c.name}
                                        onChange={e => updateCriterion(idx, 'name', e.target.value)}
                                        placeholder="Criterion name (e.g. Clarity, Structure)"
                                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Max</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={c.maxScore}
                                            onChange={e => updateCriterion(idx, 'maxScore', Math.max(1, Number(e.target.value)))}
                                            className="w-16 bg-card border border-border rounded-lg px-2 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeCriterion(idx)}
                                        className="p-1.5 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={c.description}
                                    onChange={e => updateCriterion(idx, 'description', e.target.value)}
                                    placeholder="Optional description of what to look for..."
                                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[11px] font-medium text-muted-foreground outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    ))}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={addCriterion}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-2 bg-indigo-50 rounded-xl transition-colors flex items-center gap-1.5"
                        >
                            <Plus size={14} /> Add Criterion
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="text-xs font-bold text-white px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-1.5"
                        >
                            <Save size={14} /> {saving ? 'Saving...' : 'Save Rubric'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    {criteria.length === 0 ? (
                        <p className="text-xs text-muted-foreground/70 italic">No rubric criteria set up.</p>
                    ) : (
                        criteria.map((c, idx) => (
                            <div key={c.id || idx} className="flex items-center justify-between bg-muted/20 border border-border rounded-lg px-4 py-2.5">
                                <div>
                                    <span className="text-sm font-bold text-foreground">{c.name}</span>
                                    {c.description && (
                                        <span className="text-[11px] text-muted-foreground ml-2">— {c.description}</span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{c.maxScore} pts</span>
                            </div>
                        ))
                    )}
                    <div className="pt-2 text-right text-xs font-bold text-muted-foreground">
                        Total: {criteria.reduce((sum, c) => sum + Number(c.maxScore), 0)} points
                    </div>
                </div>
            )}
        </div>
    );
}

export function RubricScoringPanel({ submissionId, criteria, onScoreChange }) {
    const [scores, setScores] = useState({});
    const [comments, setComments] = useState({});
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (submissionId && !loaded) loadExistingScores();
    }, [submissionId]);

    const loadExistingScores = async () => {
        try {
            const data = await http('GET', `/assignments/submissions/${submissionId}/rubric-scores`);
            if (data && data.length > 0) {
                const scoreMap = {};
                const commentMap = {};
                data.forEach(s => {
                    scoreMap[s.criterion_id] = s.score;
                    commentMap[s.criterion_id] = s.comment || '';
                });
                setScores(scoreMap);
                setComments(commentMap);
            }
        } catch {
            // No existing scores
        } finally {
            setLoaded(true);
        }
    };

    const updateScore = (criterionId, value) => {
        const newScores = { ...scores, [criterionId]: Math.max(0, Number(value || 0)) };
        setScores(newScores);
        const total = Object.values(newScores).reduce((sum, v) => sum + Number(v || 0), 0);
        if (onScoreChange) onScoreChange(total);
    };

    const updateComment = (criterionId, value) => {
        setComments(prev => ({ ...prev, [criterionId]: value }));
    };

    const handleSaveScores = async () => {
        setSaving(true);
        try {
            const scoresData = criteria.map(c => ({
                criterionId: c.id,
                score: Number(scores[c.id] || 0),
                comment: comments[c.id] || '',
            }));
            const result = await http('PUT', `/assignments/submissions/${submissionId}/rubric-scores`, { scores: scoresData });
            toast.success(`Rubric scored! Total: ${result.totalScore} points`);
            if (onScoreChange) onScoreChange(result.totalScore);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const total = Object.values(scores).reduce((sum, v) => sum + Number(v || 0), 0);
    const maxTotal = criteria.reduce((sum, c) => sum + Number(c.maxScore), 0);

    return (
        <div className="space-y-4">
            <h5 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                <ListChecks size={14} className="text-indigo-500" />
                Rubric Scoring
            </h5>
            <div className="space-y-3">
                {criteria.map(c => (
                    <div key={c.id} className="bg-muted/20 border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-foreground">{c.name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/60">Max: {c.maxScore} pts</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max={c.maxScore}
                                value={scores[c.id] || 0}
                                onChange={e => updateScore(c.id, e.target.value)}
                                className="flex-1 accent-indigo-600 h-2"
                            />
                            <input
                                type="number"
                                min="0"
                                max={c.maxScore}
                                value={scores[c.id] || 0}
                                onChange={e => updateScore(c.id, e.target.value)}
                                className="w-16 px-2 py-1.5 bg-card border border-border rounded-lg text-xs font-bold text-center outline-none"
                            />
                            <span className="text-xs font-bold text-muted-foreground">/ {c.maxScore}</span>
                        </div>
                        <input
                            type="text"
                            value={comments[c.id] || ''}
                            onChange={e => updateComment(c.id, e.target.value)}
                            placeholder="Feedback for this criterion..."
                            className="w-full mt-2 bg-card border border-border rounded-lg px-3 py-1.5 text-[11px] font-medium outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-bold text-foreground">
                    Total Score: <span className="text-indigo-600">{total}</span> / {maxTotal}
                </span>
                <button
                    onClick={handleSaveScores}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Scores'}
                </button>
            </div>
        </div>
    );
}
