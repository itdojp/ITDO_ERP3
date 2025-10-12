export interface ShareTemplateFilters {
  status: string;
  statusLabel?: string;
  keyword?: string;
  manager?: string;
  health?: string;
  tags?: ReadonlyArray<string>;
  count?: number | null | undefined;
}

export interface ShareTemplateMetrics {
  totalProjects?: number | null;
  riskProjects?: number | null;
  warningProjects?: number | null;
  [key: string]: unknown;
}

export interface ShareTemplateOptions {
  title?: string | null;
  url: string;
  notes?: string | null;
  filters: ShareTemplateFilters;
  generatedAt?: Date;
  timezone?: string;
  includeFilterFallback?: boolean;
  metrics?: ShareTemplateMetrics | null;
  formatTimestamp?: (date: Date) => string;
}

export interface ShareTemplatePayload {
  title: string;
  url: string;
  generatedAt: string;
  filters: {
    status: string;
    statusLabel?: string;
    keyword: string;
    manager: string;
    health: string;
    tags: string[];
    count?: number | null;
  };
  notes: string;
  message: string;
  projectCount: number | null;
  metrics?: ShareTemplateMetrics;
}

export interface ShareTemplateResult {
  text: string;
  markdown: string;
  json: string;
  payload: ShareTemplatePayload;
  bulletLines: string[];
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeMetricValue = (value: unknown): number | null => {
  if (isFiniteNumber(value)) {
    return Math.trunc(value);
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.trunc(parsed);
  }
  return null;
};

const defaultTimestampFormatter = (date: Date, timezone?: string): string =>
  date.toLocaleString("ja-JP", { hour12: false, timeZone: timezone ?? "Asia/Tokyo" });

export function buildShareTemplate(options: ShareTemplateOptions): ShareTemplateResult {
  if (!options || typeof options.url !== "string" || options.url.trim().length === 0) {
    throw new Error("buildShareTemplate requires a valid url");
  }

  const generatedAt = options.generatedAt ?? new Date();
  const formatTimestamp =
    typeof options.formatTimestamp === "function"
      ? options.formatTimestamp
      : (date: Date) => defaultTimestampFormatter(date, options.timezone);

  const filters = options.filters ?? ({} as ShareTemplateFilters);
  const trimmedKeyword = (filters.keyword ?? "").trim();
  const trimmedManager = (filters.manager ?? "").trim();
  const trimmedHealth = (filters.health ?? "").trim();
  const tagValues = Array.isArray(filters.tags)
    ? filters.tags.map((value) => value?.trim()).filter((value): value is string => !!value)
    : [];
  const sanitizedCount = isFiniteNumber(filters.count) ? Math.trunc(filters.count) : null;
  const rawNotes = options.notes ?? "";
  const trimmedNotes = rawNotes.trim();
  const bulletLines: string[] = [];

  const normalizedStatus = (filters.status ?? "").trim();
  if (normalizedStatus && normalizedStatus.toLowerCase() !== "all") {
    const statusLabel = filters.statusLabel?.trim() || normalizedStatus;
    bulletLines.push(`• ステータス: *${statusLabel}*`);
  }
  if (sanitizedCount !== null) {
    bulletLines.push(`• 件数: ${sanitizedCount}`);
  }
  if (trimmedKeyword.length > 0) {
    bulletLines.push(`• キーワード: \`${trimmedKeyword}\``);
  }
  if (trimmedManager.length > 0) {
    bulletLines.push(`• マネージャ: ${trimmedManager}`);
  }
  if (trimmedHealth.length > 0) {
    bulletLines.push(`• ヘルス: ${trimmedHealth}`);
  }
  if (tagValues.length > 0) {
    bulletLines.push(`• タグ: ${tagValues.join(", ")}`);
  }
  if (trimmedNotes.length > 0) {
    bulletLines.push(`• メモ: ${trimmedNotes}`);
  }
  if ((options.includeFilterFallback ?? true) && bulletLines.length === 0) {
    bulletLines.push("• フィルタ: 指定なし");
  }

  const rawMetrics = options.metrics ?? undefined;
  let sanitizedMetrics: ShareTemplateMetrics | undefined;
  if (rawMetrics && typeof rawMetrics === "object") {
    const total = normalizeMetricValue((rawMetrics as Record<string, unknown>).totalProjects);
    const risk = normalizeMetricValue((rawMetrics as Record<string, unknown>).riskProjects);
    const warning = normalizeMetricValue((rawMetrics as Record<string, unknown>).warningProjects);
    if (total !== null) {
      bulletLines.push(`• API 件数: ${total}`);
    }
    if (risk !== null) {
      bulletLines.push(`• リスク件数: ${risk}`);
    }
    if (warning !== null) {
      bulletLines.push(`• 警戒件数: ${warning}`);
    }
    sanitizedMetrics = { ...rawMetrics };
    if (total !== null) {
      sanitizedMetrics.totalProjects = total;
    }
    if (risk !== null) {
      sanitizedMetrics.riskProjects = risk;
    }
    if (warning !== null) {
      sanitizedMetrics.warningProjects = warning;
    }
  }

  const effectiveTitle =
    typeof options.title === "string" && options.title.trim().length > 0
      ? options.title.trim()
      : "Projects 共有リンク";
  const formattedTimestamp = formatTimestamp(generatedAt);
  const messageLines = [
    `:clipboard: *${effectiveTitle}* _(${formattedTimestamp})_`,
    options.url,
    "",
    ...bulletLines,
  ];
  const text = messageLines.join("\n");
  const markdown = [
    `**${effectiveTitle}** (_${formattedTimestamp}_)`,
    options.url,
    "",
    ...bulletLines.map((line) => line.replace(/^• /, "- ")),
  ].join("\n");

  const payload: ShareTemplatePayload = {
    title: effectiveTitle,
    url: options.url,
    generatedAt: generatedAt.toISOString(),
    filters: {
      status: normalizedStatus || "all",
      statusLabel: filters.statusLabel,
      keyword: trimmedKeyword,
      manager: trimmedManager,
      health: trimmedHealth,
      tags: tagValues,
      count: sanitizedCount,
    },
    notes: trimmedNotes,
    message: text,
    projectCount: sanitizedCount,
  };
  if (sanitizedMetrics) {
    payload.metrics = sanitizedMetrics;
  }

  const json = JSON.stringify(payload, null, 2);

  return {
    text,
    markdown,
    json,
    payload,
    bulletLines,
  };
}
