import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, GraduationCap, Zap, Shield, TrendingUp,
    Play, Users, BookOpen, Award, Clock, ChevronRight, Menu, X,
    Sparkles, Compass, RefreshCw
} from 'lucide-react';
import { coursesAPI, statsAPI } from '../services/api';
import studentImg from '../assets/student.jpg';

// ─── Dynamic Star Rating ──────────────────────────────────────────────────────
function StarRating({ rating = 0, size = 16 }) {
    const numRating = parseFloat(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalf = numRating - fullStars >= 0.4;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    return (
        <span className="hp-stars" aria-label={`${numRating.toFixed(1)} out of 5 stars`}>
            {Array.from({ length: fullStars }).map((_, i) => (
                <span key={`f${i}`} className="hp-star hp-star--full" style={{ fontSize: size }}>★</span>
            ))}
            {hasHalf && (
                <span className="hp-star hp-star--half" style={{ fontSize: size }}>
                    <span className="hp-star-half-fill">★</span>
                    <span className="hp-star-half-empty">★</span>
                </span>
            )}
            {Array.from({ length: emptyStars }).map((_, i) => (
                <span key={`e${i}`} className="hp-star hp-star--empty" style={{ fontSize: size }}>★</span>
            ))}
        </span>
    );
}

// ─── Course Card Skeleton ─────────────────────────────────────────────────────
function CourseSkeleton() {
    return (
        <div className="hp-card hp-card--skeleton">
            <div className="hp-card__thumb hp-skeleton" />
            <div className="hp-card__body">
                <div className="hp-skeleton hp-skeleton--tag" />
                <div className="hp-skeleton hp-skeleton--title" />
                <div className="hp-skeleton hp-skeleton--title hp-skeleton--short" />
                <div className="hp-skeleton hp-skeleton--meta" />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HomePage() {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        // Fetch live courses from backend
        coursesAPI.getAll({ status: 'PUBLISHED', sort: 'popular', limit: 8 })
            .then(data => {
                setCourses(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setError('Could not load courses. Please try again.');
                setLoading(false);
            });

        // Fetch public stats
        statsAPI.getPublic()
            .then(setStats)
            .catch(() => { });
    }, []);

    const fadeUp = {
        hidden: { opacity: 0, y: 32 },
        visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } })
    };

    return (
        <>
            <style>{`
                /* ── Reset & Base ──────────────────────────────── */
                .hp-root {
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                    background: var(--color-background, #f8fafc);
                    color: var(--color-foreground, #334155);
                    min-height: 100vh;
                    overflow-x: hidden;
                }
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

                /* ── Navbar ────────────────────────────────────── */
                .hp-nav-spacer { height: 0; }
                .hp-btn-primary {
                    background: #4f46e5;
                    color: white; border: none; cursor: pointer;
                    padding: 0.7rem 1.5rem; border-radius: 12px;
                    font-size: 0.95rem; font-weight: 600;
                    transition: all 0.2s; transform: translateY(0);
                    box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.3);
                    text-decoration: none; display: inline-flex; align-items: center;
                }
                .hp-btn-primary:hover {
                    background: #4338ca;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px 0 rgba(79, 70, 229, 0.4);
                }

                /* ── Hero ──────────────────────────────────────── */
                .hp-hero {
                    min-height: calc(100vh - 64px);
                    display: flex; align-items: center;
                    padding: 80px 2rem 80px;
                    position: relative;
                    background: var(--color-background, white);
                    overflow: hidden;
                }
                .hp-hero__bg {
                    position: absolute; inset: 0; z-index: 0;
                    background: 
                        radial-gradient(circle at 70% 30%, rgba(79, 70, 229, 0.08) 0%, transparent 50%),
                        radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.05) 0%, transparent 40%);
                }
                .hp-hero__grid-lines {
                    position: absolute; inset: 0; z-index: 0;
                    background-image: radial-gradient(var(--color-border, #e2e8f0) 1px, transparent 1px);
                    background-size: 40px 40px;
                    opacity: 0.5;
                }
                .hp-hero__inner {
                    max-width: 1280px; margin: 0 auto; width: 100%;
                    display: grid; grid-template-columns: 1.1fr 0.9fr;
                    gap: 5rem; align-items: center;
                    position: relative; z-index: 1;
                }
                .hp-hero__badge {
                    display: inline-flex; align-items: center; gap: 10px;
                    background: #eef2ff;
                    border: 1px solid #e0e7ff;
                    color: #4f46e5; font-size: 0.85rem; font-weight: 700;
                    padding: 0.5rem 1.25rem; border-radius: 100px; margin-bottom: 2rem;
                    width: fit-content;
                }
                .hp-hero__badge-dot {
                    width: 8px; height: 8px; border-radius: 50%;
                    background: #4f46e5; animation: pulse-dot 2s infinite;
                }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                }
                .hp-hero__title {
                    font-size: clamp(2.8rem, 5vw, 4.2rem);
                    font-weight: 900; line-height: 1;
                    color: var(--color-foreground); margin-bottom: 1.5rem;
                    letter-spacing: -0.04em;
                }
                .hp-hero__title-gradient {
                    color: #4f46e5;
                    display: block;
                }
                .hp-hero__subtitle {
                    font-size: 1.15rem; color: var(--color-muted-foreground, #64748b); line-height: 1.6;
                    margin-bottom: 3rem; max-width: 520px;
                    font-weight: 500;
                }
                .hp-hero__ctas {
                    display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 4rem;
                }
                .hp-btn-outline {
                    background: var(--color-background, white);
                    border: 1px solid var(--color-border, #e2e8f0);
                    color: var(--color-foreground); cursor: pointer;
                    padding: 0.85rem 1.75rem; border-radius: 12px;
                    font-size: 1rem; font-weight: 700;
                    transition: all 0.2s;
                    text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .hp-btn-outline:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                    transform: translateY(-1px);
                }
                .hp-btn-primary-lg {
                    background: #4f46e5;
                    color: white; border: none; cursor: pointer;
                    padding: 0.85rem 2.25rem; border-radius: 12px;
                    font-size: 1rem; font-weight: 700;
                    transition: all 0.25s; transform: translateY(0);
                    box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);
                    text-decoration: none; display: inline-flex; align-items: center; gap: 10px;
                }
                .hp-btn-primary-lg:hover {
                    background: #4338ca;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5);
                }
                .hp-hero__stats {
                    display: flex; gap: 3rem; flex-wrap: wrap;
                }
                .hp-hero__stat-num {
                    font-size: 1.75rem; font-weight: 800; color: var(--color-foreground);
                    margin-bottom: 0.25rem;
                }
                .hp-hero__stat-label {
                    font-size: 0.85rem; color: var(--color-muted-foreground); font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }

                /* ── Hero Image Side ───────────────────────────── */
                .hp-hero__visual {
                    display: flex; justify-content: center; align-items: center;
                    position: relative;
                }
                .hp-hero__img-wrap {
                    position: relative; width: 100%; max-width: 540px;
                }
                .hp-hero__glow {
                    position: absolute; top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 120%; height: 120%; border-radius: 50%;
                    background: radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, transparent 70%);
                    filter: blur(60px); z-index: 0;
                }
                .hp-hero__img {
                    position: relative; z-index: 1;
                    width: 100%; height: auto;
                    border-radius: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
                    /* Animation removed per user request */
                }

                /* Floating badges */
                .hp-hero__float-badge {
                    position: absolute; z-index: 2;
                    background: var(--color-card, white);
                    border: 1px solid var(--color-border, #e2e8f0);
                    border-radius: 16px; padding: 0.85rem 1.25rem;
                    display: flex; align-items: center; gap: 12px;
                    font-size: 0.85rem; font-weight: 700; color: var(--color-foreground);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    /* Animation removed per user request */
                }
                .hp-badge-icon {
                    width: 36px; height: 36px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 18px;
                }
                .hp-badge-icon--purple { background: #eef2ff; color: #4f46e5; }
                .hp-badge-icon--blue { background: #f0f9ff; color: #0ea5e9; }
                .hp-badge-icon--green { background: #f0fdf4; color: #22c55e; }

                /* ── Section Shared ────────────────────────────── */
                .hp-section { padding: 100px 2rem; }
                .hp-section__inner { max-width: 1280px; margin: 0 auto; }
                .hp-section__label {
                    font-size: 0.85rem; font-weight: 800; letter-spacing: 0.1em;
                    text-transform: uppercase; color: #4f46e5; margin-bottom: 1rem;
                }
                .hp-section__title {
                    font-size: clamp(2rem, 3.5vw, 2.75rem);
                    font-weight: 900; color: var(--color-foreground);
                    letter-spacing: -0.03em; margin-bottom: 1rem;
                }
                .hp-section__subtitle {
                    color: var(--color-muted-foreground); font-size: 1.1rem; max-width: 600px;
                    font-weight: 500;
                }
                .hp-section__header {
                    display: flex; justify-content: space-between;
                    align-items: flex-end; flex-wrap: wrap; gap: 2rem;
                    margin-bottom: 4rem;
                }
                .hp-view-all {
                    display: inline-flex; align-items: center; gap: 6px;
                    color: #4f46e5; text-decoration: none; font-weight: 800;
                    font-size: 0.9rem; transition: all 0.2s;
                    padding: 8px 18px; border-radius: 100px;
                    background: #eef2ff; border: 1px solid #e0e7ff;
                }
                .hp-view-all:hover {
                    background: #e0e7ff; gap: 10px;
                    transform: translateX(4px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
                }

                /* ── Features ──────────────────────────────────── */
                .hp-features { background: var(--color-muted, #f8fafc); }
                .hp-features__grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 2rem;
                }
                .hp-feature-card {
                    background: var(--color-card, white);
                    border: 1px solid var(--color-border, #e2e8f0);
                    border-radius: 24px; padding: 2.5rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .hp-feature-card:hover {
                    border-color: #4f46e5;
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                }
                .hp-feature-icon {
                    width: 60px; height: 60px; border-radius: 16px;
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 1.5rem;
                }
                .hp-feature-icon--purple { background: #f5f3ff; color: #7c3aed; }
                .hp-feature-icon--blue { background: #eff6ff; color: #3b82f6; }
                .hp-feature-icon--teal { background: #f0fdfa; color: #14b8a6; }
                .hp-feature-card h3 {
                    font-size: 1.25rem; font-weight: 800; color: var(--color-foreground); margin-bottom: 0.75rem;
                }
                .hp-feature-card p { font-size: 1rem; color: var(--color-muted-foreground); line-height: 1.6; font-weight: 500; }

                /* ── Courses Grid ──────────────────────────────── */
                .hp-courses { background: var(--color-background, white); }
                .hp-courses-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .hp-courses-grid > .hp-empty-courses,
                .hp-courses-grid > .hp-state-box {
                    grid-column: 1 / -1;
                }

                /* ── Empty / error states ──────────────────────── */
                .hp-empty-courses {
                    position: relative;
                    overflow: hidden;
                    border-radius: 24px;
                    border: 1px solid #e0e7ff;
                    background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f5f3ff 100%);
                    padding: 3.5rem 2rem;
                    text-align: center;
                }
                .hp-empty-courses__glow {
                    position: absolute;
                    top: -40%;
                    right: -10%;
                    width: 320px;
                    height: 320px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, transparent 70%);
                    pointer-events: none;
                }
                .hp-empty-courses__glow--left {
                    top: auto;
                    bottom: -50%;
                    left: -8%;
                    right: auto;
                    background: radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%);
                }
                .hp-empty-courses__inner {
                    position: relative;
                    z-index: 1;
                    max-width: 520px;
                    margin: 0 auto;
                }
                .hp-empty-courses__icon-wrap {
                    width: 72px;
                    height: 72px;
                    margin: 0 auto 1.5rem;
                    border-radius: 20px;
                    background: white;
                    border: 1px solid #e0e7ff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #4f46e5;
                    box-shadow: 0 10px 25px -8px rgba(79, 70, 229, 0.25);
                }
                .hp-empty-courses__badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #4f46e5;
                    background: var(--color-card);
                    border: 1px solid var(--color-border);
                    padding: 0.35rem 0.85rem;
                    border-radius: 100px;
                    margin-bottom: 1rem;
                }
                .hp-empty-courses__title {
                    font-size: 1.65rem;
                    font-weight: 900;
                    color: var(--color-foreground);
                    letter-spacing: -0.03em;
                    margin-bottom: 0.75rem;
                    line-height: 1.2;
                }
                .hp-empty-courses__text {
                    font-size: 1rem;
                    color: var(--color-muted-foreground);
                    font-weight: 500;
                    line-height: 1.65;
                    margin-bottom: 2rem;
                }
                .hp-empty-courses__actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    justify-content: center;
                    margin-bottom: 2rem;
                }
                .hp-empty-courses__hints {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    justify-content: center;
                }
                .hp-empty-courses__hint {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--color-muted-foreground);
                    background: var(--color-accent);
                    border: 1px solid var(--color-border);
                    padding: 0.4rem 0.85rem;
                    border-radius: 100px;
                }
                .hp-state-box {
                    border-radius: 20px;
                    border: 1px solid #fecaca;
                    background: #fef2f2;
                    padding: 2.5rem 2rem;
                    text-align: center;
                }
                .hp-state-box__icon {
                    width: 48px;
                    height: 48px;
                    margin: 0 auto 1rem;
                    border-radius: 14px;
                    background: var(--color-card);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #dc2626;
                }
                .hp-state-box__title {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: var(--color-foreground);
                    margin-bottom: 0.5rem;
                }
                .hp-state-box__text {
                    font-size: 0.95rem;
                    color: var(--color-muted-foreground);
                    font-weight: 500;
                    margin-bottom: 1.25rem;
                }

                /* ── Course Card ───────────────────────────────── */
                .hp-card {
                    background: var(--color-card, white);
                    border: 1px solid var(--color-border, #e2e8f0);
                    border-radius: 20px; overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex; flex-direction: column;
                }
                .hp-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                    border-color: #e2e8f0;
                }
                .hp-card__thumb {
                    width: 100%; aspect-ratio: 16/10;
                    position: relative; overflow: hidden;
                }
                .hp-card__thumb img {
                    width: 100%; height: 100%; object-fit: cover;
                }
                .hp-card__play-overlay {
                    position: absolute; inset: 0;
                    background: rgba(0,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; transition: opacity 0.3s;
                }
                .hp-card:hover .hp-card__play-overlay { opacity: 1; }
                .hp-card__play-btn {
                    width: 52px; height: 52px; border-radius: 50%;
                    background: white;
                    display: flex; align-items: center; justify-content: center;
                    color: #4f46e5; transform: scale(0.8); transition: transform 0.3s;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                }
                .hp-card:hover .hp-card__play-btn { transform: scale(1); }
                .hp-card__level-badge {
                    position: absolute; top: 12px; left: 12px;
                    font-size: 0.7rem; font-weight: 800;
                    padding: 4px 12px; border-radius: 100px;
                    color: #4f46e5; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    background: var(--color-card);
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .hp-card__body { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; }
                .hp-card__category {
                    font-size: 0.75rem; font-weight: 800;
                    color: #4f46e5; text-transform: uppercase;
                    letter-spacing: 0.05em; margin-bottom: 0.75rem;
                }
                .hp-card__title {
                    font-size: 1.1rem; font-weight: 800; color: var(--color-foreground);
                    line-height: 1.4; margin-bottom: 1rem;
                    display: -webkit-box; -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical; overflow: hidden;
                    flex: 1;
                }
                .hp-card__rating-row {
                    display: flex; align-items: center; gap: 8px;
                    margin-bottom: 1rem;
                }
                .hp-card__rating-num {
                    font-size: 0.9rem; font-weight: 800; color: var(--color-foreground);
                }
                .hp-card__review-count {
                    font-size: 0.85rem; color: #94a3b8; font-weight: 500;
                }
                .hp-card__footer {
                    display: flex; align-items: center; justify-content: space-between;
                    padding-top: 1rem; border-top: 1px solid #f1f5f9;
                }
                .hp-card__instructor {
                    font-size: 0.85rem; color: var(--color-muted-foreground); font-weight: 600;
                }
                .hp-card__price {
                    font-size: 1.15rem; font-weight: 800; color: var(--color-foreground);
                }
                .hp-card__price-free { color: #059669; }
                .hp-card__dur {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem;
                    font-weight: 600;
                }

                /* ── Stars ─────────────────────────────────────── */
                .hp-stars { display: inline-flex; align-items: center; gap: 2px; }
                .hp-star--full { color: #f59e0b; }
                .hp-star--empty { color: #e2e8f0; }

                /* ── Stats Bar ─────────────────────────────────── */
                .hp-statsbar {
                    background: var(--color-muted, #f1f5f9);
                    border-top: 1px solid var(--color-border, #e2e8f0);
                    border-bottom: 1px solid var(--color-border, #e2e8f0);
                    padding: 3rem 2rem;
                }
                .hp-statsbar__inner {
                    max-width: 1280px; margin: 0 auto;
                    display: grid; grid-template-columns: repeat(4, 1fr);
                    gap: 2rem; text-align: center;
                }
                .hp-statsbar__num {
                    font-size: 2.25rem; font-weight: 900; color: var(--color-foreground);
                    margin-bottom: 0.5rem;
                }
                .hp-statsbar__label { font-size: 0.95rem; color: var(--color-muted-foreground); font-weight: 600; }

                /* ── CTA Banner ────────────────────────────────── */
                .hp-cta-banner {
                    background: #4f46e5;
                    padding: 100px 2rem;
                    position: relative; overflow: hidden;
                    text-align: center;
                }
                .hp-cta-banner__inner {
                    max-width: 800px; margin: 0 auto;
                    position: relative; z-index: 1;
                }
                .hp-cta-banner h2 {
                    font-size: clamp(2rem, 4vw, 3rem);
                    font-weight: 900; color: white;
                    letter-spacing: -0.03em; margin-bottom: 1.5rem;
                }
                .hp-cta-banner p { color: rgba(255,255,255,0.9); margin-bottom: 3rem; font-size: 1.15rem; font-weight: 500; }
                .hp-cta-banner .hp-btn-white {
                    background: white; color: #4f46e5;
                    padding: 1rem 2.5rem; border-radius: 12px;
                    font-size: 1.1rem; font-weight: 800; text-decoration: none;
                    display: inline-flex; align-items: center; gap: 10px;
                    transition: all 0.2s;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
                .hp-cta-banner .hp-btn-white:hover {
                    transform: translateY(-2px);
                    background: #f8fafc;
                }

                /* ── Footer ────────────────────────────────────── */
                .hp-footer {
                    background: var(--color-background);
                    border-top: 1px solid var(--color-border);
                    padding: 5rem 2rem 2rem;
                }
                .hp-footer__inner {
                    max-width: 1280px; margin: 0 auto;
                    display: grid; grid-template-columns: 2fr 1fr 1fr;
                    gap: 4rem; margin-bottom: 4rem;
                }
                .hp-footer__brand-text { color: var(--color-muted-foreground); font-size: 0.95rem; line-height: 1.6; margin-top: 1rem; max-width: 300px; font-weight: 500; }
                .hp-footer__col h4 { color: var(--color-foreground); font-size: 0.9rem; font-weight: 800; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .hp-footer__col ul li { margin-bottom: 1rem; list-style: none; }
                .hp-footer__col ul li a { color: var(--color-muted-foreground); font-size: 0.95rem; text-decoration: none; transition: color 0.2s; font-weight: 600; }
                .hp-footer__col ul li a:hover { color: var(--color-primary); }
                .hp-footer__bottom {
                    border-top: 1px solid var(--color-border);
                    padding-top: 2rem;
                    text-align: center; color: var(--color-muted-foreground); font-size: 0.9rem; font-weight: 600;
                }

                /* ── Responsive ────────────────────────────────── */
                @media (max-width: 1024px) {
                    .hp-hero__inner { grid-template-columns: 1fr; text-align: center; gap: 4rem; }
                    .hp-hero__subtitle { margin: 0 auto 3rem; }
                    .hp-hero__ctas { justify-content: center; }
                    .hp-hero__stats { justify-content: center; }
                    .hp-hero__visual { order: -1; }
                }
                @media (max-width: 768px) {
                    .hp-nav__links { display: none; }
                    .hp-statsbar__inner { grid-template-columns: repeat(2, 1fr); }
                    .hp-footer__inner { grid-template-columns: 1fr; gap: 3rem; }
                }
            `}</style>

            <div className="hp-root">
                {/* ── Hero ───────────────────────────────────────── */}
                <section className="hp-hero">
                    <div className="hp-hero__bg" />
                    <div className="hp-hero__grid-lines" />

                    <div className="hp-hero__inner">
                        {/* Left text column */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="hp-hero__badge">
                                <div className="hp-hero__badge-dot" />
                                {courses.length > 0 ? `NEW: ${courses[0].title}` : 'NEW: Generative AI Mastery Course'}
                            </div>
                            <h1 className="hp-hero__title">
                                Master Skills with
                                <span className="hp-hero__title-gradient">Expert Instructors</span>
                            </h1>
                            <p className="hp-hero__subtitle">
                                Access {stats?.totalCourses || 50}+ premium courses in design, development, and business.
                                Join {stats?.totalStudents ? stats.totalStudents.toLocaleString() : '10,000'}+ students and transform your career with project-based learning.
                            </p>

                            <div className="hp-hero__ctas">
                                <Link to="/register" className="hp-btn-primary-lg">
                                    Start Learning Free <ArrowRight size={18} />
                                </Link>
                                <a href="#courses" className="hp-btn-outline">
                                    <Play size={16} /> Browse Courses
                                </a>
                            </div>

                            <div className="hp-hero__stats">
                                <div className="hp-hero__stat-item">
                                    <div className="hp-hero__stat-num">
                                        {stats?.totalStudents ? `${(stats.totalStudents / 1000).toFixed(0)}K+` : '10K+'}
                                    </div>
                                    <div className="hp-hero__stat-label">Students Enrolled</div>
                                </div>
                                <div className="hp-hero__stat-item">
                                    <div className="hp-hero__stat-num">
                                        {stats?.totalCourses ? `${stats.totalCourses}+` : '50+'}
                                    </div>
                                    <div className="hp-hero__stat-label">Courses Available</div>
                                </div>
                                <div className="hp-hero__stat-item">
                                    <div className="hp-hero__stat-num">
                                        {stats?.avgRating ? `${stats.avgRating}★` : '4.9★'}
                                    </div>
                                    <div className="hp-hero__stat-label">Avg. Rating</div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Right image column */}
                        <motion.div
                            className="hp-hero__visual"
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="hp-hero__img-wrap">
                                <div className="hp-hero__glow" />
                                <img
                                    src={studentImg}
                                    alt="Student learning on EduNexus platform"
                                    className="hp-hero__img"
                                />
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* ── Stats Bar ──────────────────────────────────── */}
                <div className="hp-statsbar">
                    <div className="hp-statsbar__inner">
                        {[
                            { icon: <Users size={20} />, num: stats?.totalStudents ? `${stats.totalStudents}+` : '18+', label: 'Happy Learners' },
                            { icon: <BookOpen size={20} />, num: stats?.totalCourses ? `${stats.totalCourses}+` : '1+', label: 'Courses Published' },
                            { icon: <GraduationCap size={20} />, num: stats?.totalInstructors ? `${stats.totalInstructors}+` : '3+', label: 'Expert Instructors' },
                            { icon: <Award size={20} />, num: stats?.satisfactionRate ? `${stats.satisfactionRate}%` : '60%', label: 'Satisfaction Rate' },
                        ].map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className="hp-statsbar__num">{s.num}</div>
                                <div className="hp-statsbar__label">{s.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* ── Features ───────────────────────────────────── */}
                <section id="features" className="hp-section hp-features">
                    <div className="hp-section__inner">
                        <div className="hp-section__header">
                            <div>
                                <div className="hp-section__label">Why EduNexus?</div>
                                <h2 className="hp-section__title">Built for real learning</h2>
                                <p className="hp-section__subtitle">
                                    Everything you need to go from curious beginner to confident professional.
                                </p>
                            </div>
                        </div>

                        <div className="hp-features__grid">
                            {[
                                {
                                    icon: <Zap size={24} />, cls: 'purple',
                                    title: 'Interactive Quizzes',
                                    desc: 'Reinforce concepts with auto-graded quizzes and get instant feedback to lock in your learning.'
                                },
                                {
                                    icon: <Shield size={24} />, cls: 'blue',
                                    title: 'Expert Instructors',
                                    desc: 'Learn from vetted industry professionals with real-world experience in their domains.'
                                },
                                {
                                    icon: <TrendingUp size={24} />, cls: 'teal',
                                    title: 'Career Certificates',
                                    desc: 'Earn recognized certificates to showcase your skills to top employers worldwide.'
                                },
                                {
                                    icon: <Clock size={24} />, cls: 'purple',
                                    title: 'Learn at Your Pace',
                                    desc: 'Lifetime access to course materials so you can learn anytime, anywhere, on any device.'
                                },
                                {
                                    icon: <BookOpen size={24} />, cls: 'blue',
                                    title: 'Rich Curriculum',
                                    desc: 'Structured sections, video lessons, reading materials, and hands-on projects in every course.'
                                },
                                {
                                    icon: <Users size={24} />, cls: 'teal',
                                    title: 'Community Access',
                                    desc: 'Join thousands of learners, share progress, and collaborate through our vibrant community.'
                                },
                            ].map((f, i) => (
                                <motion.div
                                    key={i}
                                    className="hp-feature-card"
                                    initial={{ opacity: 0, y: 24 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: (i % 3) * 0.1 }}
                                >
                                    <div className={`hp-feature-icon hp-feature-icon--${f.cls}`}>
                                        {f.icon}
                                    </div>
                                    <h3>{f.title}</h3>
                                    <p>{f.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Courses ────────────────────────────────────── */}
                <section id="courses" className="hp-section hp-courses">
                    <div className="hp-section__inner">
                        <div className="hp-section__header">
                            <div>
                                <div className="hp-section__label">Trending Now</div>
                                <h2 className="hp-section__title">Popular Courses</h2>
                                <p className="hp-section__subtitle">
                                    Hand-picked by our team — the most loved courses on the platform.
                                </p>
                            </div>
                            <Link to="/courses" className="hp-view-all">
                                View all courses <ChevronRight size={16} />
                            </Link>
                        </div>

                        <div className="hp-courses-grid">
                            {loading && Array.from({ length: 4 }).map((_, i) => <CourseSkeleton key={i} />)}

                            {!loading && error && (
                                <div className="hp-state-box">
                                    <div className="hp-state-box__icon">
                                        <RefreshCw size={22} />
                                    </div>
                                    <div className="hp-state-box__title">Couldn't load courses</div>
                                    <div className="hp-state-box__text">{error}</div>
                                    <button
                                        type="button"
                                        className="hp-btn-primary"
                                        onClick={() => window.location.reload()}
                                    >
                                        Try again
                                    </button>
                                </div>
                            )}

                            {!loading && !error && courses.length === 0 && (
                                <motion.div
                                    className="hp-empty-courses"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <div className="hp-empty-courses__glow" />
                                    <div className="hp-empty-courses__glow hp-empty-courses__glow--left" />
                                    <div className="hp-empty-courses__inner">
                                        <div className="hp-empty-courses__icon-wrap">
                                            <BookOpen size={32} strokeWidth={2} />
                                        </div>
                                        <div className="hp-empty-courses__badge">
                                            <Sparkles size={14} />
                                            New content coming
                                        </div>
                                        <h3 className="hp-empty-courses__title">
                                            We're building something great
                                        </h3>
                                        <p className="hp-empty-courses__text">
                                            Published courses will appear here soon. In the meantime, browse the full catalog or start teaching on EduNexus.
                                        </p>
                                        <div className="hp-empty-courses__actions">
                                            <Link to="/courses" className="hp-btn-primary-lg">
                                                <Compass size={18} />
                                                Browse catalog
                                            </Link>
                                            <Link to="/become-instructor" className="hp-btn-outline">
                                                Teach on EduNexus
                                                <ArrowRight size={16} />
                                            </Link>
                                        </div>
                                        <div className="hp-empty-courses__hints">
                                            <span className="hp-empty-courses__hint">Expert-led lessons</span>
                                            <span className="hp-empty-courses__hint">Certificates</span>
                                            <span className="hp-empty-courses__hint">Learn at your pace</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {!loading && !error && courses.slice(0, 8).map((course, i) => {
                                const rating = parseFloat(course.rating) || 0;
                                const price = course.discountPrice ?? course.price ?? 0;
                                const thumbnail = course.thumbnail ||
                                    `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80`;

                                return (
                                    <motion.div
                                        key={course.id}
                                        className="hp-card"
                                        initial={{ opacity: 0, y: 24 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: (i % 4) * 0.08 }}
                                        onClick={() => navigate(`/courses/${course.id}`)}
                                    >
                                        <div className="hp-card__thumb">
                                            <img src={thumbnail} alt={course.title} loading="lazy" />
                                            <div className="hp-card__play-overlay">
                                                <div className="hp-card__play-btn">
                                                    <Play size={18} fill="currentColor" />
                                                </div>
                                            </div>
                                            {course.level && (
                                                <span className="hp-card__level-badge">{course.level}</span>
                                            )}
                                        </div>

                                        <div className="hp-card__body">
                                            {course.category && (
                                                <div className="hp-card__category">{course.category}</div>
                                            )}

                                            <h3 className="hp-card__title">{course.title}</h3>

                                            {/* ── Dynamic Star Rating ── */}
                                            <div className="hp-card__rating-row">
                                                <span className="hp-card__rating-num">
                                                    {rating > 0 ? rating.toFixed(1) : '—'}
                                                </span>
                                                <StarRating rating={rating} size={14} />
                                                {course.reviewCount > 0 && (
                                                    <span className="hp-card__review-count">
                                                        ({course.reviewCount.toLocaleString()})
                                                    </span>
                                                )}
                                            </div>

                                            {course.duration && (
                                                <div className="hp-card__dur">
                                                    <Clock size={12} />
                                                    {course.duration}
                                                </div>
                                            )}

                                            <div className="hp-card__footer">
                                                <span className="hp-card__instructor">
                                                    {course.instructorName || 'Instructor'}
                                                </span>
                                                <span className={`hp-card__price ${price === 0 ? 'hp-card__price-free' : ''}`}>
                                                    {price === 0 ? 'Free' : `₹${price.toLocaleString()}`}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── CTA Banner ─────────────────────────────────── */}
                <section className="hp-cta-banner">
                    <div className="hp-cta-banner__inner">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <h2>Ready to level up your career?</h2>
                            <p>
                                Join thousands of professionals who've transformed their skills and careers
                                with EduNexus. Your first course is free.
                            </p>
                            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Link to="/register" className="hp-btn-white">
                                    Create Free Account <ArrowRight size={18} />
                                </Link>
                                <Link to="/courses" className="hp-btn-outline" style={{ background: 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
                                    Explore Courses
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* ── Footer ─────────────────────────────────────── */}
                <footer className="hp-footer">
                    <div className="hp-footer__inner">
                        <div>
                            <Link to="/" className="hp-nav__brand" style={{ textDecoration: 'none' }}>
                                <div className="hp-nav__logo-icon">
                                    <GraduationCap size={18} />
                                </div>
                                <span className="hp-nav__logo-text">EduNexus</span>
                            </Link>
                            <p className="hp-footer__brand-text">
                                Empowering the next generation of professionals through accessible, premium education.
                            </p>
                        </div>
                        <div className="hp-footer__col">
                            <h4>Platform</h4>
                            <ul>
                                <li><Link to="/courses">All Courses</Link></li>
                                <li><Link to="/register">Sign Up</Link></li>
                                <li><Link to="/login">Log In</Link></li>
                            </ul>
                        </div>
                        <div className="hp-footer__col">
                            <h4>Legal</h4>
                            <ul>
                                <li><Link to="/terms">Terms of Service</Link></li>
                                <li><Link to="/privacy">Privacy Policy</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="hp-footer__bottom">
                        © {new Date().getFullYear()} EduNexus Inc. All rights reserved.
                    </div>
                </footer>
            </div>
        </>
    );
}
