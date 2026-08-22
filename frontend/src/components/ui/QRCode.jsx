import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';

// Renders a scannable QR code to a <canvas> (data URL), so certificates can
// embed a real verification QR without any external API.
export default function QRCode({ value, size = 96, className = '' }) {
    const canvasRef = useRef(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!value || !canvasRef.current) return;
        setError(false);
        QRCodeLib.toCanvas(canvasRef.current, value, {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#0f172a', light: '#ffffff' },
        }).catch(() => setError(true));
    }, [value, size]);

    if (error) {
        return (
            <div className={`flex items-center justify-center border border-border rounded bg-muted/40 text-[9px] text-muted-foreground text-center font-medium ${className}`} style={{ width: size, height: size }}>
                QR unavailable
            </div>
        );
    }

    return <canvas ref={canvasRef} className={className} style={{ width: size, height: size }} />;
}
