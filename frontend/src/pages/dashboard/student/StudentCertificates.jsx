import { useAuth } from '../../../contexts/AuthContext';
import { certificatesAPI } from '../../../services/api';
import { Award, Download, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { LoadingContainer, EmptyState } from '../../../components/ui/Feedback';
import { PageHeader } from '../../../components/ui/PageHeader';
import QRCode from '../../../components/ui/QRCode';

export default function StudentCertificates() {
    const { user } = useAuth();

    const { data: certificates, loading } = useAsyncData(
        () => certificatesAPI.getMy(),
        [user?.id]
    );

    if (loading) return <LoadingContainer height="h-64" />;

    if ((certificates ?? []).length === 0) {
        return (
            <EmptyState
                icon={Award}
                message="Complete courses to 100% to earn your certificates."
                action={
                    <Link to="/student/courses" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors">
                        Continue Learning
                    </Link>
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="My Certificates" subtitle="View and download your earned credentials" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {certificates.map(cert => (
                    <div key={cert.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-500" />
                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Award size={32} />
                        </div>
                        <h3 className="font-bold text-foreground text-lg mb-1 leading-tight">{cert.course_title}</h3>
                        <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-widest mb-2">
                            Issued: {new Date(cert.issue_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-[11px] font-mono text-muted-foreground/50 mb-4">ID: {cert.cert_id}</p>

                        <div className="bg-muted/40 border border-border rounded-xl p-3 mb-4">
                            <QRCode value={`${window.location.origin}/verify/${cert.cert_id}`} size={80} />
                        </div>

                        <div className="mt-auto pt-4 w-full border-t border-border flex gap-2">
                            <Link
                                to={`/verify/${cert.cert_id}`}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                                <ExternalLink size={14} /> View Certificate
                            </Link>
                            <a
                                href={`/verify/${cert.cert_id}`}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-muted/40 hover:bg-indigo-50 hover:text-indigo-700 text-muted-foreground rounded-lg text-xs font-bold transition-colors"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(`/verify/${cert.cert_id}`, '_blank');
                                }}
                            >
                                <Download size={14} /> Download
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
