# Hamephone

破滅派の電話転送システム（Twilio + Express、Cloud Run で稼働）。

## 公開リポジトリ

このリポジトリは公開されている。コミット・PR・Issue に以下を書かないこと。

- 実在の電話番号、Twilio の Account SID / 録音 SID、AWS アカウントID、IAM ユーザー名、キーの断片
- 権限の広いキーやユーザーの存在など、攻撃の手がかりになるインフラの詳細

テストのダミー値は `+8190...` や `RE0123...` のような架空の値を使う。PR本文はファイルに書いて `--body-file` で渡す。

## デプロイ

- main への push で `.github/workflows/deploy.yml` が Cloud Run にデプロイする。
- **本番イメージに影響するファイルが変わったときだけ**デプロイされる（`on.push.paths` の許可リスト: `server.js`, `lib/**`（テスト除く）, `package*.json`, `Dockerfile`, `.dockerignore`, `deploy.yml`）。
- 実行時に読むファイル・ディレクトリを新しく追加したら、**必ず `paths` にも追加する**。忘れるとマージしても本番に反映されない。
- 手動デプロイは Actions タブの「Run workflow」（`workflow_dispatch`）。

## ローカル環境

- `.envrc.example` を `.envrc` にコピーして `direnv allow`。AWS プロファイルと gcloud プロジェクトを固定する。
- Claude の Bash や `!` 実行では direnv が効かないことがある。AWS / gcloud コマンドにはプロファイル・プロジェクトを明示する。
- シークレットは `.env` → `npm run secrets:auto` で Secret Manager に反映する。

## 録音

- Twilio の外部ストレージ機能で S3 に保存される（アプリは書き込まない）。キーは `{AccountSid}/{RecordingSid}`。
- SMS には `/r/:sid` の署名付きリンク（`lib/recording-link.js`）を載せ、開くと S3 の署名付きURLへリダイレクトする。
- 必要な IAM 権限は `docs/iam/hamephone-twilio-policy.json`。

## 教訓

作業前に `tasks/lessons.md` を読むこと。
