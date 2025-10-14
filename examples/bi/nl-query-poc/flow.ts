/*
 * LangGraph 風の自然言語クエリ PoC。
 * 実装時には @langchain/langgraph を導入して各 Node を正式な Graph に置き換えてください。
 */

interface QueryContext {
  intent: 'pipeline' | 'conversion' | 'evaluation' | 'unknown';
  sql: string;
  result: Array<Record<string, unknown>>;
}

export async function inferIntent(input: string): Promise<QueryContext> {
  const normalized = input.toLowerCase();
  if (normalized.includes('受注率')) {
    return { intent: 'conversion', sql: '', result: [] };
  }
  if (normalized.includes('評価')) {
    return { intent: 'evaluation', sql: '', result: [] };
  }
  if (normalized.includes('パイプライン') || normalized.includes('案件')) {
    return { intent: 'pipeline', sql: '', result: [] };
  }
  return { intent: 'unknown', sql: '', result: [] };
}

export async function buildSql(context: QueryContext): Promise<QueryContext> {
  switch (context.intent) {
    case 'conversion':
      return {
        ...context,
        sql: `SELECT DATE_TRUNC('month', signed_at) AS month, SUM(order_amount) / NULLIF(SUM(quote_amount), 0) AS conversion_rate FROM fact_order_conversion GROUP BY month ORDER BY month DESC LIMIT 6;`,
      };
    case 'evaluation':
      return {
        ...context,
        sql: `SELECT cycle_name, completion_rate, overdue_count FROM fact_review_cycle ORDER BY end_date DESC LIMIT 1;`,
      };
    case 'pipeline':
      return {
        ...context,
        sql: `SELECT stage, SUM(amount) AS pipeline_value FROM fact_opportunity GROUP BY stage ORDER BY stage;`,
      };
    default:
      return { ...context, sql: '' };
  }
}

export async function executeQuery(context: QueryContext): Promise<QueryContext> {
  if (!context.sql) {
    return { ...context, result: [] };
  }

  // TODO: Phase2 Sprint8 で Athena を実際に呼び出す。
  const mockData: Record<QueryContext['intent'], Array<Record<string, unknown>>> = {
    conversion: [
      { month: '2025-07-01', conversion_rate: 0.42 },
      { month: '2025-08-01', conversion_rate: 0.47 },
    ],
    evaluation: [
      { cycle_name: 'FY2025-H1', completion_rate: 0.86, overdue_count: 3 },
    ],
    pipeline: [
      { stage: 'Lead', pipeline_value: 12000000 },
      { stage: 'Proposal', pipeline_value: 8000000 },
      { stage: 'Negotiation', pipeline_value: 4500000 },
    ],
    unknown: [],
  };

  return { ...context, result: mockData[context.intent] ?? [] };
}

export async function summarize(context: QueryContext): Promise<string> {
  if (context.result.length === 0) {
    return 'データが見つかりませんでした。別の条件を試してみてください。';
  }

  if (context.intent === 'conversion') {
    const latest = context.result[0];
    return `直近月の受注率は ${(latest.conversion_rate as number * 100).toFixed(1)}% です。過去 6 か月分の推移をダッシュボードで確認してください。`;
  }

  if (context.intent === 'evaluation') {
    const cycle = context.result[0];
    return `${cycle.cycle_name} の評価完了率は ${(cycle.completion_rate as number * 100).toFixed(0)}%、未完了は ${cycle.overdue_count} 件です。PeopleOps へリマインドを行ってください。`;
  }

  const totals = context.result
    .map((row) => `${row.stage}: ${(Number(row.pipeline_value) / 1_000_000).toFixed(1)}M JPY`)
    .join(', ');
  return `案件パイプラインは ${totals} の構成です。商談滞留がないか確認してください。`;
}

export async function run(input: string): Promise<string> {
  const intent = await inferIntent(input);
  const withSql = await buildSql(intent);
  const executed = await executeQuery(withSql);
  return summarize(executed);
}

if (require.main === module) {
  const chunks: Array<string> = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk.toString()));
  process.stdin.on('end', async () => {
    const query = chunks.join('').trim() || '受注率を教えて';
    const response = await run(query);
    process.stdout.write(`${response}\n`);
  });
}
