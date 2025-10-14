import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatMessageInput,
  ChatSummarizer,
  SummarizerOptions,
  SummaryResult,
} from '../../../../shared/ai/chat-summary';

@Injectable()
export class ChatSummaryService {
  private readonly summarizer: ChatSummarizer;

  constructor(configService: ConfigService) {
    const provider = (configService.get<string>('CHAT_SUMMARIZER_PROVIDER') ?? 'mock') as SummarizerOptions['provider'];
    const apiKey = configService.get<string>('CHAT_SUMMARIZER_API_KEY');
    const model = configService.get<string>('CHAT_SUMMARIZER_MODEL');

    this.summarizer = new ChatSummarizer({
      provider,
      apiKey,
      model,
    });
  }

  summarize(messages: ChatMessageInput[]): Promise<SummaryResult> {
    return this.summarizer.summarize(messages);
  }
}
