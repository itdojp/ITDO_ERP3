# Projects: WBS / EVM / Gantt / Baseline / Resource Capacity（詳細案）

本ドキュメントは ae-framework での生成を念頭に、OpenAPI補完前の詳細設計を示す（後続でOpenAPIへ反映）。

## 1) WBS 依存関係
- 目的: タスク間の依存を登録/取得（FS/SS/FF/SF + lag）
- API案:
  - GET /api/v1/projects/{id}/wbs/dependencies
  - POST /api/v1/projects/{id}/wbs/dependencies
- DTO（例）
```yaml
WbsDependency:
  type: object
  properties:
    predecessor_id: { type: string }
    successor_id: { type: string }
    type: { type: string, enum: [FS, SS, FF, SF] }
    lag: { type: integer, default: 0 }
```

## 2) EVM 指標
- 目的: PV/EV/AC/SPI/CPI を日次/期間で返却
- API案: GET /api/v1/projects/{id}/evm?as_of=YYYY-MM-DD
- DTO（例）
```yaml
EvmResponse:
  type: object
  properties:
    pv: { type: number }
    ev: { type: number }
    ac: { type: number }
    spi: { type: number }
    cpi: { type: number }
```

## 3) ガント
- 目的: 1万行規模に対応した仮想スクロール用データ
- API案: GET /api/v1/projects/{id}/gantt?cursor&limit
- DTO（例）
```yaml
GanttNode:
  type: object
  properties:
    task_id: { type: string }
    name: { type: string }
    start_on: { type: string, format: date }
    end_on: { type: string, format: date }
    progress: { type: number }
GanttResponse:
  type: object
  properties:
    items: { type: array, items: { $ref: GanttNode } }
    next_cursor: { type: string }
```

## 4) ベースライン
- 目的: ベースラインの保存/取得
- API案:
  - POST /api/v1/projects/{id}/baseline { name, description }
  - GET /api/v1/projects/{id}/baseline

## 5) リソースキャパシティ
- 目的: 期間/ユーザ単位のキャパと割当の参照/登録
- API案:
  - GET /api/v1/resources/capacity?user_id&period=YYYY-MM
  - POST /api/v1/resources/capacity { user_id, period, daily_hours[] }
- DTO（例）
```yaml
CapacityRequest:
  type: object
  properties:
    user_id: { type: string }
    period: { type: string }
    daily_hours: { type: array, items: { type: number } }
CapacityResponse:
  type: object
  properties:
    user_id: { type: string }
    period: { type: string }
    daily_hours: { type: array, items: { type: number } }
```

備考: EVM/ガント/ベースラインは将来 modules/projects に拡張（statefulはBaseline管理）。
