/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectTimelinePanel } from '../src/features/project-timeline/ProjectTimelinePanel';

declare const global: typeof globalThis & { fetch: ReturnType<typeof vi.fn> };

function withQuery(children: React.ReactNode) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ProjectTimelinePanel', () => {
  beforeEach(() => {
    const responses: Record<string, unknown> = {
      '/api/v1/projects/proj-123/timeline': {
        projectId: 'proj-123',
        tasks: [
          {
            id: 't-1',
            name: 'Kickoff',
            startDate: '2025-10-01',
            endDate: '2025-10-03',
            status: 'done',
            phase: 'Initiation',
          },
          {
            id: 't-2',
            name: 'Integration',
            startDate: '2025-10-04',
            endDate: '2025-10-30',
            status: 'inProgress',
            phase: 'Execution',
          },
        ],
        phases: [
          { id: 'phase-init', name: 'Initiation', sortOrder: 1 },
          { id: 'phase-exec', name: 'Execution', sortOrder: 2 },
        ],
        metrics: {
          plannedValue: 100,
          earnedValue: 90,
          actualCost: 80,
          cpi: 1.125,
          spi: 0.9,
        },
        chatSummary: '最新の会話ポイント: ...',
      },
      '/api/v1/projects/proj-123/metrics': {
        projectId: 'proj-123',
        evm: {
          plannedValue: 100,
          earnedValue: 90,
          actualCost: 80,
          cpi: 1.125,
          spi: 0.9,
        },
        burndown: {
          labels: ['Sprint 1'],
          planned: [100],
          actual: [90],
        },
        risks: [{ id: 'risk-1', probability: 40, impact: 3, status: 'monitoring' }],
      },
    };

    global.fetch = vi.fn().mockImplementation((url: RequestInfo) => {
      const payload = responses[String(url)];
      if (!payload) {
        throw new Error(`Unexpected fetch call: ${String(url)}`);
      }
      return Promise.resolve({
        ok: true,
        json: async () => payload,
      }) as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders metrics and chat summary', async () => {
    render(withQuery(<ProjectTimelinePanel projectId="proj-123" />));

    await waitFor(() => expect(screen.getByText('PV')).toBeInTheDocument());
    expect(screen.getByText('最新の会話ポイント: ...')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/proj-123/timeline');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/proj-123/metrics');
  });

  it('filters tasks by status and phase', async () => {
    render(withQuery(<ProjectTimelinePanel projectId="proj-123" />));

    await waitFor(() => expect(screen.getByRole('button', { name: /Kickoff/ })).toBeInTheDocument());

    const inProgressButton = screen.getByRole('button', { name: 'inProgress' });
    fireEvent.click(inProgressButton); // disable inProgress

    expect(screen.queryByRole('button', { name: /Integration/ })).not.toBeInTheDocument();

    const phaseSelect = screen.getByLabelText('Phase');
    fireEvent.change(phaseSelect, { target: { value: 'Execution' } });

    expect(screen.queryByRole('button', { name: /Kickoff/ })).not.toBeInTheDocument();
  });

  it('updates detail card when selecting tasks', async () => {
    render(withQuery(<ProjectTimelinePanel projectId="proj-123" />));

    const integrationButton = await screen.findByRole('button', { name: /Integration/i });
    fireEvent.click(integrationButton);
    const detailSectionList = screen.getAllByTestId('timeline-task-detail');
    const detailSection = detailSectionList.find((section) => section.getAttribute('data-selected-task') === 't-2');
    expect(detailSection).toBeDefined();
    await waitFor(() => expect(detailSection?.getAttribute('data-selected-task')).toBe('t-2'));
    const scoped = within(detailSection as HTMLElement);
    expect(scoped.getByText(/Execution/)).toBeInTheDocument();
  });
});
