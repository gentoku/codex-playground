import { mkdir } from "node:fs/promises";
await mkdir("work", { recursive: true });
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const assert = (v, m) => {
  if (!v) throw Error(m);
};
await page.goto(
  process.env.APP_URL || "http://localhost:5173/codex-playground/",
);
await page.getByRole("button", { name: /地球周回ラボ/ }).click();
await page.getByRole("heading", { name: "重力を、実験しよう。" }).waitFor();
await page.getByRole("button", { name: "再生", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "一時停止", exact: true }).click();
assert(
  (await page.locator(".time strong").innerText()) !== "0.0 min",
  "time advances",
);
await page.getByRole("button", { name: "＋ Δv を加える" }).click();
await page.getByRole("button", { name: "リセット", exact: true }).click();
assert((await page.locator(".time strong").innerText()) === "0.0 min", "reset");
// Drag satellite velocity from its initial location.
const c = await page.locator("canvas").boundingBox();
const scale = Math.min(c.width, c.height) / (6371008.8 * 5.2);
const x = c.x + c.width / 2 + 8371008.8 * scale,
  y = c.y + c.height / 2;
await page.mouse.move(x, y);
await page.mouse.down();
await page.mouse.move(x + 60, y - 60, { steps: 5 });
await page.mouse.up();
assert(
  Math.abs(
    Number(
      await page
        .getByRole("spinbutton", { name: "打ち出し方向", exact: true })
        .inputValue(),
    ) - 45,
  ) < 1,
  "mouse vector direction",
);
await page.getByRole("button", { name: /脱出軌道 地球の外へ/ }).click();
assert(
  (await page.locator(".status").innerText()).includes("脱出"),
  "escape preset",
);
assert(
  (await page.locator(".metric").nth(3).innerText()).includes("—"),
  "unbounded apoapsis",
);
await page.getByRole("button", { name: /衝突軌道 地表へ落下/ }).click();
await page.getByRole("combobox", { name: "時間倍率" }).selectOption("5000");
await page.getByRole("button", { name: "再生", exact: true }).click();
await page.waitForFunction(
  () => document.querySelector(".status")?.textContent.includes("地表に衝突"),
  {},
  { timeout: 15000 },
);
assert(
  await page.getByRole("button", { name: "再生", exact: true }).isDisabled(),
  "collision stops",
);
await page.getByRole("button", { name: /円軌道 安定した周回/ }).click();
await page.getByRole("button", { name: "ズームイン" }).click();
await page.getByRole("button", { name: "中心へ" }).click();
await page.screenshot({ path: "work/desktop.png", fullPage: true });
for (const width of [1280, 1024, 768, 390]) {
  await page.setViewportSize({ width, height: 900 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `layout ${width}`,
  );
}
assert(errors.length === 0, errors.join("\n"));
console.log(
  "Browser checks passed: playback, pause, reset, drag vector, Δv, presets, collision, undefined telemetry, zoom, responsive widths, no runtime errors.",
);
await browser.close();
