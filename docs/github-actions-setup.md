# GitHub Actions CI/CD セットアップ

このドキュメントでは、HamephoneプロジェクトをGitHub ActionsでCI/CDするための設定手順を説明します。

## 前提条件

1. GitHubリポジトリにコードがプッシュされている
2. Google Cloud Platform（GCP）プロジェクトが設定されている
3. GCPで必要なAPIが有効化されている

## 1. GCPサービスアカウントの作成

### 1.1 サービスアカウントを作成

```bash
# サービスアカウントを作成
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"

# サービスアカウントのメールアドレスを取得
SA_EMAIL=$(gcloud iam service-accounts list \
  --filter="displayName:GitHub Actions" \
  --format="value(email)")
```

### 1.2 必要な権限を付与

```bash
# Cloud Run管理者権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

# Cloud Run開発者権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.developer"

# Cloud Buildサービスアカウント権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"

# Cloud Build編集者権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/cloudbuild.builds.editor"

# Secret Manager管理者権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.admin"
```

### 1.3 サービスアカウントキーを作成

```bash
# キーファイルを作成
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=$SA_EMAIL
```

## 2. GitHub Secretsの設定

GitHubリポジトリの設定で以下のシークレットを追加してください：

### 2.1 必須シークレット

- `GCP_SA_KEY`: サービスアカウントキーのJSON内容
- `GCP_PROJECT_ID`: GCPプロジェクトID

### 2.2 シークレットの設定方法

1. GitHubリポジトリページに移動
2. Settings → Secrets and variables → Actions
3. "New repository secret"をクリック
4. 以下のシークレットを追加：

```
GCP_SA_KEY: github-actions-key.jsonの内容
GCP_PROJECT_ID: your-project-id
```

## 3. ワークフローの動作

### 3.1 プルリクエスト時（test.yml）

- **トリガー**: プルリクエスト作成・更新
- **実行内容**:
  - Node.js環境のセットアップ
  - 依存関係のインストール
  - テストの実行
  - テスト結果の表示

### 3.2 mainブランチへのプッシュ時（deploy.yml）

- **トリガー**: main/masterブランチへの直接プッシュ
- **実行内容**:
  - テスト実行
  - GCP認証
  - Dockerイメージのビルドとプッシュ
  - Cloud Runへのデプロイ
  - サービスURLの表示

### 3.3 開発フロー

1. **フィーチャーブランチ作成**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **開発・テスト**
   ```bash
   # ローカルでテスト
   npm test
   
   # プッシュ
   git push origin feature/new-feature
   ```

3. **プルリクエスト作成**
   - GitHubでプルリクエスト作成
   - 自動的にテストが実行される
   - テストが通ればマージ可能

4. **マージ・デプロイ**
   - プルリクエストをマージ
   - 自動的にCloud Runにデプロイ

## 4. トラブルシューティング

### 4.1 よくある問題

1. **認証エラー**
   - サービスアカウントキーが正しく設定されているか確認
   - 必要な権限が付与されているか確認

2. **ビルドエラー**
   - Dockerfileが正しく設定されているか確認
   - 依存関係が正しくインストールされているか確認

3. **デプロイエラー**
   - Secret Managerのシークレットが存在するか確認
   - Cloud Runサービスが正しく設定されているか確認

### 4.2 ログの確認

GitHub Actionsのログは以下で確認できます：
1. GitHubリポジトリページ
2. Actionsタブ
3. 該当するワークフローをクリック
4. ジョブをクリックしてログを確認

## 5. セキュリティのベストプラクティス

1. **最小権限の原則**: サービスアカウントには必要最小限の権限のみ付与
2. **キーのローテーション**: 定期的にサービスアカウントキーを更新
3. **シークレット管理**: 機密情報はGitHub Secretsで管理
4. **監査ログ**: GCPの監査ログを有効化してアクセスを監視

## 6. 追加の設定

### 6.1 環境別デプロイ

本番環境とステージング環境を分ける場合：

```yaml
# .github/workflows/deploy-staging.yml
# ステージング環境用のワークフロー

# .github/workflows/deploy-production.yml  
# 本番環境用のワークフロー
```

### 6.2 手動デプロイ

特定のタグやリリース時にのみデプロイする場合：

```yaml
on:
  push:
    tags:
      - 'v*'
```

## 7. 参考リンク

- [GitHub Actions公式ドキュメント](https://docs.github.com/ja/actions)
- [Google Cloud Run公式ドキュメント](https://cloud.google.com/run/docs)
- [Google Cloud Build公式ドキュメント](https://cloud.google.com/build/docs) 