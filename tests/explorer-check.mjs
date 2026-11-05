import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
await mkdir("work", { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon"))
    errors.push(`${m.text()} ${m.location().url}`);
});
const assert = (x, m) => {
  if (!x) throw Error(m);
};
const url = process.env.APP_URL || "http://localhost:5173/codex-playground/";
await page.goto(url);
await page.getByRole("heading", { name: "軌道の、その先へ。" }).waitFor();
await page.locator(".space-canvas canvas[data-engine]").waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: "work/explorer-initial.png", fullPage: true });
assert(
  (await page.locator(".webgl-failure").count()) === 0,
  "WebGL initialized",
);
assert(
  (await page.locator(".body-list>button").count()) === 9,
  "nine solar system bodies",
);
await page.getByRole("button", { name: "再生", exact: true }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "一時停止", exact: true }).click();
assert(
  !(await page.locator(".lab-clock").innerText()).includes("0 days"),
  "time advanced",
);
await page.getByRole("button", { name: "リセット", exact: true }).click();
assert(
  (await page.locator(".lab-clock").innerText()).includes("0 days"),
  "reset",
);
// Actual rendered WebGL frame and camera operations, not just DOM controls.
const canvas = page.locator(".space-canvas canvas[data-engine]"),
  box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, {
  steps: 12,
});
await page.mouse.up();
await page.getByRole("button", { name: "探索室ズームイン" }).click();
await page.getByRole("button", { name: "選択天体を追跡" }).click();
assert(
  (await page
    .getByRole("button", { name: "選択天体を追跡" })
    .getAttribute("aria-pressed")) === "true",
  "tracking",
);
await page.getByRole("button", { name: "2D", exact: true }).click();
await page.waitForFunction(() =>
  document
    .querySelector(".space-badge")
    ?.textContent.includes("2D · XY PROJECTION"),
);
await page.getByRole("button", { name: "3D", exact: true }).click();
for (const preset of [
  "内惑星",
  "地球と月",
  "連星と惑星",
  "彗星の旅",
  "2 : 1 共鳴",
  "重力アシスト",
]) {
  await page
    .locator(".preset-strip")
    .getByRole("button", { name: new RegExp(preset) })
    .click();
  await page.getByRole("button", { name: "再生", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  assert(
    (await page.locator(".lab-alert").count()) === 0,
    `preset ${preset} integrates`,
  );
}
await page
  .locator(".preset-strip")
  .getByRole("button", { name: /地球と月/ })
  .click();
await page.getByRole("button", { name: "天体を追加" }).click();
assert((await page.locator(".body-list>button").count()) === 3, "add body");
await page
  .getByRole("textbox", { name: "天体名", exact: true })
  .fill("テスト探査機");
await page
  .getByRole("spinbutton", { name: "速度 z", exact: true })
  .fill("0.25");
await page.getByRole("button", { name: "変更を適用", exact: true }).click();
assert(
  (await page.locator(".body-list").innerText()).includes("テスト探査機"),
  "edit body",
);
await page
  .getByRole("spinbutton", { name: "探索室 Δv z", exact: true })
  .fill("0.5");
await page.getByRole("button", { name: "選択天体に Δv を適用" }).click();
await page.getByRole("button", { name: "測定", exact: true }).click();
assert(
  (await page.locator(".coordinate-readout").innerText()).includes("0.75"),
  "3D impulse applied",
);
await page.getByRole("button", { name: "保存", exact: true }).click();
await page
  .getByRole("textbox", { name: "実験の名前" })
  .fill("ブラウザ検証の実験");
await page.getByRole("button", { name: "ブラウザに保存" }).click();
assert((await page.locator(".saved-item").count()) === 1, "local save");
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "JSON書き出し" }).click();
const download = await downloadPromise;
await download.saveAs("work/experiment.json");
await page.reload();
await page.getByRole("button", { name: "保存", exact: true }).click();
await page
  .getByRole("button", { name: "ブラウザ検証の実験を読み込む" })
  .click();
assert(
  (await page.locator(".body-list").innerText()).includes("テスト探査機"),
  "persistent restore",
);
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.getByLabel("実験JSONを読み込む").setInputFiles({
  name: "invalid.json",
  mimeType: "application/json",
  buffer: Buffer.from('{"version":999}'),
});
await page.getByRole("status").filter({ hasText: "読み込み失敗" }).waitFor();
assert(
  (await page.locator(".body-list>button").count()) === 3,
  "invalid import does not mutate state",
);
await page
  .getByLabel("実験JSONを読み込む")
  .setInputFiles("work/experiment.json");
assert(
  (await page.locator(".body-list>button").count()) === 3,
  "valid JSON import",
);
await page.getByRole("button", { name: "編集", exact: true }).click();
await page.getByRole("button", { name: "天体を削除" }).click();
assert((await page.locator(".body-list>button").count()) === 2, "delete body");
// Exact overlap must halt the integrator rather than producing NaN or merging silently.
await page.getByRole("button", { name: "保存", exact: true }).click();
const collision = {
  version: 1,
  id: "collision",
  name: "接触検証",
  savedAt: new Date().toISOString(),
  scale: 1e8,
  step: 1,
  rate: 60,
  world: {
    time: 0,
    bodies: [
      {
        id: "a",
        name: "A",
        mass: 1e20,
        radius: 1e6,
        color: "#aabbcc",
        r: { x: 0, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 0 },
      },
      {
        id: "b",
        name: "B",
        mass: 1e10,
        radius: 100,
        color: "#ccbbaa",
        r: { x: 10, y: 0, z: 0 },
        v: { x: 0, y: 0, z: 0 },
      },
    ],
  },
};
await page.getByLabel("実験JSONを読み込む").setInputFiles({
  name: "collision.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(collision)),
});
await page.getByRole("button", { name: "再生", exact: true }).click();
await page.locator(".lab-alert").filter({ hasText: "接触" }).waitFor();
assert(
  await page.getByRole("button", { name: "再生", exact: true }).isDisabled(),
  "collision prevents resume",
);
await page
  .locator(".preset-strip")
  .getByRole("button", { name: /彗星の旅/ })
  .click();
await page.getByRole("button", { name: "探索ガイド" }).click();
await page.getByRole("dialog").waitFor();
await page.getByRole("button", { name: "探索をはじめる" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "work/explorer-desktop.png", fullPage: true });
for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.waitForTimeout(100);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `layout at ${width}`,
  );
}
await page.screenshot({ path: "work/explorer-mobile.png", fullPage: true });
// Exercise the documented fallback without disabling the primary real-WebGL tests.
const fallback = await browser.newPage();
await fallback.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    if (String(kind).startsWith("webgl")) return null;
    return original.call(this, kind, ...args);
  };
});
await fallback.goto(url);
await fallback.locator(".webgl-failure").waitFor();
await fallback.getByRole("button", { name: /地球周回ラボ/ }).click();
await fallback.getByRole("heading", { name: "重力を、実験しよう。" }).waitFor();
await fallback.close();
assert(errors.length === 0, errors.join("\n"));
console.log(
  "Explorer browser checks passed: WebGL, 7 presets, playback, 2D/3D, camera, tracking, add/edit/delete, 3D Δv, local persistence, JSON roundtrip and rejection, collision halt, guide, 6 responsive widths, WebGL-unavailable fallback; no runtime errors.",
);
await browser.close();
