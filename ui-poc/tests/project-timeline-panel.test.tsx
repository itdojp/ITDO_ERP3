/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectTimelinePanel } from '../src/features/project-timeline/ProjectTimelinePanel';

declare const global: typeof globalThis & { fetch: ReturnType<typeof vi.fn> };

function withQuery(children: React.ReactNode) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ProjectTimelinePanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        projectId: 'proj-123',
        tasks: [
          {
            id: 't-1',
            name: 'Kickoff',
            startDate: '2025-10-01',
            endDate: '2025-10-03',
            status: 'done',
          },
        ],
        metrics: {
          plannedValue: 100,
          earnedValue: 90,
          actualCost: 80,
          cpi: 1.125,
          spi: 0.9,
        },
        chatSummary: '最新の会話ポイント: ...',
      }),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders metrics and chat summary', async () => {
    render(withQuery(<ProjectTimelinePanel projectId="proj-123" />));

    await waitFor(() => expect(screen.getByText('PV')).toBeInTheDocument());
    expect(screen.getByText('最新の会話ポイント: ...')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/proj-123/timeline');
  });
});
