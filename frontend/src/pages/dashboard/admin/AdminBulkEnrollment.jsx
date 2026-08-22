import { PageHeader } from '../../../components/ui/PageHeader';
import BulkEnrollmentPanel from './BulkEnrollmentPanel';

export default function AdminBulkEnrollment() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title="Bulk Enrollment"
                subtitle="Enroll multiple students in a course at once — pick students, enter roll numbers, or upload a CSV"
            />
            <BulkEnrollmentPanel />
        </div>
    );
}
