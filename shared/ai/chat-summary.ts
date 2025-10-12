import crypto from 'node:crypto';

export interface ChatMessageInput {
  author: string;
  content: string;
  postedAt: string;
}

export interface SummaryResult {
  summary: string;
  embedding: number[];
}

export interface SummarizerOptions {
  provider?: 'openai' | 'mock';
  apiKey?: string;
  model?: string;
}

export class ChatSummarizer {
  constructor(private readonly options: SummarizerOptions = {}) {}

  async summarize(messages: ChatMessageInput[]): Promise<SummaryResult> {
    if (messages.length === 0) {
      return { summary: 'No conversation available.', embedding: [] };
    }

    if (this.options.provider === 'mock' || !this.options.apiKey) {
      return this.mockSummarize(messages);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize the following project chat for internal stakeholders.' },
          {
            role: 'user',
            content: messages
              .map((m) => `${m.author} (${m.postedAt}): ${m.content}`)
              .join('\n'),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to summarize chat: ${response.status}`);
    }

    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const summary = json.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('OpenAI response did not include summary content');
    }
    return {
      summary,
      embedding: this.computeEmbedding(summary),
    };
  }

  private mockSummarize(messages: ChatMessageInput[]): SummaryResult {
    const joined = messages
      .slice(-5)
      .map((m) => `・${m.author}: ${m.content}`)
      .join('\n');
    return {
      summary: `最新の会話ポイント:\n${joined}`,
      embedding: this.computeEmbedding(joined),
    };
  }

  private computeEmbedding(text: string): number[] {
    const hash = crypto.createHash('sha256').update(text).digest();
    return Array.from(hash.slice(0, 16)).map((byte) => +(byte / 255).toFixed(4));
  }
}
