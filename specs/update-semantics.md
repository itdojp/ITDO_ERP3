# 更新セマンティクス（PATCH）

対象: SalesOrder / PurchaseOrder の PATCH 更新。

## lines_mode
- `replace`（既定）: 送信された `lines` で完全置換（未指定の既存行は削除）
- `merge`: `line_id` または `item_code` をキーに既存行を上書き/追加。未指定行は残す。

## lines_ops
- 差分操作（現在は `remove` のみ）。`lines_mode=merge` 時に併用可。
- 例: `{ op: "remove", line_id: "L-001" }` または `{ op: "remove", item_code: "SKU-1" }`

## 行識別
- `line_id`（推奨）: クライアント側生成の行ID。なければ `item_code` を暫定キーに利用。
- 削除は `replace` を用いるか、将来 `op: remove` の導入を検討。

## 丸め・金額
- 行の `amount` はサーバ側で `qty × unit_price` を元に再計算（不一致は優先度: サーバ）
- 丸めはテナント/契約設定に従う（links.md 参照）。
