import { describe, it, expect } from 'vitest';
import { ChatSummarizer } from '../../../shared/ai/chat-summary';

describe('ChatSummarizer', () => {
  it('returns mock summary when provider is mock', async () => {
    const summarizer = new ChatSummarizer({ provider: 'mock' });
    const result = await summarizer.summarize([
      { author: 'Alice', content: 'Kickoff meeting scheduled', postedAt: '2025-10-01T09:00:00Z' },
      { author: 'Bob', content: 'Updating timeline for sprint 3', postedAt: '2025-10-01T10:00:00Z' },
    ]);
    expect(result.summary).toContain('Alice');
    expect(result.summary).toContain('Bob');
    expect(result.embedding).toHaveLength(16);
  });
});
