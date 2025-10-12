"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildShareTemplate = void 0;
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const normalizeMetricValue = (value) => {
    if (isFiniteNumber(value)) {
        return Math.trunc(value);
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
        return Math.trunc(parsed);
    }
    return null;
};
const defaultTimestampFormatter = (date, timezone) => date.toLocaleString("ja-JP", { hour12: false, timeZone: timezone !== null && timezone !== void 0 ? timezone : "Asia/Tokyo" });
function buildShareTemplate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (!options || typeof options.url !== "string" || options.url.trim().length === 0) {
        throw new Error("buildShareTemplate requires a valid url");
    }
    const generatedAt = (_a = options.generatedAt) !== null && _a !== void 0 ? _a : new Date();
    const formatTimestamp = typeof options.formatTimestamp === "function"
        ? options.formatTimestamp
        : (date) => defaultTimestampFormatter(date, options.timezone);
    const filters = (_b = options.filters) !== null && _b !== void 0 ? _b : {};
    const trimmedKeyword = ((_c = filters.keyword) !== null && _c !== void 0 ? _c : "").trim();
    const trimmedManager = ((_d = filters.manager) !== null && _d !== void 0 ? _d : "").trim();
    const trimmedHealth = ((_e = filters.health) !== null && _e !== void 0 ? _e : "").trim();
    const tagValues = Array.isArray(filters.tags)
        ? filters.tags.map((value) => value === null || value === void 0 ? void 0 : value.trim()).filter((value) => !!value)
        : [];
    const sanitizedCount = isFiniteNumber(filters.count) ? Math.trunc(filters.count) : null;
    const rawNotes = (_f = options.notes) !== null && _f !== void 0 ? _f : "";
    const trimmedNotes = rawNotes.trim();
    const bulletLines = [];
    const normalizedStatus = ((_g = filters.status) !== null && _g !== void 0 ? _g : "").trim();
    if (normalizedStatus && normalizedStatus.toLowerCase() !== "all") {
        const statusLabel = ((_h = filters.statusLabel) === null || _h === void 0 ? void 0 : _h.trim()) || normalizedStatus;
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
    if (((_j = options.includeFilterFallback) !== null && _j !== void 0 ? _j : true) && bulletLines.length === 0) {
        bulletLines.push("• フィルタ: 指定なし");
    }
    const rawMetrics = (_k = options.metrics) !== null && _k !== void 0 ? _k : undefined;
    let sanitizedMetrics;
    if (rawMetrics && typeof rawMetrics === "object") {
        const total = normalizeMetricValue(rawMetrics.totalProjects);
        const risk = normalizeMetricValue(rawMetrics.riskProjects);
        const warning = normalizeMetricValue(rawMetrics.warningProjects);
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
    const effectiveTitle = typeof options.title === "string" && options.title.trim().length > 0
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
    const payload = {
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
exports.buildShareTemplate = buildShareTemplate;
