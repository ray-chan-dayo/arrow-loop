# 16x16 Arrow Loop

## 起動

```bash
npm install
npm run dev
```

ターミナルに表示されたURLをブラウザで開いてください。

## GitHub Pages

`main` ブランチへ push すると、`.github/workflows/deploy-pages.yml` がビルドしてGitHub Pagesへデプロイします。
リポジトリの Settings → Pages で、Source が `GitHub Actions` になっていることを確認してください。

## 操作

- W/A/S/D または矢印キー
- 進行方向を90度変更すると現在マスに `L` を配置
- 開始地点へ戻ると閉路を検証
- 矢印1個につき1点
