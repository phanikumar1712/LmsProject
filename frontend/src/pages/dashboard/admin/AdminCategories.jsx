import { useState, useRef } from 'react';
import { statsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { Plus, Edit2, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCategories() {
    const { data, loading, reload } = useAsyncData(() => statsAPI.getCategories(), []);
    const categories = data ?? [];

    // Import modal state
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const abortRef = useRef(null);

    const handleAdd = async () => {
        const name = window.prompt("Enter new category name:");
        if (!name) return;
        const icon = window.prompt("Enter an emoji icon for the category (e.g. 💻):", "📚");
        try {
            await statsAPI.createCategory({ name, icon });
            toast.success("Category created!");
            reload();
        } catch {
            toast.error("Failed to create category");
        }
    };

    const handleEdit = async (cat) => {
        const name = window.prompt("Edit category name:", cat.name);
        if (!name) return;
        const icon = window.prompt("Edit category icon:", cat.icon);
        try {
            await statsAPI.updateCategory(cat.id, { name, icon });
            toast.success("Category updated!");
            reload();
        } catch {
            toast.error("Failed to update category");
        }
    };

    const handleDelete = async (cat) => {
        if (!window.confirm(`Delete category "${cat.name}"? Courses associated with this category will have their category removed.`)) return;
        try {
            await statsAPI.deleteCategory(cat.id);
            toast.success("Category deleted!");
            reload();
        } catch {
            toast.error("Failed to delete category");
        }
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile) { toast.error('Choose a CSV or Excel file'); return; }
        setImporting(true);
        setImportResults(null);
        const ac = new AbortController();
        abortRef.current = ac;
        try {
            const res = await statsAPI.importCategories(importFile, { signal: ac.signal });
            setImportResults(res);
            reload();
            toast.success(`${res.created} created, ${res.failed} failed`);
        } catch (err) {
            if (err.name === 'AbortError') toast.error('Import timed out. Try a smaller file.');
            else toast.error(err.message || 'Import failed');
        } finally {
            setImporting(false);
            abortRef.current = null;
        }
    };

    const cancelImport = () => {
        abortRef.current?.abort();
        setImporting(false);
    };

    if (loading) return <LoadingContainer height="h-64" />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Categories"
                subtitle="Manage course categories and metadata"
                action={
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => { setShowImport(true); setImportResults(null); setImportFile(null); }}
                            className="bg-card border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-muted transition-colors"
                        >
                            <Upload size={16} /> Import Categories
                        </button>
                        <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-indigo-700 transition-colors">
                            <Plus size={16} /> Add Category
                        </button>
                    </div>
                }
            />

            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(categories ?? []).map(cat => (
                    <div key={cat.id} className="bg-card border border-border rounded-xl p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-4xl mb-3">{cat.icon}</div>
                        <h3 className="font-bold text-foreground mb-1">{cat.name}</h3>
                        <p className="text-xs text-muted-foreground font-bold uppercase mb-4">{cat.courseCount} Courses</p>

                        <div className="flex items-center gap-2 w-full pt-4 border-t border-border">
                            <button
                                aria-label={`Edit ${cat.name}`}
                                onClick={() => handleEdit(cat)}
                                className="flex-1 py-1.5 flex justify-center text-muted-foreground/60 hover:text-indigo-600 bg-muted/40 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                aria-label={`Delete ${cat.name}`}
                                onClick={() => handleDelete(cat)}
                                className="flex-1 py-1.5 flex justify-center text-muted-foreground/60 hover:text-rose-600 bg-muted/40 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Import Categories Modal */}
            {showImport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg border border-border shadow-2xl rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">Import Categories</h3>
                            <button onClick={() => setShowImport(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} className="text-muted-foreground" /></button>
                        </div>
                        <div className="p-8 space-y-4">
                            {!importResults ? (
                                <form onSubmit={handleImport} className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Upload a <b>CSV or Excel</b> file with columns <code className="font-mono">name</code> and optional <code className="font-mono">icon</code> (emoji).
                                        Duplicate category names are caught per-row.
                                    </p>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-2xl p-4">
                                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">Expected CSV/Excel format:</p>
                                        <code className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono whitespace-pre">name,icon
Web Development,💻
Data Science,📊
Marketing,📈
Design,🎨</code>
                                    </div>
                                    <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setImportFile(e.target.files[0])}
                                        className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-bold hover:file:bg-indigo-700 cursor-pointer" />
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowImport(false)} className="flex-1 px-6 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                                        {importing ? (
                                            <button type="button" onClick={cancelImport} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Cancel Import</button>
                                        ) : (
                                            <button type="submit" disabled={importing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Import</button>
                                        )}
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-foreground">{importResults.created} created · {importResults.failed} failed</p>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto border border-border rounded-2xl divide-y divide-border">
                                        {importResults.results.map((r, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                                <span className="font-medium text-foreground truncate">{r.icon} {r.name || '(no name)'}</span>
                                                {r.status === 'created'
                                                    ? <span className="text-emerald-600 font-bold text-xs">Created</span>
                                                    : <span className="text-rose-600 font-bold text-xs" title={r.error}>{r.error || 'Failed'}</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setShowImport(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-colors">Done</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
