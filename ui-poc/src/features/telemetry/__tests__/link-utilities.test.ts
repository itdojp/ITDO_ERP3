import { describe, expect, it } from 'vitest';

import { collectRelatedLinks, extractStringEntries } from '../link-utilities';

describe('extractStringEntries', () => {
  it('collects strings from nested objects and arrays with paths', () => {
    const input = {
      id: 'root',
      meta: {
        shareUrl: 'https://example.com/projects?status=active',
        nested: [{ value: 'alpha' }, { value: 'beta' }],
      },
      tags: ['DX', 'SAP'],
      count: 5,
    };

    const entries = extractStringEntries(input);
    const values = entries.map((entry) => entry.value);
    expect(values).toContain('root');
    expect(values).toContain('https://example.com/projects?status=active');
    expect(values).toContain('alpha');
    expect(values).toContain('beta');
    const shareEntry = entries.find((entry) => entry.value.includes('projects'));
    expect(shareEntry?.path).toBe('meta.shareUrl');
  });

  it('ignores non-string primitives and prevents infinite loops', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    cyclic.message = 'loop';

    const entries = extractStringEntries(cyclic);
    expect(entries.some((entry) => entry.value === 'loop')).toBe(true);
    expect(entries.length).toBe(1);
  });
});

describe('collectRelatedLinks', () => {
  it('extracts Slack and Projects links from telemetry detail', () => {
    const detail = {
      shareUrl: 'https://app.example.com/projects?status=active',
      note: 'https://slack.com/app_redirect?channel=proj-updates',
      fallback: {
        projectId: 'PRJ-1001',
      },
      audit: {
        urls: ['slack://channel?id=ABC123'],
      },
    };

    const { projectLinks, slackLinks } = collectRelatedLinks(detail, { projectsPagePath: '/custom-projects' });
    expect(slackLinks).toHaveLength(2);
    expect(slackLinks).toContain('https://slack.com/app_redirect?channel=proj-updates');
    expect(slackLinks).toContain('slack://channel?id=ABC123');
    expect(projectLinks).toHaveLength(1);
    expect(projectLinks[0]).toEqual({ href: 'https://app.example.com/projects?status=active', label: 'Projects 画面で開く' });
  });

  it('falls back to keyword search when share URL is missing', () => {
    const detail = {
      summary: 'No direct URL',
      projectCode: 'DX-2025',
    };

    const { projectLinks } = collectRelatedLinks(detail, { projectsPagePath: '/projects' });
    expect(projectLinks).toHaveLength(1);
    expect(projectLinks[0].href).toBe('/projects?keyword=DX-2025');
    expect(projectLinks[0].label).toBe('Projects: DX-2025');
  });

  it('rewrites Slack links when workspace base URL is provided', () => {
    const detail = {
      audit: {
        urls: ['https://slack.com/archives/ABC123/p1680000000000'],
      },
    };

    const { slackLinks } = collectRelatedLinks(detail, {
      slackWorkspaceBaseUrl: 'https://itdo-workspace.slack.com/',
    });
    expect(slackLinks).toEqual(['https://itdo-workspace.slack.com/archives/ABC123/p1680000000000']);
  });
});
