# 投票ラボ

候補名と写真から、色分けされた投票ポスターの下書きと画像生成AI向けの日本語プロンプトを作る、ブラウザ完結型のReactアプリです。

## ローカルで起動

Node.js 22.13.0以降を用意し、次のコマンドを実行します。

```bash
npm install
npm run dev
```

## 確認

```bash
npm run build
npm test
```

## Netlifyへ公開

このリポジトリをGitHub、GitLab、またはBitbucketへ保存し、Netlifyでリポジトリを接続してください。`netlify.toml`に次の設定が含まれているため、通常は追加設定なしで公開できます。

- ビルドコマンド: `npm run build`
- 公開フォルダー: `dist`
- Node.js: `22.13.0`

アップロード画像、色抽出、ポスターのPNG出力、プロンプト生成はすべてブラウザ内で処理されます。画像や下書きはサーバーへ保存されません。
