import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Award, CheckCircle, Download, ExternalLink, ShieldCheck, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { certificatesAPI } from '../services/api';
import QRCode from '../components/ui/QRCode';
import QRCodeLib from 'qrcode';

export default function CertificateVerifyPage() {
    const { certId } = useParams();
    const [cert, setCert] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const verificationUrl = window.location.href;

    useEffect(() => {
        if (!certId) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        certificatesAPI.verify(certId)
            .then(data => setCert(data))
            .catch(err => setError(err.message || 'Certificate not found'))
            .finally(() => setLoading(false));
    }, [certId]);

    const handleDownloadPDF = async () => {
        // Real scannable QR for the printed certificate
        let qrDataUrl = '';
        try {
            qrDataUrl = await QRCodeLib.toDataURL(verificationUrl, {
                width: 160, margin: 1, errorCorrectionLevel: 'M',
                color: { dark: '#0f172a', light: '#ffffff' },
            });
        } catch { /* fall back to text if QR generation fails */ }
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Certificate of Completion</title>
            <style>
                @page { size: landscape; margin: 0; }
                body { margin: 0; display: flex; align-items: center; justify-content: center;
                       min-height: 100vh; font-family: 'Georgia', serif; background: #f8fafc; }
                .cert { width: 900px; height: 640px; border: 12px solid #1e40af;
                        background: #fff; padding: 40px; text-align: center;
                        position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                .cert:before { content: ''; position: absolute; top: 8px; left: 8px;
                               right: 8px; bottom: 8px; border: 2px solid #bfdbfe;
                               pointer-events: none; }
                h1 { color: #1e40af; font-size: 28px; margin-top: 30px; letter-spacing: 4px; }
                .subtitle { color: #64748b; font-size: 14px; text-transform: uppercase;
                            letter-spacing: 6px; margin: 10px 0 30px; }
                .name { font-size: 42px; font-weight: bold; color: #0f172a;
                        border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;
                        display: inline-block; margin: 10px 0; }
                .course { font-size: 24px; color: #334155; margin: 15px 0; }
                .instructor { color: #64748b; font-size: 16px; margin: 20px 0; }
                .date { color: #94a3b8; font-size: 14px; margin-top: 20px; }
                .id { color: #94a3b8; font-size: 11px; margin-top: 30px;
                       font-family: monospace; }
                .ribbon { background: #1e40af; color: #fff; padding: 8px 40px;
                          font-size: 12px; letter-spacing: 3px; display: inline-block;
                          margin-bottom: 20px; }
                .footer { position: absolute; bottom: 30px; left: 0; right: 0;
                          text-align: center; color: #94a3b8; font-size: 10px; }
                .qr { position: absolute; bottom: 30px; right: 40px; width: 90px;
                      height: 90px; background: #fff; border: 1px solid #e2e8f0;
                      display: flex; align-items: center; justify-content: center;
                      overflow: hidden; }
                .qr img { width: 100%; height: 100%; object-fit: contain; }
                .dept { color: #94a3b8; font-size: 13px; margin-top: 4px; }
            </style>
        </head>
        <body>
            <div class="cert">
                <div class="ribbon">CERTIFICATE OF COMPLETION</div>
                <h1>EDUNEXUS LMS</h1>
                <div class="subtitle">Proudly Presents</div>
                <div class="name">${cert?.student_name || ''}</div>
                <div class="course">For completing the course<br><strong>${cert?.course_title || ''}</strong></div>
                <div class="instructor">Instructed by ${cert?.instructor_name || ''}</div>
                ${cert?.department_name ? `<div class="dept">Department of ${cert.department_name}</div>` : ''}
                <div class="date">Issued on ${cert?.issue_date ? new Date(cert.issue_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
                <div class="id">Certificate ID: ${cert?.cert_id || ''}</div>
                <div class="qr">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR code" />` : `Scan to verify<br>${verificationUrl}`}</div>
                <div class="footer">Verify at: ${verificationUrl}</div>
            </div>
            <script>window.print();</script>
        </body>
        </html>`;
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
    };

    const handleLinkedInShare = () => {
        const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert?.course_title || 'Course')}&organizationName=EduNexus%20LMS&issueYear=${new Date(cert?.issue_date).getFullYear()}&issueMonth=${new Date(cert?.issue_date).getMonth() + 1}&certUrl=${encodeURIComponent(verificationUrl)}`;
        window.open(url, '_blank', 'width=600,height=600');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-14 h-14 border-[4px] border-indigo-300/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-indigo-300/70 font-medium">Verifying certificate...</p>
                </div>
            </div>
        );
    }

    if (error || !cert) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md text-center border border-red-100">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck size={40} className="text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Certificate Not Found</h1>
                    <p className="text-slate-500 mb-6">The certificate ID you provided is invalid or has been revoked.</p>
                    <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50 flex items-center justify-center p-4 py-16">
            <div className="w-full max-w-3xl space-y-8">
                <div className="flex items-center justify-center gap-2 mb-2 text-emerald-700 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 rounded-2xl px-6 py-3 shadow-sm mx-auto w-fit">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <span className="font-bold text-sm block">Verified — Authentic Certificate</span>
                        <span className="text-[11px] text-emerald-500/70 font-medium">Issued by EduNexus LMS</span>
                    </div>
                </div>

                <div className="relative bg-white rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden transition-all hover:shadow-3xl duration-500" style={{ aspectRatio: '1.4' }}>
                    <div className="h-2 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300" />
                    <div className="p-8 md:p-12 text-center relative h-full flex flex-col">
                        <div className="absolute top-6 left-6 w-20 h-20 border-t-4 border-l-4 border-indigo-200 rounded-tl-xl" />
                        <div className="absolute top-6 right-6 w-20 h-20 border-t-4 border-r-4 border-indigo-200 rounded-tr-xl" />
                        <div className="absolute bottom-6 left-6 w-20 h-20 border-b-4 border-l-4 border-indigo-200 rounded-bl-xl" />
                        <div className="absolute bottom-6 right-6 w-20 h-20 border-b-4 border-r-4 border-indigo-200 rounded-br-xl" />
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                            backgroundImage: `radial-gradient(circle at 25px 25px, #4f46e5 2px, transparent 0)`,
                            backgroundSize: '50px 50px'
                        }} />
                        <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-amber-50 to-amber-100 rounded-full flex items-center justify-center mb-4 border-2 border-amber-200 shadow-sm">
                            <Award size={40} className="text-amber-600" />
                        </div>
                        <div className="relative text-xs font-bold text-indigo-600 uppercase tracking-[6px] mb-2">Certificate of Completion</div>
                        <h1 className="relative text-2xl md:text-3xl font-bold text-slate-800 mb-1 font-serif">EduNexus LMS</h1>
                        <p className="relative text-sm text-slate-400 uppercase tracking-[4px] mb-6">Proudly Presents</p>
                        <div className="relative text-3xl md:text-4xl font-bold text-slate-900 mb-4 font-serif tracking-tight">{cert.student_name}</div>
                        <p className="relative text-slate-500 text-sm mb-2">For completing the course</p>
                        <p className="relative text-xl md:text-2xl font-bold text-indigo-700 mb-4">{cert.course_title}</p>
                        <p className="relative text-slate-500 text-sm">Instructed by <span className="font-semibold text-slate-700">{cert.instructor_name}</span></p>
                        {cert.department_name && (
                            <p className="relative text-xs text-slate-400 font-medium mt-1">Department of {cert.department_name}</p>
                        )}
                        <div className="relative mt-auto pt-4 flex items-center justify-between text-xs text-slate-400">
                            <span>Issued: {new Date(cert.issue_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <span className="font-mono">ID: {cert.cert_id}</span>
                        </div>
                        <div className="absolute bottom-8 right-8 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                            <QRCode value={verificationUrl} size={84} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button onClick={handleDownloadPDF}
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
                        <Download size={16} /> Download PDF
                    </button>
                    <button onClick={handleLinkedInShare}
                        className="flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">
                        <ExternalLink size={16} /> Add to LinkedIn
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(verificationUrl); toast.success('Verification link copied!'); }}
                        className="flex items-center gap-2 bg-white border-2 border-border text-foreground px-6 py-3 rounded-2xl font-bold text-sm hover:bg-muted transition-all shadow-sm active:scale-[0.98]">
                        <Share2 size={16} /> Copy Link
                    </button>
                </div>

                <p className="text-center text-xs text-slate-400 font-medium">
                    EduNexus LMS — Verified Digital Certificate
                </p>
            </div>
        </div>
    );
}