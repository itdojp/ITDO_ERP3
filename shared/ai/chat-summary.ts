import crypto from 'node:crypto';

export interface ChatMessageInput {
  author: string;
  content: string;
  postedAt: string;
}

export interface SummaryResult {
  summary: string;
  embedding: number[];
  language: 'en' | 'ja';
  usage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
}

export type SummarizerProvider = 'openai' | 'mock';

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface MetricsEmitter {
  increment(metric: string, value?: number, tags?: string[]): void;
  timing(metric: string, value: number, tags?: string[]): void;
}

export interface LoggerLike {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string | Error, meta?: Record<string, unknown>): void;
}

export interface SummarizerOptions {
  provider?: SummarizerProvider;
  apiKey?: string;
  resolveApiKey?: () => Promise<string | undefined>;
  model?: string;
  embeddingModel?: string;
  targetLanguage?: 'ja' | 'en';
  maxCharactersPerChunk?: number;
  retry?: RetryOptions;
  metrics?: MetricsEmitter;
  logger?: LoggerLike;
}

interface UsageLike {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

const DEFAULT_RETRY: RetryOptions = {
  attempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 5_000,
};

const DEFAULT_MAX_CHARS = 6_000;

export class ChatSummarizer {
  private apiKeyPromise?: Promise<string | undefined>;

  constructor(private readonly options: SummarizerOptions = {}) {}

  async summarize(messages: ChatMessageInput[]): Promise<SummaryResult> {
    const start = Date.now();
    if (messages.length === 0) {
      this.emitMetrics('chat_summarizer.empty_messages', 1);
      return {
        summary: 'No conversation available.',
        embedding: [],
        language: this.options.targetLanguage ?? 'ja',
        usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
      };
    }

    const apiKey = await this.resolveApiKey();
    if (this.options.provider === 'mock' || !apiKey) {
      this.log('info', 'Using mock summarizer (provider unset or API key missing)');
      const mockResult = this.mockSummarize(messages);
      this.emitMetrics('chat_summarizer.mock_usage', 1);
      return mockResult;
    }

    const retry = this.options.retry ?? DEFAULT_RETRY;
    const targetLanguage = this.options.targetLanguage ?? 'ja';
    const chunks = this.chunkMessages(messages);
    const summaries: string[] = [];
    let aggregatedUsage: UsageLike = {};
    for (const chunk of chunks) {
      const { summary, usage } = await this.fetchSummaryFromOpenAI(chunk, apiKey, retry, targetLanguage);
      summaries.push(summary);
      aggregatedUsage = {
        total_tokens: (aggregatedUsage.total_tokens ?? 0) + (usage.total_tokens ?? 0),
        prompt_tokens: (aggregatedUsage.prompt_tokens ?? 0) + (usage.prompt_tokens ?? 0),
        completion_tokens: (aggregatedUsage.completion_tokens ?? 0) + (usage.completion_tokens ?? 0),
      };
    }

    const finalSummary = summaries.join('\n\n');
    const embedding = await this.fetchEmbeddingFromOpenAI(finalSummary, apiKey, retry);
    const elapsed = Date.now() - start;
    this.emitMetrics('chat_summarizer.success', 1, [`provider:${this.options.provider ?? 'openai'}`]);
    this.emitTiming('chat_summarizer.duration_ms', elapsed, [`chunks:${chunks.length}`]);

    return {
      summary: finalSummary,
      embedding,
      language: targetLanguage,
      usage: {
        totalTokens: aggregatedUsage.total_tokens ?? 0,
        promptTokens: aggregatedUsage.prompt_tokens ?? 0,
        completionTokens: aggregatedUsage.completion_tokens ?? 0,
      },
    };
  }

  private async fetchSummaryFromOpenAI(
    content: string,
    apiKey: string,
    retry: RetryOptions,
    targetLanguage: 'ja' | 'en',
  ) {
    const requestBody = {
      model: this.options.model ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            targetLanguage === 'ja'
              ? '以下の会話を日本語で要約し、重要なリスク・懸念点があれば列挙してください。'
              : 'Summarize the following project chat in English and list any risks or concerns.',
        },
        { role: 'user', content },
      ],
      temperature: 0.2,
    };

    const usage: UsageLike = {};
    const response = await this.withRetry(
      () =>
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }),
      retry,
      'chat-completions',
    );

    if (!response.ok) {
      this.emitMetrics('chat_summarizer.failure', 1, [`status:${response.status}`]);
      throw new Error(`Failed to summarize chat: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: UsageLike;
    };
    const summary = json.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('OpenAI response did not include summary content');
    }
    Object.assign(usage, json.usage ?? {});
    return { summary, usage };
  }

  private async fetchEmbeddingFromOpenAI(content: string, apiKey: string, retry: RetryOptions): Promise<number[]> {
    if (this.options.provider !== 'openai') {
      return this.computeFallbackEmbedding(content);
    }

    try {
      const requestBody = {
        model: this.options.embeddingModel ?? 'text-embedding-3-small',
        input: content,
      };

      const response = await this.withRetry(
        () =>
          fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
          }),
        retry,
        'embeddings',
      );

      if (!response.ok) {
        this.log('warn', 'Embedding request failed, falling back to hash embedding', { status: response.status });
        return this.computeFallbackEmbedding(content);
      }

      const json = (await response.json()) as { data?: { embedding?: number[] }[] };
      const embedding = json.data?.[0]?.embedding;
      if (!embedding) {
        this.log('warn', 'Embedding response missing embedding vector, falling back to hash embedding');
        return this.computeFallbackEmbedding(content);
      }
      return embedding;
    } catch (error) {
      this.log('warn', 'Embedding request threw error, falling back to hash embedding', { error });
      return this.computeFallbackEmbedding(content);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, retry: RetryOptions, label: string, attempt = 1): Promise<T> {
    try {
      const result = await fn();
      if (attempt > 1) {
        this.emitMetrics('chat_summarizer.retry_success', 1, [`label:${label}`, `attempt:${attempt}`]);
      }
      return result;
    } catch (error) {
      if (attempt >= retry.attempts) {
        this.emitMetrics('chat_summarizer.retry_exhausted', 1, [`label:${label}`]);
        throw error;
      }
      const delay = Math.min(retry.baseDelayMs * 2 ** (attempt - 1), retry.maxDelayMs);
      this.log('warn', `Retrying ${label} after ${delay}ms`, { attempt, error });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.withRetry(fn, retry, label, attempt + 1);
    }
  }

  private chunkMessages(messages: ChatMessageInput[]): string[] {
    const maxChars = this.options.maxCharactersPerChunk ?? DEFAULT_MAX_CHARS;
    const sorted = [...messages].sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
    const chunks: string[] = [];
    let current = '';
    for (const message of sorted) {
      const line = `${message.author} (${message.postedAt}): ${message.content}\n`;
      if ((current + line).length > maxChars && current.length > 0) {
        chunks.push(current.trimEnd());
        current = '';
      }
      current += line;
    }
    if (current.length > 0) {
      chunks.push(current.trimEnd());
    }
    return chunks;
  }

  private mockSummarize(messages: ChatMessageInput[]): SummaryResult {
    const joined = messages
      .slice(-5)
      .map((m) => `・${m.author}: ${m.content}`)
      .join('\n');
    return {
      summary: `最新の会話ポイント:\n${joined}`,
      embedding: this.computeFallbackEmbedding(joined),
      language: this.options.targetLanguage ?? 'ja',
      usage: { totalTokens: joined.length, promptTokens: joined.length, completionTokens: 0 },
    };
  }

  private computeFallbackEmbedding(text: string): number[] {
    const hash = crypto.createHash('sha256').update(text).digest();
    return Array.from(hash)
      .slice(0, 256)
      .map((byte) => +(byte / 255).toFixed(6));
  }

  private async resolveApiKey(): Promise<string | undefined> {
    if (!this.apiKeyPromise) {
      this.apiKeyPromise = (async () => {
        if (this.options.apiKey) {
          return this.options.apiKey;
        }
        if (this.options.resolveApiKey) {
          try {
            const secret = await this.options.resolveApiKey();
            if (secret) {
              return secret;
            }
          } catch (error) {
            this.log('warn', 'Custom API key resolver failed', { error });
          }
        }
        return process.env.OPENAI_API_KEY;
      })();
    }
    return this.apiKeyPromise;
  }

  private emitMetrics(metric: string, value: number, tags: string[] = []) {
    if (this.options.metrics) {
      try {
        this.options.metrics.increment(metric, value, tags);
      } catch {
        // ignore metrics failures
      }
    }
  }

  private emitTiming(metric: string, value: number, tags: string[] = []) {
    if (this.options.metrics) {
      try {
        this.options.metrics.timing(metric, value, tags);
      } catch {
        // ignore metrics failures
      }
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}) {
    if (!this.options.logger) {
      if (level === 'error') {
        console.error(message, meta);
      } else if (level === 'warn') {
        console.warn(message, meta);
      } else {
        console.info(message, meta);
      }
      return;
    }
    try {
      if (level === 'info') {
        this.options.logger.info(message, meta);
      } else if (level === 'warn') {
        this.options.logger.warn(message, meta);
      } else {
        this.options.logger.error(message, meta);
      }
    } catch {
      // swallow logger issues
    }
  }
}
