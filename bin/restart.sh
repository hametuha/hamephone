#!/bin/bash

# Hamephone サーバー再起動スクリプト

echo "🔄 Hamephone サーバーを再起動しています..."

# 既存のプロセスを停止
echo "⏹️  既存のプロセスを停止中..."
pkill -f "node server.js" 2>/dev/null || true
pkill ngrok 2>/dev/null || true

# 少し待機
sleep 2

# サーバーを起動
echo "🚀 Node.js サーバーを起動中..."
npm start &
SERVER_PID=$!

# サーバーが起動するまで待機
echo "⏳ サーバー起動を待機中..."
sleep 3

# ngrokを起動（無料プラン対応）
echo "🌐 ngrok トンネルを起動中..."
npx ngrok http 3000 &
NGROK_PID=$!

# 少し待機
sleep 3

# URLを取得
echo "🔗 公開URLを取得中..."
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | sed 's/"public_url":"//' | sed 's/"//')

if [ ! -z "$PUBLIC_URL" ]; then
    echo "✅ 再起動完了！"
    echo "📞 Twilio Webhook URL: ${PUBLIC_URL}/ivr"
    echo "🆔 プロセスID:"
    echo "   - サーバー: $SERVER_PID"
    echo "   - ngrok: $NGROK_PID"
    echo ""
    echo "📋 コマンド:"
    echo "   - 停止: npm run stop"
    echo "   - 再起動: npm run restart"
    echo "   - 状態確認: npm run status"
    echo ""
    echo "💡 注意: ngrokの無料プランではURLが変更される可能性があります"
else
    echo "❌ ngrok URLの取得に失敗しました"
    echo "手動で確認してください: http://localhost:4040"
fi 