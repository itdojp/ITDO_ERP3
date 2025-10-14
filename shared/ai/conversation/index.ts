export interface ConversationSummaryRequest {
  customerId: string;
  contactId?: string;
  interactionText: string;
}

export interface ConversationSummary {
  summary: string;
  followUps: string[];
  confidence: number;
}

/**
 * ConversationSummaryClient は Phase2 で LangGraph / OpenAI を接続するまでの暫定スタブです。
 * 現段階では deterministic なモックレスポンスを返し、アプリケーションの統合箇所を確認します。
 */
export class ConversationSummaryClient {
  async summarize(request: ConversationSummaryRequest): Promise<ConversationSummary> {
    const { interactionText } = request;
    const preview = interactionText.slice(0, 120);
    return {
      summary: `要約準備中: ${preview}`,
      followUps: ['次回のフォローアップを定義してください'],
      confidence: 0.0,
    };
  }
}
