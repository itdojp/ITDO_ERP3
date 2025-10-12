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
export declare function buildShareTemplate(options: ShareTemplateOptions): ShareTemplateResult;
