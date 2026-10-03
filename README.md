# 16x16 Arrow Loop with Rebuilt Undo

## 起動

```bash
npm install
npm run dev
```

ターミナルに表示されたURLをブラウザで開いてください。

## 操作

- `WASD` または矢印キー: 移動
- `Q`: 1手戻す
- `R`: リセット
- 経路上のマスをクリック: そのマスより前の経路を破棄し、新しい開始地点にする
- 切断後はL字の接続判定で経路とUndo履歴を再構築
