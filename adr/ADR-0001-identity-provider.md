# ADR 0001: IdP選定と認証方式（SSO/MFA/SCIM）

- Status: Proposed
- Date: 2025-08-27
- Owners: 技術リード、セキュリティ担当

## Context
- SSO/MFAの統一実装が必要。
- ユーザー/グループのプロビジョニングを自動化（入退社連動）。
- 既存の社内アカウント基盤（Microsoft 365/Azure AD）を活用したい要望が強い。

## Decision
- IdPは Azure AD（Entra ID）を第一候補として採用。
- プロトコルは OIDC を主として使用し、必要に応じて SAML 2.0 を併用。
- プロビジョニングは SCIM 2.0（/Users, /Groups）を採用し、RBACと連動。
- MFAは IdP側ポリシーで強制（TOTP/WebAuthn推奨、SMSはフォールバック）。

## Options Considered
- Azure AD (Entra ID)
  - Pros: 既存利用、管理性、条件付きアクセス、SCIM対応
  - Cons: ライセンス費用、テナント依存
- Google Workspace
  - Pros: シンプルな運用、OIDC/SAML対応
  - Cons: 条件付きアクセスやデバイス制御の柔軟性に差
- Auth0/Okta（専用IdP）
  - Pros: 機能豊富、開発者体験が良い
  - Cons: コスト、ベンダーロックイン、運用の二重化

## Consequences
- 認証/認可の実装は OIDC/JWT を標準化し、各サービスで共通ミドルウェアを採用。
- アカウント発行/剥奪が人事イベントに連動（SCIM）し、内部統制を強化。
- Azure依存度が上がるため、障害時の代替手段（緊急ローカルアカウント/SAMLフェイルオーバー）を用意。

## Links
- integrated-specs/03-infrastructure/security-spec.md#3-アクセス制御
- REVIEW_ISSUE.md / REVIEW_GUIDE.md（SSO/IdPの指名）

