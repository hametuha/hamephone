#!/bin/bash

# Hamephone Cloud Run デプロイスクリプト
REGION="asia-northeast1"
SERVICE_NAME="hamephone"

echo "🚀 Hamephone Cloud Run デプロイを開始します..."

# プロジェクトIDの取得
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
if [ -z "$PROJECT_ID" ]; then
    echo "❌ プロジェクトIDが設定されていません"
    echo "📝 以下のいずれかの方法で設定してください:"
    echo "1. 環境変数: export PROJECT_ID=your-project-id"
    echo "2. gcloud設定: gcloud config set project your-project-id"
    echo "3. スクリプト内のデフォルト値を変更"
    exit 1
fi

echo "📋 プロジェクトID: $PROJECT_ID"

# プロジェクト設定
gcloud config set project $PROJECT_ID

# 必要なAPIを有効化
echo "🔧 必要なAPIを有効化中..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Secret Managerにシークレットを作成（存在しない場合）
echo "🔐 Secret Manager設定中..."

# シークレット名のリスト
SECRETS=(
    "twilio-account-sid"
    "twilio-auth-token"
    "twilio-phone-number"
    "twilio-sms-number"
    "forward-to"
    "aws-access-key-id"
    "aws-secret-access-key"
)

# 各シークレットを作成（存在しない場合のみ）
for secret in "${SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" >/dev/null 2>&1; then
        echo "📝 シークレットを作成中: $secret"
        echo "PLACEHOLDER_VALUE" | gcloud secrets create "$secret" --data-file=-
        echo "✅ $secret を作成しました"
    else
        echo "ℹ️  $secret は既に存在します"
    fi
done

echo ""
echo "🔐 Secret Manager設定完了！"
echo ""
echo "📋 次のステップ:"
echo "1. 以下のシークレットに実際の値を設定してください:"
for secret in "${SECRETS[@]}"; do
    echo "   - $secret"
done
echo ""
echo "2. 設定例:"
echo "   gcloud secrets versions add twilio-account-sid --data-file=-"
echo "   (実際の値を入力してEnter)"
echo ""
echo "3. 設定完了後、デプロイを実行:"
echo "   npm run deploy:build"
echo "   npm run deploy:run"
echo ""

# デプロイを実行するか確認
read -p "デプロイを続行しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Dockerイメージをビルドしてプッシュ
    echo "🐳 Dockerイメージをビルド中..."
    gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

    # Cloud Runにデプロイ
    echo "🚀 Cloud Runにデプロイ中..."
    gcloud run deploy $SERVICE_NAME \
      --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
      --region $REGION \
      --platform managed \
      --allow-unauthenticated \
      --port 3000 \
      --memory 512Mi \
      --cpu 1 \
      --max-instances 10 \
      --min-instances 0 \
      --set-env-vars PORT=3000 \
      --set-secrets TWILIO_ACCOUNT_SID=twilio-account-sid:latest \
      --set-secrets TWILIO_AUTH_TOKEN=twilio-auth-token:latest \
      --set-secrets TWILIO_PHONE_NUMBER=twilio-phone-number:latest \
      --set-secrets TWILIO_SMS_NUMBER=twilio-sms-number:latest \
      --set-secrets FORWARD_TO=forward-to:latest \
      --set-secrets AWS_ACCESS_KEY_ID=aws-access-key-id:latest \
      --set-secrets AWS_SECRET_ACCESS_KEY=aws-secret-access-key:latest

    # デプロイ完了
    echo "✅ デプロイ完了！"
    echo "🌐 サービスURL:"
    gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"

    echo ""
    echo "📋 次のステップ:"
    echo "1. Secret Managerで実際の値を設定"
    echo "2. TwilioコンソールでWebhook URLを更新"
    echo "3. 実際の通話テストを実行"
else
    echo "デプロイをスキップしました。Secret Managerの設定を先に完了してください。"
fi 