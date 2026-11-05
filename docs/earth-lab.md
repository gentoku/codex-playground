# Gravity Lab — Phase 1

地球と質量を無視できる人工衛星の2D軌道実験。React / TypeScript / Vite、Canvas 2Dで動作するバックエンド不要のWebアプリです。

## 起動

Node.js 22以上を推奨します。

```bash
npm ci
npm run dev
```

ブラウザで http://localhost:5173 を開きます。本番用は `npm run build`、成果物の確認は `npm run preview`（http://localhost:4173）。`dist/` を静的ホスティングへ配置できます。

## GitHub Pagesで公開

公開URLは https://gentoku.github.io/codex-playground/ です。Viteのベースパスは `/codex-playground/` に設定しています。ローカルでも開発時は http://localhost:5173/codex-playground/ 、本番ビルドのプレビューは http://localhost:4173/codex-playground/ を開いてください。

GitHubの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定した状態で、`main` に変更を統合すると `.github/workflows/pages.yml` が実行されます。Node.js 22で `npm ci` → `npm test` → `npm run build` を実行し、成功した `dist/` をPages用アーティファクトとしてアップロードして公開します。デプロイ権限はデプロイジョブに限定しています。既存の `.github/workflows/ci.yml` によるpush・PRの検証も維持しています。

手動で再公開する場合は **Actions → Deploy Gravity Lab to GitHub Pages → Run workflow** で `main` を選択します。デプロイは `main` のみ許可しています。実行結果と公開URLはワークフローの `deploy` ジョブで確認できます。PRブランチのpushでは公開されず、PRを `main` にマージすると公開処理が始まります。

## 操作

- 円・楕円・衝突・脱出のプリセットを選び、再生します。
- 初期高度、初速度、方向を数値またはスライダーで設定します。変更時はシミュレーションをリセットします。
- 再生開始前／リセット後は衛星か速度矢印の先端からドラッグして初速度を設定できます。方向は地球固定座標の反時計回り（0°右、90°上）。初期位置は地球の右側です。
- 再生・一時停止・リセット、1〜5000倍の時間倍率に対応します。
- 背景ドラッグで画面移動、ホイールまたは＋／−でズーム、「中心へ」で視点を戻します。
- ミント色の実軌跡、破線の解析的予測軌道、黄色の速度ベクトルは個別に切り替えられます。
- Δv量と方向を入力して「Δvを加える」で瞬間的な速度変化を適用します。再生・停止中とも使用可能。リセットすると変更は破棄されます。
- 現在位置、速度、高度、近地点／遠地点高度、離心率、周期、比軌道エネルギーを表示します。負の近地点高度は地表に交差する数学的軌道を示します。

## 物理モデル

`src/physics/orbit.ts` がUIから独立した物理モジュールです。

- ニュートン重力 `a = −μr/|r|³`。固定・球対称の地球とテスト粒子の二体問題。
- 内部はSI単位。μ = 3.986004418 × 10¹⁴ m³/s²（[WGS 84, NGA](https://earth-info.nga.mil/index.php?dir=wgs84&action=wgs84)）、地球半径 = 6,371,008.8 m（[IUGG平均半径, WGS 84解説](https://ahrs.readthedocs.io/en/latest/geodesy/wgs84.html)）。半径は平均値、GMはWGS 84値を採用しています。
- Velocity Verlet法、固定刻み1秒。壁時計の時間倍率は積分回数だけを変え、刻みは拡大しません。ブラウザ復帰時のフレーム差は0.1秒まで。低性能環境では実際の進行が指定倍率を下回ることがあります。
- 保存エネルギー、角運動量、離心率ベクトルから軌道要素を計算し、`r = p/(1+e cos ν)` による円錐曲線を描画。角運動量ゼロでは径方向の線分として表示します。
- 脱出軌道は比エネルギーが非負（丸め誤差許容1e−7 J/kg）の非束縛軌道。脱出に有限の境界線はありません。
- 地球半径と1ステップの移動線分の交点で衝突を検出し、地表で停止します。衝突時の速度は接触直前ステップの参考値で、衝突後の軌道要素は物理的な将来予測ではありません。
- 非束縛軌道の遠地点・周期は未定義のため「—」。大気抵抗、地球の自転・扁平率、月・太陽など第三天体、相対論効果は無視します。

## 制約

- Phase 1は地球＋衛星1個、2Dのみ。太陽系・彗星・複数天体の相互重力・3Dは未実装です。
- 地表より内側の予測線は非表示。予測は900分割、遠方は地球半径の100倍まで（径方向の非束縛軌道は80倍）。実軌跡は5秒ごと、最大16,000点（約22時間）。
- Δvは瞬間噴射。燃料・衛星姿勢・有限時間噴射は扱いません。速度矢印は画面上の1 km/s = 10pxの図示であり、位置スケールとは異なります。
- 初期高度100〜30,000 km、初速度0〜16 km/s、Δv量0〜16 km/s。地球固定座標系であり、地表に対する射角ではありません。
- PCブラウザを主対象とします。画面幅に応じたレイアウトに対応していますが、精密なマウス操作はPC推奨です。

## 構成と検証

- `src/physics/`: 単位付き物理定数、状態、積分、軌道要素、解析的予測、プリセット、Vitestテスト。
- `src/components/OrbitView.tsx`: Canvas描画、カメラ、ポインター操作。
- `src/App.tsx`: 実行ループ、操作、テレメトリ。

```bash
npm test
npm run build
```

円軌道速度・脱出速度、既知の楕円軌道、円／楕円のエネルギー保存、角運動量保存、衝突、放物線／双曲線／径方向予測、Δv後の軌道変化を検証します。GitHub Actionsでもpush・PR時にテストとビルドを実行します。

## GitHubへ反映

```bash
git switch -c gravity-lab-phase-1
git add .
git commit -m "Build Gravity Lab Phase 1 orbit simulator"
git push -u origin gravity-lab-phase-1
```

GitHubでこのブランチからPull Requestを作成してください。既存ブランチの場合は最初のコマンドは不要です。

### ブラウザ操作テスト

開発サーバーを起動した状態で、別ターミナルから実行します。

```bash
npx playwright install chromium
npm run test:browser
```

既存Chromiumを使う場合は `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`。接続先は `APP_URL` で変更できます。再生・停止・リセット、マウス初速度操作、Δv、衝突停止、プリセット、ズーム、レスポンシブ幅を検証し、`work/desktop.png` に画面を保存します。GitHub Actionsは物理テストとビルドのみを実施します。
