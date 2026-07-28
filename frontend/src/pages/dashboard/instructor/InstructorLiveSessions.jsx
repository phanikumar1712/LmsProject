import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { attendanceAPI, coursesAPI } from '../../../services/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Calendar, Plus, X, Save, Trash2, Video, Users, CheckCircle, XCircle, Clock, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorLiveSessions() {
    const { user } = useAuth();
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

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sessionsData, coursesData] = await Promise.all([
                attendanceAPI.getSessions(),
                coursesAPI.getByInstructor(user.id),
            ]);
            setSessions(sessionsData || []);
            setCourses(coursesData || []);
        } catch (err) {
            console.error('Failed to load:', err);
        } finally {
            setLoading(false);
        }
    };

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
        if (!window.confirm('Delete this session and all associated attendance?')) return;
        try {
            await attendanceAPI.deleteSession(id);
            toast.success('Session deleted');
            if (selectedSession?.id === id) {
                setSelectedSession(null);
                setAttendanceRecords([]);
            }
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
            setAttendanceRecords(prev =>
                prev.map(r => r.studentId === studentId ? { ...r, status } : r)
            );
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

    const formatTime = (t) => {
        if (!t) return '';
        const [h, m] = t.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${m} ${ampm}`;
    };

    const now = new Date();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Live Sessions"
                subtitle="Schedule and manage live classes, take attendance."
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
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sessions List */}
                    <div className="lg:col-span-2 space-y-3">
                        {sessions.length === 0 ? (
                            <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-2xl">
                                <Video size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground font-medium">No live sessions yet</p>
                                <button onClick={() => setShowCreate(true)} className="text-indigo-600 text-sm font-bold mt-2">
                                    Schedule your first session
                                </button>
                            </div>
                        ) : sessions.map(session => {
                            const sessionDate = new Date(session.session_date + 'T' + (session.start_time || '00:00'));
                            const isPast = sessionDate < now;
                            const isToday = sessionDate.toDateString() === now.toDateString();

                            return (
                                <div
                                    key={session.id}
                                    onClick={() => openAttendance(session)}
                                    className={`bg-card border rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer ${
                                        isToday ? 'border-indigo-200 ring-1 ring-indigo-500/20' :
                                        isPast ? 'border-border opacity-70' : 'border-emerald-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    isToday ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' :
                                                    isPast ? 'bg-muted text-muted-foreground' :
                                                    'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                }`}>
                                                    {isToday ? '● Today' : isPast ? 'Past' : '● Upcoming'}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-foreground">{session.title}</h3>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(session.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {session.start_time && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {formatTime(session.start_time)}{session.end_time ? ` - ${formatTime(session.end_time)}` : ''}
                                                    </span>
                                                )}
                                                {session.instructor_name && (
                                                    <span className="flex items-center gap-1">
                                                        <Users size={12} />
                                                        {session.instructor_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {session.meeting_link && (
                                                <a
                                                    href={session.meeting_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                                                >
                                                    <ExternalLink size={12} /> Join
                                                </a>
                                            )}
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                                className="p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Attendance Panel */}
                    <div className="lg:col-span-1">
                        {selectedSession ? (
                            <div className="bg-card border border-border rounded-2xl p-4 sticky top-20">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-sm text-foreground">Attendance</h3>
                                    <button
                                        onClick={() => { setSelectedSession(null); setAttendanceRecords([]); }}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3 truncate">{selectedSession.title}</p>

                                {attendanceLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 size={20} className="animate-spin text-indigo-500" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Bulk action buttons */}
                                        <div className="flex gap-1 mb-4">
                                            <button onClick={() => markAll('present')} className="flex-1 px-2 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
                                                All Present
                                            </button>
                                            <button onClick={() => markAll('absent')} className="flex-1 px-2 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition-colors border border-rose-200">
                                                All Absent
                                            </button>
                                        </div>

                                        {attendanceRecords.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-8">No enrolled students</p>
                                        ) : (
                                            <div className="space-y-1 max-h-96 overflow-y-auto">
                                                {attendanceRecords.map(record => (
                                                    <div key={record.studentId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                                    {record.name?.charAt(0) || '?'}
                                                                </span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-foreground truncate">{record.name}</p>
                                                                {record.rollNo && <p className="text-[10px] text-muted-foreground">{record.rollNo}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {['present', 'absent', 'late', 'excused'].map(status => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => markStudent(record.studentId, status)}
                                                                    className={`w-6 h-6 rounded text-[9px] font-black uppercase transition-all ${
                                                                        record.status === status
                                                                            ? status === 'present' ? 'bg-emerald-500 text-white shadow-sm' :
                                                                              status === 'absent' ? 'bg-rose-500 text-white shadow-sm' :
                                                                              status === 'late' ? 'bg-amber-500 text-white shadow-sm' :
                                                                              'bg-blue-500 text-white shadow-sm'
                                                                            : 'bg-muted text-muted-foreground/40 hover:bg-muted-foreground/10'
                                                                    }`}
                                                                    title={status}
                                                                >
                                                                    {status === 'present' ? 'P' : status === 'absent' ? 'A' : status === 'late' ? 'L' : 'E'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
                                <Users size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground font-medium">Select a session</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">to mark attendance</p>
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
                            <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                                <Video size={20} className="text-indigo-600" /> New Live Session
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Course *</label>
                                <select
                                    required
                                    value={form.courseId}
                                    onChange={e => setForm(p => ({ ...p, courseId: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                >
                                    <option value="">Select a course</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Session Title *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Week 3: Data Structures Lecture"
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Date *</label>
                                <input
                                    required
                                    type="date"
                                    value={form.sessionDate}
                                    onChange={e => setForm(p => ({ ...p, sessionDate: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Start Time</label>
                                    <input
                                        type="time"
                                        value={form.startTime}
                                        onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">End Time</label>
                                    <input
                                        type="time"
                                        value={form.endTime}
                                        onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5 block">Meeting Link</label>
                                <input
                                    type="url"
                                    value={form.meetingLink}
                                    onChange={e => setForm(p => ({ ...p, meetingLink: e.target.value }))}
                                    placeholder="https://meet.google.com/..."
                                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : <><Save size={15} /> Create Session</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
