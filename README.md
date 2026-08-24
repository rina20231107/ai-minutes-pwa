# ことのは議事録 PWA

iPhoneのSafariで使えるAI議事録アプリです。録音と同時にiPhoneの音声認識で文字起こしし、必要なときだけOpenAI APIで議事録を作成します。端末内の履歴・検索とMicrosoft Word（.docx）出力にも対応しています。

Google Driveへ保存する場合は、アプリの「Word保存」でiPhoneへ保存した後、Google Driveアプリから手動でアップロードしてください。

## iPhoneでの使い方

1. 公開URLをSafariで開く
2. 共有ボタンを押す
3. 「ホーム画面に追加」を選ぶ
4. 初回録音時にマイクの使用を許可する

録音中はSafariを閉じたり画面をロックしたりしないでください。Webアプリではバックグラウンド録音が中断される場合があります。

## セキュリティ

OpenAI APIへ文字起こし結果を送信するのは、「AI議事録を作成」を実行した場合のみです。OpenAI APIキーはブラウザやGitHubへ埋め込みません。Safariの音声認識はSiriを有効にして利用してください。
