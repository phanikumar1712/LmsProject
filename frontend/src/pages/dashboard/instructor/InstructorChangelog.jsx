import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { coursesAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Clock, GitBranch, Plus, MessageSquare, CheckCircle, Loader2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorChangelog() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [versions, setVersions] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishForm, setPublishForm] = useState({ changelog: '', versionLabel: '' });
    const [editingChangelog, setEditingChangelog] = useState(null);

    const loadCourses = useCallback(async () => {
        setLoadingCourses(true);
        try {
            const data = await coursesAPI.getByInstructor(user.id);
            setCourses(data || []);
            if (data?.length > 0) setSelectedCourseId(data[0].id);
        } catch (err) {
            console.error('Failed to load courses:', err);
        } finally {
            setLoadingCourses(false);
        }
    }, [user]);

    useEffect(() => {
        loadCourses();
    }, [loadCourses]);

    const loadVersions = useCallback(async () => {
        setLoadingVersions(true);
        try {
            const data = await coursesAPI.getVersions(selectedCourseId);
            setVersions(data || []);
        } catch (err) {
            console.error('Failed to load versions:', err);
        } finally {
            setLoadingVersions(false);
        }
    }, [selectedCourseId]);

    useEffect(() => {
        if (selectedCourseId) loadVersions();
        else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setVersions([]);
        }
    }, [selectedCourseId, loadVersions]);

    const selectedCourse = courses.find(c => c.id === selectedCourseId);

    const handlePublish = async (e) => {
        e.preventDefault();
        setPublishing(true);
        try {
            await coursesAPI.createVersion(selectedCourseId, publishForm);
            toast.success('New version published! 🎉');
            setShowPublishModal(false);
            setPublishForm({ changelog: '', versionLabel: '' });
            loadVersions();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setPublishing(false);
        }
    };

    const handleUpdateChangelog = async (versionId) => {
        try {
            await coursesAPI.updateChangelog(selectedCourseId, versionId, { changelog: editingChangelog.changelog });
            toast.success('Changelog updated!');
            setEditingChangelog(null);
            loadVersions();
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <PageHeader
                title="Version History"
                subtitle="Manage course versions and publish 'What's New' changelogs."
            />

            {/* Course Selector */}
            {loadingCourses ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
            ) : courses.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-2xl">
                    <BookOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium">No courses yet</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-4 flex-wrap">
                        <select
                            value={selectedCourseId}
                            onChange={e => setSelectedCourseId(e.target.value)}
                            className="flex-1 min-w-[250px] px-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                        >
                            {courses.map(c => (
                                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                            ))}
                        </select>
                        {selectedCourse?.status === 'PUBLISHED' && (
                            <button
                                onClick={() => setShowPublishModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                            >
                                <Plus size={16} /> Publish New Version
                            </button>
                        )}
                    </div>

                    {selectedCourse?.status !== 'PUBLISHED' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                            Publishing versions is only available for published courses.
                        </div>
                    )}

                    {loadingVersions ? (
                        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
                    ) : versions.length === 0 ? (
                        <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-2xl">
                            <GitBranch size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">No versions published yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Publish a version to create a snapshot of your course content</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {versions.map((v, idx) => (
                                <div key={v.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black px-2.5 py-1 rounded-full">
                                                    {v.version_label || `v${v.version_number}`}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock size={12} /> {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {idx === 0 && (
                                                    <span className="text-[10px] bg-emerald-50 text-emerald-600 font-black px-2 py-0.5 rounded-full border border-emerald-200">Latest</span>
                                                )}
                                            </div>

                                            {editingChangelog?.id === v.id ? (
                                                <div className="mt-2 space-y-2">
                                                    <textarea
                                                        value={editingChangelog.changelog}
                                                        onChange={e => setEditingChangelog(p => ({ ...p, changelog: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                        rows={3}
                                                        placeholder="Describe what changed..."
                                                    />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleUpdateChangelog(v.id)}
                                                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">Save</button>
                                                        <button onClick={() => setEditingChangelog(null)}
                                                            className="px-3 py-1.5 border border-border text-xs font-bold rounded-lg hover:bg-muted">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2">
                                                    {v.changelog ? (
                                                        <div className="flex items-start gap-2">
                                                            <MessageSquare size={14} className="text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.changelog}</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground/40 italic">No changelog notes</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 flex-shrink-0">
                                            {editingChangelog?.id !== v.id && (
                                                <button onClick={() => setEditingChangelog({ id: v.id, changelog: v.changelog || '' })}
                                                    className="px-3 py-1.5 border border-border text-xs font-bold rounded-lg hover:bg-muted">Edit Notes</button>
                                            )}
                                        </div>
                                    </div>

                                    {v.snapshot && typeof v.snapshot === 'object' && (
                                        <div className="flex gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                                            <span>{v.snapshot.sections?.length || 0} sections</span>
                                            <span>{v.snapshot.lessons?.length || 0} lessons</span>
                                            <span>{v.snapshot.quizzes?.length || 0} quizzes</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Publish Modal */}
            {showPublishModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                                <GitBranch size={20} className="text-indigo-600" /> Publish Version
                            </h3>
                            <button onClick={() => setShowPublishModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handlePublish} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Version Label</label>
                                <input type="text" value={publishForm.versionLabel}
                                    onChange={e => setPublishForm(p => ({ ...p, versionLabel: e.target.value }))}
                                    placeholder="e.g. v2.0, Semester Update"
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">What's New? (Changelog)</label>
                                <textarea value={publishForm.changelog}
                                    onChange={e => setPublishForm(p => ({ ...p, changelog: e.target.value }))}
                                    rows={4}
                                    placeholder={`Describe what's changed in this version:\n• Updated module 3 content\n• Added new video lectures\n• Fixed quiz questions`}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none" />
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                                <strong>📸 Snapshot created:</strong> A full copy of all sections, lessons, and quizzes will be saved. Students currently enrolled will continue seeing the version they started with.
                            </div>
                            <button type="submit" disabled={publishing}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : <><CheckCircle size={16} /> Publish Version</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
