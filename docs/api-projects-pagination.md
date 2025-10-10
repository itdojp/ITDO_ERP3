# Projects API ページネーション例

`GET /api/v1/projects` ではフィルタ・ページング引数を組み合わせて利用できます。以下はステータス `active` のプロジェクトを 24 件ずつ取得する例です。

```http
GET /api/v1/projects?status=active&first=24 HTTP/1.1
Host: api.example.com
X-Tenant-ID: example
Authorization: Bearer <token>
```

レスポンス例:

```json
{
  "items": [
    {
      "id": "PRJ-1001",
      "code": "DX-2025-01",
      "name": "DX推進プロジェクト",
      "clientName": "Acme Corp",
      "status": "active",
      "startOn": "2025-04-01",
      "manager": "山田太郎",
      "health": "green",
      "tags": ["DX", "Priority"]
    }
  ],
  "meta": {
    "total": 42,
    "returned": 24,
    "fetched_at": "2025-10-10T12:00:00Z",
    "fallback": false
  },
  "next_cursor": "PRJ-1024"
}
```

`next_cursor` が含まれる場合は、次ページ取得時に `after` クエリへ指定してください。

```http
GET /api/v1/projects?status=active&first=24&after=PRJ-1024
```

タグを複数指定する場合は `tags` クエリにカンマ区切りで指定します。

```http
GET /api/v1/projects?tags=DX,SAP&tag=priority
```

- `tags` は代表タグ（OR 条件）を表し、`tag` は手入力タグ（AND 条件）として扱われます。
- GraphQL エンドポイント (`projects` クエリ) でも同じ `first`/`after` が利用できます。
