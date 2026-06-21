import { statsAPI } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { PageHeader } from '../../../components/ui/PageHeader';
import { LoadingContainer } from '../../../components/ui/Feedback';
import { LayoutGrid, Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCategories() {
    const { data, loading, reload } = useAsyncData(() => statsAPI.getCategories(), []);
    const categories = data ?? [];

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

    if (loading) return <LoadingContainer height="h-64" />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Categories"
                subtitle="Manage course categories and metadata"
                action={
                    <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-indigo-700 transition-colors">
                        <Plus size={16} /> Add Category
                    </button>
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
        </div>
    );
}
