#!/bin/bash

# Secret Manager自動設定スクリプト
ENV_FILE=".env"

echo "🔐 Secret Manager自動設定"
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

# シークレット自動設定関数
auto_set_secret() {
    local secret_name=$1
    local description=$2
    local env_key=$3
    local env_value=""
    
    echo ""
    echo "📝 $description"
    echo "シークレット名: $secret_name"
    
    # シークレットが存在しない場合は作成
    if ! gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
        echo "📝 シークレットを作成中: $secret_name"
        echo "PLACEHOLDER_VALUE" | gcloud secrets create "$secret_name" --data-file=-
        echo "✅ $secret_name を作成しました"
    fi
    
    # .envファイルから値を取得
    if [ ! -z "$env_key" ]; then
        env_value=$(get_env_value "$env_key")
        if [ ! -z "$env_value" ]; then
            echo "📄 .envファイルから値を取得: ${env_value:0:10}..."
            
            # 自動でSecret Managerに設定
            echo "$env_value" | gcloud secrets versions add "$secret_name" --data-file=-
            echo "✅ $secret_name を自動設定しました"
        else
            echo "⚠️  .envファイルに $env_key が見つかりません"
            echo "   手動で値を入力してください:"
            read -p "値を入力: " manual_value
            if [ ! -z "$manual_value" ]; then
                echo "$manual_value" | gcloud secrets versions add "$secret_name" --data-file=-
                echo "✅ $secret_name を手動設定しました"
            else
                echo "❌ $secret_name の設定をスキップしました"
            fi
        fi
    else
        echo "⚠️  環境変数キーが指定されていません"
        read -p "値を入力: " manual_value
        if [ ! -z "$manual_value" ]; then
            echo "$manual_value" | gcloud secrets versions add "$secret_name" --data-file=-
            echo "✅ $secret_name を手動設定しました"
        else
            echo "❌ $secret_name の設定をスキップしました"
        fi
    fi
}

# 各シークレットの自動設定
echo "以下のシークレットを自動設定します:"
echo ""

auto_set_secret "twilio-account-sid" "Twilio Account SID" "TWILIO_ACCOUNT_SID"
auto_set_secret "twilio-auth-token" "Twilio Auth Token" "TWILIO_AUTH_TOKEN"
auto_set_secret "twilio-phone-number" "Twilio Phone Number (050番号)" "TWILIO_PHONE_NUMBER"
auto_set_secret "twilio-sms-number" "Twilio SMS Number (カナダ番号)" "TWILIO_SMS_NUMBER"
auto_set_secret "forward-to" "転送先電話番号" "FORWARD_TO"
auto_set_secret "aws-access-key-id" "AWS Access Key ID" "AWS_ACCESS_KEY_ID"
auto_set_secret "aws-secret-access-key" "AWS Secret Access Key" "AWS_SECRET_ACCESS_KEY"
auto_set_secret "recording-link-secret" "録音リンク署名用シークレット" "LINK_SECRET"

echo ""
echo "✅ Secret Manager自動設定完了！"
echo ""
echo "📋 次のステップ:"
echo "1. デプロイを実行: npm run deploy"
echo "2. TwilioコンソールでWebhook URLを更新"
echo "3. 実際の通話テストを実行" 