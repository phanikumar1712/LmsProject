import React from 'react';

const EMOJI_OPTIONS = [
    { emoji: '📚', label: 'Book' },
    { emoji: '💻', label: 'Code' },
    { emoji: '🎨', label: 'Art' },
    { emoji: '📊', label: 'Data' },
    { emoji: '🌐', label: 'Web' },
    { emoji: '📱', label: 'Mobile' },
    { emoji: '🧮', label: 'Math' },
    { emoji: '🔬', label: 'Science' },
    { emoji: '🎵', label: 'Music' },
    { emoji: '🎬', label: 'Film' },
    { emoji: '📝', label: 'Writing' },
    { emoji: '🏗️', label: 'Build' },
    { emoji: '🎯', label: 'Target' },
    { emoji: '🚀', label: 'Launch' },
    { emoji: '💡', label: 'Idea' },
    { emoji: '🔧', label: 'Tools' },
    { emoji: '📖', label: 'Read' },
    { emoji: '🎓', label: 'Grad' },
    { emoji: '🏆', label: 'Award' },
    { emoji: '⚡', label: 'Light' },
];

export function CourseThumbnail({ thumbnail, title, className = '' }) {
    if (!thumbnail) {
        return (
            <div className={`w-full h-full flex items-center justify-center bg-muted ${className}`}>
                <span className="text-4xl">📚</span>
            </div>
        );
    }

    if (thumbnail.startsWith('emoji:')) {
        const emoji = thumbnail.replace('emoji:', '');
        return (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 ${className}`}>
                <span className="text-6xl select-none">{emoji}</span>
            </div>
        );
    }

    return (
        <img
            src={thumbnail}
            alt={title}
            className={`w-full h-full object-cover ${className}`}
            loading="lazy"
        />
    );
}

export { EMOJI_OPTIONS };