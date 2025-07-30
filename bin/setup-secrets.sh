#!/bin/bash

# Secret Manager設定ヘルパースクリプト
ENV_FILE=".env"

echo "🔐 Secret Manager設定ヘルパー"
echo "================================"

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

# .envファイルの存在確認
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .envファイルが見つかりません: $ENV_FILE"
    echo "📝 .envファイルを作成してください"
    exit 1
fi

# .envファイルから値を読み込む関数
get_env_value() {
    local key=$1
    local value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | sed 's/^"//;s/"$//')
    echo "$value"
}

# シークレット設定関数
set_secret() {
    local secret_name=$1
    local description=$2
    local env_key=$3
    local current_value=""
    local env_value=""
    
    echo ""
    echo "📝 $description"
    echo "シークレット名: $secret_name"
    
    # .envファイルから値を取得
    if [ ! -z "$env_key" ]; then
        env_value=$(get_env_value "$env_key")
        if [ ! -z "$env_value" ]; then
            echo "📄 .envファイルから値を取得: ${env_value:0:10}..."
        fi
    fi
    
    # 現在の値を取得（存在する場合）
    if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
        current_value=$(gcloud secrets versions access latest --secret="$secret_name" 2>/dev/null || echo "")
        if [ ! -z "$current_value" ]; then
            echo "現在の値: ${current_value:0:10}..."
        fi
    fi
    
    # 値の選択
    if [ ! -z "$env_value" ]; then
        read -p ".envファイルの値を使用しますか？ (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            read -p "新しい値を入力してください: " new_value
        else
            new_value="$env_value"
        fi
    else
        read -p "新しい値を入力してください: " new_value
    fi
    
    if [ ! -z "$new_value" ]; then
        echo "$new_value" | gcloud secrets versions add "$secret_name" --data-file=-
        echo "✅ $secret_name を更新しました"
    else
        echo "⚠️  値が空のため、更新をスキップしました"
    fi
}

# 各シークレットの設定
echo "以下のシークレットを設定します:"
echo ""

set_secret "twilio-account-sid" "Twilio Account SID" "TWILIO_ACCOUNT_SID"
set_secret "twilio-auth-token" "Twilio Auth Token" "TWILIO_AUTH_TOKEN"
set_secret "twilio-phone-number" "Twilio Phone Number (050番号)" "TWILIO_PHONE_NUMBER"
set_secret "twilio-sms-number" "Twilio SMS Number (カナダ番号)" "TWILIO_SMS_NUMBER"
set_secret "forward-to" "転送先電話番号" "FORWARD_TO"
set_secret "aws-access-key-id" "AWS Access Key ID" "AWS_ACCESS_KEY_ID"
set_secret "aws-secret-access-key" "AWS Secret Access Key" "AWS_SECRET_ACCESS_KEY"

echo ""
echo "✅ Secret Manager設定完了！"
echo ""
echo "📋 次のステップ:"
echo "1. デプロイを実行: npm run deploy"
echo "2. TwilioコンソールでWebhook URLを更新"
echo "3. 実際の通話テストを実行" 