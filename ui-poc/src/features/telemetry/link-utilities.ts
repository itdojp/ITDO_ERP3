type StringEntry = { path: string; value: string };

export function extractStringEntries(root: unknown): StringEntry[] {
  const result: StringEntry[] = [];
  const stack: Array<{ value: unknown; path: string }> = [{ value: root, path: '' }];
  const visited = new Set<unknown>();

  while (stack.length > 0) {
    const popped = stack.pop();
    if (!popped) {
      continue;
    }
    const { value, path } = popped;
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string') {
      result.push({ path, value });
      continue;
    }
    if (typeof value !== 'object') {
      continue;
    }
    if (visited.has(value)) {
      continue;
    }
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        stack.push({
          value: item,
          path: path ? `${path}[${index}]` : `[${index}]`,
        });
      });
    } else {
      Object.entries(value).forEach(([key, child]) => {
        stack.push({
          value: child,
          path: path ? `${path}.${key}` : key,
        });
      });
    }
  }

  return result;
}

type CollectedLinks = {
  projectLinks: Array<{ href: string; label: string }>;
  slackLinks: string[];
};

type LinkOptions = {
  projectsPagePath?: string;
};

const PROJECTS_REGEX = /\/projects\b/i;
const SLACK_HTTP_REGEX = /^https?:\/\//i;
const SLACK_SCHEME_REGEX = /^slack:\/\//i;

export function collectRelatedLinks(detail: unknown, options: LinkOptions = {}): CollectedLinks {
  if (!detail || typeof detail !== 'object') {
    return { projectLinks: [], slackLinks: [] };
  }

  const projectsPagePath = options.projectsPagePath ?? '/projects';
  const entries = extractStringEntries(detail);
  const slackSet = new Set<string>();

  entries.forEach(({ value }) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (SLACK_HTTP_REGEX.test(trimmed) && /slack\.com/i.test(trimmed)) {
      slackSet.add(trimmed);
      return;
    }
    if (SLACK_SCHEME_REGEX.test(trimmed)) {
      slackSet.add(trimmed);
    }
  });

  const slackLinks = Array.from(slackSet);
  const projectLinkSet = new Set<string>();
  const projectLinks: Array<{ href: string; label: string }> = [];
  const direct = detail as Record<string, unknown>;
  const shareUrlField = typeof direct.shareUrl === 'string' ? direct.shareUrl.trim() : '';
  const shareEntry = entries.find(({ value, path }) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (SLACK_HTTP_REGEX.test(trimmed) && PROJECTS_REGEX.test(trimmed)) return true;
    return /shareurl|projecturl/i.test(path) && SLACK_HTTP_REGEX.test(trimmed);
  });

  const registerProjectLink = (href: string, label: string) => {
    const trimmed = href.trim();
    if (!trimmed || projectLinkSet.has(trimmed)) return;
    projectLinkSet.add(trimmed);
    projectLinks.push({ href: trimmed, label });
  };

  if (shareEntry) {
    registerProjectLink(shareEntry.value, 'Projects 画面で開く');
  }
  if (shareUrlField) {
    registerProjectLink(shareUrlField, 'Projects 共有リンク');
  }
  if (projectLinks.length === 0) {
    const identifierEntry = entries.find(({ path }) => /project(id|code)$/i.test(path));
    const identifier = identifierEntry?.value.trim();
    if (identifier) {
      registerProjectLink(`${projectsPagePath}?keyword=${encodeURIComponent(identifier)}`, `Projects: ${identifier}`);
    }
  }

  return { projectLinks, slackLinks };
}

