import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatMessageInput,
  ChatSummarizer,
  SummarizerOptions,
  SummaryResult,
} from '../../../../shared/ai/chat-summary';
import { DatadogMetricsService } from '../monitoring/datadog.service';
import { VectorStore, VectorStorePayload } from './vector-store.service';
import { VECTOR_STORE_TOKEN } from './vector-store.token';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class ChatSummaryService {
  private readonly summarizer: ChatSummarizer;
  private readonly logger = new Logger(ChatSummaryService.name);

  constructor(
    configService: ConfigService,
    private readonly metrics: DatadogMetricsService,
    @Inject(VECTOR_STORE_TOKEN) private readonly vectorStore: VectorStore,
  ) {
    const provider = (configService.get<string>('CHAT_SUMMARIZER_PROVIDER') ?? 'mock') as SummarizerOptions['provider'];
    const model = configService.get<string>('CHAT_SUMMARIZER_MODEL');
    const apiKey = configService.get<string>('CHAT_SUMMARIZER_API_KEY');
    const apiKeySecretId = configService.get<string>('CHAT_SUMMARIZER_SECRET_ID');
    const secretRegion = configService.get<string>('CHAT_SUMMARIZER_SECRET_REGION') ?? process.env.AWS_REGION;
    const embeddingModel = configService.get<string>('CHAT_SUMMARIZER_EMBEDDING_MODEL');
    const language = (configService.get<string>('CHAT_SUMMARIZER_LANGUAGE') ?? 'ja') as 'ja' | 'en';
    const maxChars = Number(configService.get<number>('CHAT_SUMMARIZER_MAX_CHARS') ?? 6_000);
    const retryAttempts = Number(configService.get<number>('CHAT_SUMMARIZER_RETRY_ATTEMPTS') ?? 4);
    const retryBaseDelayMs = Number(configService.get<number>('CHAT_SUMMARIZER_RETRY_BASE_MS') ?? 500);
    const retryMaxDelayMs = Number(configService.get<number>('CHAT_SUMMARIZER_RETRY_MAX_MS') ?? 5_000);

    const secretsManager = apiKeySecretId ? new SecretsManagerClient({ region: secretRegion }) : undefined;

    const loggerAdapter = {
      info: (message: string, meta?: Record<string, unknown>) => this.logger.log(this.formatLog(message, meta)),
      warn: (message: string, meta?: Record<string, unknown>) => this.logger.warn(this.formatLog(message, meta)),
      error: (message: string | Error, meta?: Record<string, unknown>) =>
        this.logger.error(this.formatLog(message instanceof Error ? message.message : message, meta)),
    };

    this.summarizer = new ChatSummarizer({
      provider,
      apiKey,
      resolveApiKey: apiKeySecretId
        ? async () => {
            try {
              if (!secretsManager) {
                return undefined;
              }
              const response = await secretsManager.send(
                new GetSecretValueCommand({
                  SecretId: apiKeySecretId,
                }),
              );
              if (response.SecretString) {
                try {
                  const parsed = JSON.parse(response.SecretString) as { apiKey?: unknown };
                  if (parsed && typeof parsed.apiKey === 'string') {
                    return parsed.apiKey;
                  }
                } catch {
                  return response.SecretString;
                }
                return response.SecretString;
              }
            } catch (error) {
              this.logger.warn('Failed to resolve OpenAI API key from Secrets Manager', error as Error);
            }
            return undefined;
          }
        : undefined,
      model,
      embeddingModel,
      targetLanguage: language,
      maxCharactersPerChunk: maxChars,
      retry: {
        attempts: retryAttempts,
        baseDelayMs: retryBaseDelayMs,
        maxDelayMs: retryMaxDelayMs,
      },
      metrics: this.metrics,
      logger: loggerAdapter,
    });
  }

  async summarize(messages: ChatMessageInput[], metadata?: Omit<VectorStorePayload, 'embedding' | 'summary'>): Promise<SummaryResult> {
    const result = await this.summarizer.summarize(messages);
    if (metadata) {
      await this.vectorStore.saveEmbedding({
        ...metadata,
        embedding: result.embedding,
        summary: result.summary,
      });
    }
    return result;
  }

  private formatLog(message: string, meta?: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) {
      return message;
    }
    return `${message} ${JSON.stringify(meta)}`;
  }
}
