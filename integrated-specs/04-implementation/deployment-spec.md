# デプロイメント仕様書
## Deployment Specification

### 1. 概要

#### 1.1 目的
本仕様書は ITDO ERP3 の CI/CD パイプライン、リリースフロー、環境毎のデプロイメント手順を定義し、安定かつ再現性の高いリリース運用を実現することを目的とする。開発者から運用チームまで共通の手順と責任分解を共有し、SLA 達成とコンプライアンス要件に適合するリリース管理を支援する。

#### 1.2 適用範囲
- GitHub Actions / ArgoCD を基盤とした CI/CD パイプライン
- ブランチ戦略、バージョニング、リリース承認フロー
- 環境定義（開発・ステージング・本番）とプロモーション手順
- ロールバック/緊急対応手順
- 配布物 (Artifact)・設定・Secret の管理方法

---

### 2. ブランチ戦略とバージョニング

#### 2.1 ブランチモデル
| ブランチ | 役割 | 更新方法 | 備考 |
|----------|------|----------|------|
| `main` | 本番反映ソース | ステージング承認後の PR のみ | 保護ブランチ |
| `develop` | 統合テスト用 | 機能ブランチからの PR | 定期的に main と同期 |
| `feature/*` | 機能開発 | 個人作業 → PR | 自動CIで検証 |
| `hotfix/*` | 緊急修正 | main から派生 → main & develop にマージ | ロールバック手順に従う |

#### 2.2 バージョニング
- API / サービスは `MAJOR.MINOR.PATCH` の Semantic Versioning。
- Docker イメージタグは `v{semver}-{git_sha}`。latest を本番では使用しない。
- データベースマイグレーションは flyway/liquibase 互換の timestamp を付与 (例: `20250911_add_sales_tables.sql`)。

---

### 3. CI/CD パイプライン

#### 3.1 GitHub Actions (CI)
| ステージ | トリガー | 主な処理 | 成果物 |
|----------|----------|----------|--------|
| Lint/Test | PR 作成/更新 | ESLint, Jest, Pytest, Markdown Lint | テストレポート, Artifact |
| Build | `main`, `develop`, Release タグ | Docker build (multi-stage), sbom 生成 | コンテナイメージ (GHCR) |
| Security Scan | ナイトリービルド, `main` | SCA (Dependabot), SAST (CodeQL), IaC Scan (tfsec) | レポート, アラート |
| Publish Docs | `main` | MkDocs / Docusaurus で仕様書公開 | 静的サイト (S3/CloudFront) |

- 成果物は GHCR (ghcr.io/itdojp/itdo-erp3/{service}:{tag}) に push。
- SBOM は CycloneDX 形式で保管し、署名 (cosign) を付与。

#### 3.2 ArgoCD (CD)
| アプリケーション | マニフェスト管理 | 同期ポリシー | 備考 |
|------------------|------------------|--------------|------|
| `erp3-services` | GitOps レポ (manifests/) | 自動同期 + 手動承認 | 本番は手動承認必須 |
| `erp3-jobs` | manifests/jobs | 自動同期 (開発) / 手動 (本番) | CronJob, Batch |
| `erp3-infra` | terraform-live | Manual Sync | IaC 変更は別承認 |

---

### 4. 環境とリリースフロー

#### 4.1 環境定義
| 環境 | インフラ | データ | リリース頻度 | 承認 |
|------|----------|--------|--------------|------|
| 開発 (DEV) | Podman Compose / Dev EKS | 疑似データ, 最小構成 | 随時 | 自動 |
| ステージング (STG) | EKS Staging, RDS Standard | 匿名化した本番相当 | 週次 | PM/QA 承認 |
| 本番 (PRD) | EKS Production, RDS Multi-AZ | 本番データ | 隔週 (MVP) → 週次 | Change Advisory Board |

#### 4.2 リリース手順
1. **開発完了**: feature ブランチで実装 → PR → CI 合格。
2. **統合**: `develop` にマージ → 自動デプロイ (Dev 環境)。
3. **ステージングリリース**: Release Candidate タグ (`vX.Y.Z-rcN`) を作成 → ArgoCD が STG にデプロイ。
4. **検証**: QA / Biz チームが回帰・UAT。Check list 完了後 CAB 承認。
5. **本番リリース**: CAB 承認後 `main` にマージ + Release タグ発行 (`vX.Y.Z`) → ArgoCD 手動同期で PRD へ。
6. **リリース後確認**: Smoke Test, メトリクス監視, error budget 確認。

#### 4.3 Feature Flag 運用
- LaunchDarkly 互換の OSS (`OpenFeature`) を採用。
- 新機能は flag ON/OFF で制御し、ローリングリリースや Canary と併用。

---

### 5. コンフィグ・シークレット管理
| 項目 | 管理先 | 更新手順 | 備考 |
|------|--------|----------|------|
| アプリケーション設定 | ConfigMap / SSM Parameter Store | GitOps (manifests) → ArgoCD | Git 上は暗号化 (SOPS) |
| シークレット | AWS Secrets Manager / Kubernetes Secret (sealed) | Terraform → ArgoCD SealedSecret | ローテーション90日 |
| 環境変数 | K8s Deployment | manifest で定義 | 機密値は参照のみ |
| TLS 証明書 | ACM / cert-manager | 自動更新, 監視 | 期限 30 日前に通知 |

---

### 6. ロールアウト/ロールバック戦略

#### 6.1 ロールアウト手法
- **Rolling Update** (標準): Deployment の `maxUnavailable=0`, `maxSurge=1`。
- **Canary**: Argo Rollouts を利用。5% → 25% → 100% の段階的切替。
- **Blue/Green**: 重大リリース時。別 namespace / service で並行稼働し、Route53/ALB で切替。

#### 6.2 ロールバックフロー
1. アラート検知または KPI 逸脱を確認。
2. ArgoCD で `vX.Y.Z` の manifest に Rollback → 直前バージョンへ復元。
3. DB マイグレーションが破壊的な場合、`db/migrations` の down script を準備している前提で `flyway undo` を実行。
4. 影響調査とポストモーテムを 48 時間以内に実施し、operation-spec のエスカレーションに記録。

- 緊急時は `hotfix/*` ブランチで修正 → STG 省略可能 (CAB 承認必須)。

---

### 7. 品質ゲートとリリース判定
| ゲート | 判定基準 | 実施者 | ツール |
|--------|----------|--------|--------|
| 自動テスト | 単体: >90% / API 契約テスト PASS | 開発 | GitHub Actions |
| セキュリティ | CodeQL, SCA, IaC Scan で Critical=0 | セキュリティチーム | GitHub Security, Trivy |
| パフォーマンス | STG で p95 応答 < 1s、TPS > 1000 | QA | k6 + Grafana |
| UAT | 業務シナリオ 100% 完了 | ビジネス代表 | TestRail |
| 変更審査 | CAB 承認 | CAB | Jira / Slack ワークフロー |

---

### 8. 監視とリリース後対応
- デプロイ完了直後は SLO ダッシュボード (Grafana) を 30 分間集中監視。
- エラーレートが閾値超過する場合、即座にロールバック判断。
- リリースノートは自動生成 (changesets) し、Confluence / Teams へ通知。
- ポストモーテムは重大インシデント発生から 5 営業日以内に記録。

---

### 9. 今後の改善項目
| 項目 | 説明 | 優先度 |
|------|------|--------|
| Progressive Delivery | Flagger/Argo Rollouts による自動判定の高度化 | 中 |
| Database Migration Pipeline | 離職リスク低減のため独立パイプライン整備 | 中 |
| Chaos テストの自動化 | リリース前に故障注入を自動実施 | 低 |
| Observability as Code | 監視設定を Terraform 管理化 | 中 |
| FinOps ダッシュボード | リリース毎のコスト可視化 | 低 |

---

### 10. 関連ドキュメント
- [テスト仕様書](testing-spec.md)
- [技術アーキテクチャ仕様書](../03-infrastructure/architecture-spec.md)
- [運用管理仕様書](../03-infrastructure/operation-spec.md)
- [セキュリティ仕様書](../03-infrastructure/security-spec.md)
- [モジュール別仕様書](../02-modules/)
