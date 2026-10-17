// Renders public/icons/icon.svg to the PNG sizes the manifest needs.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" });
const page = await browser.newPage();
for (const [size, file, pad] of [[192, "icon-192.png", 0], [512, "icon-512.png", 0], [512, "icon-maskable-512.png", 0.12]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<html><body style="margin:0;background:${pad ? "#0B0D12" : "transparent"};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: !pad });
}
await browser.close();
console.log("icons ok");
