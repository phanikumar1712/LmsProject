/**
 * SystemHealth — tests for the system health dashboard page.
 * This component uses its own useState/useEffect (not useAsyncData),
 * so we mock statsAPI.getSystemHealth to resolve with fixture data.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Fixture data ─────────────────────────────────────────────────────────────

const HEALTH_DATA = {
    services: [
        { name: 'API Server', desc: 'Core backend REST API', status: 'operational', uptime: '99.98%', latency: '26ms', icon: 'Server' },
        { name: 'Database (PostgreSQL)', desc: 'Primary relational database', status: 'operational', uptime: '99.99%', latency: '371ms', icon: 'Database' },
        { name: 'CDN', desc: 'Static asset delivery', status: 'degraded', uptime: '98.5%', latency: '145ms', icon: 'Globe' },
    ],
    memory: { heapUsed: 128, heapTotal: 256 },
    uptime: 7200,
    platform: 'linux',
    nodeVersion: 'v22.23.1',
    timestamp: new Date().toISOString(),
};

const ALL_OPERATIONAL = {
    ...HEALTH_DATA,
    services: HEALTH_DATA.services.map(s => ({ ...s, status: 'operational' })),
};

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

const mockGetSystemHealth = vi.fn().mockResolvedValue(HEALTH_DATA);

vi.mock('../../../../services/api', () => ({
    statsAPI: {
        getSystemHealth: (...args) => mockGetSystemHealth(...args),
    },
}));

// No need to mock useAsyncData — SystemHealth uses its own state

import SystemHealth from '../SystemHealth';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SystemHealth', () => {
    it('renders all three infrastructure services', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('API Server')).toBeInTheDocument();
        expect(screen.getByText('Database (PostgreSQL)')).toBeInTheDocument();
        expect(screen.getByText('CDN')).toBeInTheDocument();
    });

    it('shows correct service descriptions', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('Core backend REST API')).toBeInTheDocument();
        expect(screen.getByText('Primary relational database')).toBeInTheDocument();
        expect(screen.getByText('Static asset delivery')).toBeInTheDocument();
    });

    it('displays operational status for working services', async () => {
        render(<SystemHealth />);
        await screen.findByText('API Server');
        const operationalBadges = screen.getAllByText('Operational');
        expect(operationalBadges.length).toBe(2);
    });

    it('displays degraded status for CDN', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('Degraded')).toBeInTheDocument();
    });

    it('shows latency for each service', async () => {
        render(<SystemHealth />);
        await screen.findByText('API Server');
        expect(screen.getByText('26ms')).toBeInTheDocument();
        expect(screen.getByText('371ms')).toBeInTheDocument();
        expect(screen.getByText('145ms')).toBeInTheDocument();
    });

    it('shows uptime percentages', async () => {
        render(<SystemHealth />);
        await screen.findByText('API Server');
        expect(screen.getByText('99.98%')).toBeInTheDocument();
        expect(screen.getByText('99.99%')).toBeInTheDocument();
        expect(screen.getByText('98.5%')).toBeInTheDocument();
    });

    it('renders degraded banner when not all services are healthy', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText(/1 Service Degraded/)).toBeInTheDocument();
    });

    it('shows memory usage', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('128MB')).toBeInTheDocument();
    });

    it('shows uptime in hours and minutes', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText(/2h/)).toBeInTheDocument();
        expect(screen.getByText(/0m/)).toBeInTheDocument();
    });

    it('shows platform and node version', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText(/linux/)).toBeInTheDocument();
        // nodeVersion is 'v22.23.1', split('.')[0] = 'v22'
        expect(screen.getByText(/v22/)).toBeInTheDocument();
    });

    it('renders system log section', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('System Log')).toBeInTheDocument();
        expect(screen.getByText('DB Performance Optimization')).toBeInTheDocument();
        expect(screen.getByText('Email delay')).toBeInTheDocument();
    });

    it('shows resolved incident statuses', async () => {
        render(<SystemHealth />);
        await screen.findByText('System Log');
        const resolved = screen.getAllByText('resolved');
        expect(resolved.length).toBe(2);
    });

    it('renders Refresh button', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('Refresh')).toBeInTheDocument();
    });

    it('renders the page title', async () => {
        render(<SystemHealth />);
        expect(await screen.findByText('System Health')).toBeInTheDocument();
    });

    it('shows operational banner when all services are healthy', async () => {
        mockGetSystemHealth.mockResolvedValueOnce(ALL_OPERATIONAL);
        render(<SystemHealth />);
        expect(await screen.findByText('All Systems Operational')).toBeInTheDocument();
    });
});
