import { useState, useEffect, useCallback } from 'react';
import { attendanceAPI, coursesAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Calendar, Plus, X, Save, Trash2, Video, Users, Clock, Loader2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLiveSessions() {
    const [sessions, setSessions] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        courseId: '', title: '', sessionDate: '', startTime: '', endTime: '', meetingLink: ''
    });
    const [selectedSession, setSelectedSession] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [sessionsData, coursesData] = await Promise.all([
                attendanceAPI.getSessions(),
                coursesAPI.getAll({ status: 'PUBLISHED', admin: true }),
            ]);
            setSessions(sessionsData || []);
            setCourses(coursesData || []);
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.courseId || !form.title || !form.sessionDate) {
            toast.error('Course, title and date are required');
            return;
        }
        setCreating(true);
        try {
            await attendanceAPI.createSession(form);
            toast.success('Live session created! 📅');
            setShowCreate(false);
            setForm({ courseId: '', title: '', sessionDate: '', startTime: '', endTime: '', meetingLink: '' });
            loadData();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteSession = async (id) => {
        if (!window.confirm('Delete this session and all attendance records?')) return;
        try {
            await attendanceAPI.deleteSession(id);
            toast.success('Session deleted');
            if (selectedSession?.id === id) setSelectedSession(null);
            loadData();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const openAttendance = async (session) => {
        setSelectedSession(session);
        setAttendanceLoading(true);
        try {
            const data = await attendanceAPI.getAttendance(session.id);
            setAttendanceRecords(data.records || []);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setAttendanceLoading(false);
        }
    };

    const markStudent = async (studentId, status) => {
        if (!selectedSession) return;
        try {
            await attendanceAPI.markSingleAttendance(selectedSession.id, studentId, status);
            setAttendanceRecords(prev => prev.map(r => r.studentId === studentId ? { ...r, status } : r));
        } catch (err) {
            toast.error(err.message);
        }
    };

    const markAll = async (status) => {
        if (!selectedSession || !attendanceRecords.length) return;
        if (!window.confirm(`Mark all students as "${status}"? This will overwrite individual marks.`)) return;
        try {
            const records = attendanceRecords.map(r => ({ studentId: r.studentId, status }));
            await attendanceAPI.markAttendance(selectedSession.id, records);
            setAttendanceRecords(prev => prev.map(r => ({ ...r, status })));
            toast.success(`All marked as ${status}`);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const filteredRecords = attendanceRecords.filter(r =>
        !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.rollNo?.toLowerCase().includes(search.toLowerCase())
    );

    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const totalCount = attendanceRecords.length;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Attendance Management"
                subtitle="Create live sessions across all courses and mark attendance."
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> New Session
                    </button>
                }
            />

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sessions list */}
                    <div className="lg:col-span-2 space-y-3">
                        {sessions.length === 0 ? (
                            <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-2xl">
                                <Video size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground font-medium">No live sessions scheduled</p>
                            </div>
                        ) : sessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => openAttendance(session)}
                                className="bg-card border border-border rounded-2xl p-5 hover:shadow-md cursor-pointer transition-all"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-foreground">{session.title}</h3>
                                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><Calendar size={12} />{new Date(session.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                            {session.start_time && <span className="flex items-center gap-1"><Clock size={12} />{session.start_time?.slice(0, 5)}</span>}
                                            <span className="flex items-center gap-1"><Users size={12} />{session.instructor_name}</span>
                                        </div>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); handleDeleteSession(session.id); }} className="p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Attendance Panel */}
                    <div className="lg:col-span-1">
                        {selectedSession ? (
                            <div className="bg-card border border-border rounded-2xl p-4 sticky top-20">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-sm">Attendance</h3>
                                    <button onClick={() => setSelectedSession(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2 truncate">{selectedSession.title}</p>

                                {totalCount > 0 && (
                                    <div className="flex gap-2 mb-3 text-[10px] font-bold">
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg">{presentCount} Present</span>
                                        <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg">{absentCount} Absent</span>
                                        <span className="px-2 py-1 bg-muted text-muted-foreground rounded-lg">{totalCount} Total</span>
                                    </div>
                                )}

                                <input
                                    type="text"
                                    placeholder="Search by name or roll..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-muted/40 border border-border rounded-lg text-xs outline-none mb-3"
                                />

                                {attendanceLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-indigo-500" /></div>
                                ) : (
                                    <>
                                        <div className="flex gap-1 mb-3">
                                            <button onClick={() => markAll('present')} className="flex-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 border border-emerald-200">All Present</button>
                                            <button onClick={() => markAll('absent')} className="flex-1 px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 border border-rose-200">All Absent</button>
                                        </div>

                                        <div className="space-y-1 max-h-96 overflow-y-auto">
                                            {filteredRecords.map(record => (
                                                <div key={record.studentId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                            <span className="text-[10px] font-bold text-muted-foreground">{record.name?.charAt(0) || '?'}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium truncate">{record.name}</p>
                                                            {record.rollNo && <p className="text-[10px] text-muted-foreground">{record.rollNo}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {['present', 'absent', 'late', 'excused'].map(status => (
                                                            <button key={status}
                                                                onClick={() => markStudent(record.studentId, status)}
                                                                className={`w-6 h-6 rounded text-[9px] font-black uppercase transition-all ${
                                                                    record.status === status
                                                                        ? status === 'present' ? 'bg-emerald-500 text-white' :
                                                                          status === 'absent' ? 'bg-rose-500 text-white' :
                                                                          status === 'late' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                                                                        : 'bg-muted text-muted-foreground/40'
                                                                }`}
                                                            >
                                                                {status === 'present' ? 'P' : status === 'absent' ? 'A' : status === 'late' ? 'L' : 'E'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
                                <BarChart3 size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">Click a session</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">to view and mark attendance</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold flex items-center gap-2"><Video size={20} className="text-indigo-600" /> New Session</h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Course *</label>
                                <select required value={form.courseId} onChange={e => setForm(p => ({ ...p, courseId: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                >
                                    <option value="">Select a course</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Title *</label>
                                <input required type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Week 4 Lecture" className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Date *</label>
                                <input required type="date" value={form.sessionDate} onChange={e => setForm(p => ({ ...p, sessionDate: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Start</label>
                                    <input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">End</label>
                                    <input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Meeting Link</label>
                                <input type="url" value={form.meetingLink} onChange={e => setForm(p => ({ ...p, meetingLink: e.target.value }))}
                                    placeholder="https://meet.google.com/..." className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium" />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : <><Save size={15} /> Create</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
