#!/bin/bash

# Cloud Build権限修正スクリプト
set -e

echo "🔧 Cloud Build権限を修正します..."

# プロジェクトIDの取得
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
if [ -z "$PROJECT_ID" ]; then
    echo "❌ プロジェクトIDが設定されていません"
    echo "📝 以下のいずれかの方法で設定してください:"
    echo "1. 環境変数: export PROJECT_ID=your-project-id"
    echo "2. gcloud設定: gcloud config set project your-project-id"
    exit 1
fi

echo "📋 プロジェクトID: $PROJECT_ID"

# GitHub Actionsサービスアカウント
GITHUB_SA="github-actions@$PROJECT_ID.iam.gserviceaccount.com"

# Cloud Buildサービスアカウント
CLOUDBUILD_SA="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"

echo "🔐 必要な権限を付与中..."

# GitHub Actionsサービスアカウントの権限
echo "📝 GitHub Actionsサービスアカウントの権限を設定中..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$GITHUB_SA" \
    --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$GITHUB_SA" \
    --role="roles/serviceusage.serviceUsageAdmin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$GITHUB_SA" \
    --role="roles/storage.admin"

# Cloud Buildサービスアカウントの権限
echo "📝 Cloud Buildサービスアカウントの権限を設定中..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$CLOUDBUILD_SA" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$CLOUDBUILD_SA" \
    --role="roles/serviceusage.serviceUsageAdmin"

# Cloud Runサービスアカウントの権限
echo "📝 Cloud Runサービスアカウントの権限を設定中..."
CLOUDRUN_SA="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

# Cloud RunサービスアカウントにSecret Managerアクセス権限を付与
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$CLOUDRUN_SA" \
    --role="roles/secretmanager.secretAccessor"

# 必要なAPIを有効化
echo "🔧 必要なAPIを有効化中..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com

echo "✅ Cloud Build権限の修正が完了しました！"
echo ""
echo "📋 次のステップ:"
echo "1. GitHub Actionsを再実行してください"
echo "2. まだエラーが発生する場合は、以下を確認してください:"
echo "   - プロジェクトの請求が有効になっているか"
echo "   - 組織のポリシーでCloud Buildが制限されていないか" 