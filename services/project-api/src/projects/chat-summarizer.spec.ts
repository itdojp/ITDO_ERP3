import { ChatSummarizer, ChatMessageInput, MetricsEmitter } from '../../../../shared/ai/chat-summary';

describe('ChatSummarizer', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    }
    jest.clearAllMocks();
  });

  it('returns mock summary when provider is mock', async () => {
    const metrics: MetricsEmitter = {
      increment: jest.fn(),
      timing: jest.fn(),
    };
    const summarizer = new ChatSummarizer({
      provider: 'mock',
      metrics,
    });

    const messages: ChatMessageInput[] = [
      { author: 'PM', content: 'Hello world', postedAt: new Date().toISOString() },
    ];
    const result = await summarizer.summarize(messages);

    expect(result.summary).toContain('最新の会話ポイント');
    expect(result.embedding.length).toBeGreaterThan(0);
    expect(result.language).toBe('ja');
    expect(metrics.increment).toHaveBeenCalledWith('chat_summarizer.mock_usage', 1, []);
  });

  it('chunks messages and merges OpenAI responses', async () => {
    const metrics: MetricsEmitter = {
      increment: jest.fn(),
      timing: jest.fn(),
    };

    const fetchMock = jest.fn()
      // chat completion first chunk
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Summary chunk 1' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // chat completion second chunk
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Summary chunk 2' } }],
            usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // embedding call
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ embedding: [0.1, 0.2, 0.3] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    global.fetch = fetchMock as unknown as typeof fetch;

    const summarizer = new ChatSummarizer({
      provider: 'openai',
      apiKey: 'test-key',
      targetLanguage: 'en',
      maxCharactersPerChunk: 50,
      metrics,
    });

    const messages: ChatMessageInput[] = [
      { author: 'User', content: 'Hello'.repeat(10), postedAt: new Date().toISOString() },
      { author: 'User', content: 'World'.repeat(10), postedAt: new Date().toISOString() },
    ];

    const result = await summarizer.summarize(messages);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.summary).toContain('Summary chunk 1');
    expect(result.summary).toContain('Summary chunk 2');
    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.language).toBe('en');
    expect(result.usage.totalTokens).toBe(27);
    expect(metrics.increment).toHaveBeenCalledWith('chat_summarizer.success', 1, ['provider:openai']);
  });
});
