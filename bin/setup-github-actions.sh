#!/bin/bash

# GitHub Actions CI/CD セットアップスクリプト
set -e

echo "🚀 GitHub Actions CI/CD セットアップを開始します..."

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

# サービスアカウント名
SA_NAME="github-actions"
SA_DISPLAY_NAME="GitHub Actions Service Account"

# サービスアカウントの存在確認
if gcloud iam service-accounts describe "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1; then
    echo "ℹ️  サービスアカウントは既に存在します"
    SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
else
    echo "📝 サービスアカウントを作成中..."
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="$SA_DISPLAY_NAME"
    SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    echo "✅ サービスアカウントを作成しました: $SA_EMAIL"
fi

# 必要な権限を付与
echo "🔐 必要な権限を付与中..."

# Cloud Run管理者権限
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/run.admin"

# Cloud Run開発者権限
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/run.developer"

# Cloud Buildサービスアカウント権限
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountUser"

# Cloud Build編集者権限
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/cloudbuild.builds.editor"

# Secret Manager管理者権限
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.admin"

echo "✅ 権限の付与が完了しました"

# サービスアカウントキーを作成
KEY_FILE="github-actions-key.json"
if [ -f "$KEY_FILE" ]; then
    echo "⚠️  既存のキーファイルが見つかりました: $KEY_FILE"
    read -p "上書きしますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "キーファイルの作成をスキップしました"
    else
        echo "📝 新しいキーファイルを作成中..."
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SA_EMAIL"
        echo "✅ キーファイルを作成しました: $KEY_FILE"
    fi
else
    echo "📝 サービスアカウントキーを作成中..."
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SA_EMAIL"
    echo "✅ キーファイルを作成しました: $KEY_FILE"
fi

# キーファイルの内容を表示
if [ -f "$KEY_FILE" ]; then
    echo ""
    echo "🔐 GitHub Secrets設定用の情報:"
    echo ""
    echo "GCP_SA_KEY:"
    cat "$KEY_FILE"
    echo ""
    echo "GCP_PROJECT_ID: $PROJECT_ID"
    echo ""
    echo "📋 次のステップ:"
    echo "1. GitHubリポジトリのSettings → Secrets and variables → Actionsに移動"
    echo "2. 以下のシークレットを追加:"
    echo "   - GCP_SA_KEY: 上記のJSON内容"
    echo "   - GCP_PROJECT_ID: $PROJECT_ID"
    echo ""
    echo "3. mainブランチにプッシュしてデプロイをテスト"
    echo ""
    echo "⚠️  セキュリティのため、$KEY_FILEを削除することをお勧めします"
    echo "   rm $KEY_FILE"
fi

echo ""
echo "✅ GitHub Actions CI/CD セットアップが完了しました！" 