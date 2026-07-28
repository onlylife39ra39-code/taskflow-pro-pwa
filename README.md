# TaskFlow Pro

TaskFlow Pro は、最新のUI/UX、Express.jsバックエンド、およびPWA（Progressive Web App）機能を組み合わせた高度なToDo管理システムです。

## 主な機能
- 📝 **タスクのCRUD**: 追加、編集、削除、一括整理
- 📊 **ステータス管理**: 未完了、進行中、完了の3段階管理と統計進捗バー
- 🏷️ **タグ・優先度フィルター**: 多重タグと高・中・低優先度ソート
- 💾 **ハイブリッドストレージ**: オフライン時はLocalStorageで高速動作し、オンライン時はExpress APIと連携
- 📱 **PWA機能**: ホーム画面への追加、サービスワーカーによるオフラインキャッシュ対応

## ローカル環境での実行

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスして動作を確認します。