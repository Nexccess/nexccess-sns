# 不動産担保ローンX配信｜検証結果 2026-11-23

## 結論
クレジット追加後、図解2種類を別々の画像付き投稿として公開し、APIとブラウザーで本文・画像・誘導URLの一致を確認した。本書更新時点は本番マージ直前。本番反映後の最終結果はPR本文に記録する。

## 実施・確認
- PRの既存変更9ファイルを確認し、mainの旧配信停止変更をPRブランチに統合。
- 旧5ワークフローはすべてdisabled_manually。mainの各ファイルも定期・手動トリガーを停止し、ジョブをfalse条件で停止。履歴・認証情報は削除していない。
- Vercel本番はREADY、コミット60496f3bd002d871835920126cd40ed6f40eb8fd。旧POST https://go.pathflow.org/api/trigger はHTTP 410、本文はLegacy SNS publishing is disabled。今回Vercelの本番設定変更なし。
- 誘導先 https://fudousan-tanpo.tokyo/ はHTTP 200。
- 配信終了を2026-12-31 JSTへ延長。07:18・12:15・19:15 JSTの1日3枠。過去の枠は遡及投稿しない。GitHubの定期実行には遅延の可能性がある。
- 枠1=資金相談、枠2=担保余力、枠3=一本化。各投稿は対応するPNGを1枚添付し、テーマ・日付付きUTMで同一サイトへ誘導。
- 既存の7日分の原稿と7種類の確認事項を組み合わせ、44日132枠の本文重複を検査。生成AIによる自動生成なし。Facebook自動配信なし。
- 日付・枠のGitタグを投稿前に原子的に予約。HTTPエラー・タイムアウト後も保全し、自動再送しない。ワークフローの同時実行を抑止。
- SVG→PNG変換、3画像の目視、全132枠のDry Run成功。
- JST開始・終了境界、不正枠、全132枠の本文・画像・URL整合、ローカル実投稿禁止の自動テスト成功。公開照合で本文・URL・画像枚数・代替テキスト等の不一致を拒否するテストも追加。

## 実行証跡
- Dry Run成功: https://github.com/Nexccess/nexccess-sns/actions/runs/45100131950
- 実投稿失敗: https://github.com/Nexccess/nexccess-sns/actions/runs/45100179481
- 実投稿は画像アップロード・代替テキスト登録・予約作成に成功し、create postでHTTP 402。
- 保全中の予約: tanpo-x-reserved/2026-11-18/2（以前の試験）、tanpo-x-reserved/2026-11-23/2（今回）。予約は公開成功の証明ではない。
- PR: https://github.com/Nexccess/nexccess-sns/pull/1

## クレジット追加後の再検証
- Keiからクレジット追加済みとの連絡。添付画面は残高$8.66、支出上限無制限。こちらから課金設定変更なし。
- 担保余力公開: https://x.com/nexccess/status/2124695610548727907
- 担保余力Actions成功: https://github.com/Nexccess/nexccess-sns/actions/runs/45101875115
- 一本化公開: https://x.com/nexccess/status/2124695932474191876
- 一本化Actions成功: https://github.com/Nexccess/nexccess-sns/actions/runs/45101990215
- 両方とも画像1枚・本文・UTM付き誘導URL・代替テキストをX APIで照合し、Chromeでも公開表示を目視確認。
- 11/23枠2の復旧は当日のアカウント投稿履歴に一致する投稿がないことをAPIで確認し、別予約2-recovery-1を使用。元の失敗予約は保持。
- API公開結果はGitHub Actions artifactに保存。以後の投稿にも公開結果照合を組み込み、照合失敗でも再投稿しない。
- 本番マージ前にPRブランチの一時実投稿・復旧経路を除去。main上の定期実行と明示的な手動実行のみ投稿可能。

## 過去の阻害事項と再開手順（解消前の記録）
1. X開発者画面で残高・支出上限・支払い状態を確認し、HTTP 402を解消する。課金設定の変更は実施していない。
2. 過去の失敗枠は公開有無を確認するまで予約を解除しない。別日に再開する場合は当日の未使用枠を使用。
3. 明示的な一時検証経路を用いて図解2種類を別投稿し、公開本文・画像・誘導URLを確認する。今回使用したPRブランチの実投稿許可は除去済み。
4. その後PRをReadyに変更しmainへ反映。mainでDry Run・予約による重複抑止・定期実行・Vercel本番の正常性を再確認。
5. 新しいX配信はmainへ未反映のため、本番の定期投稿はまだ開始していない。
