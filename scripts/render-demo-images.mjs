// Renders the DEMO product images from the procedural concept sneaker.
// Usage: npm run dev (port 3100) then: node scripts/render-demo-images.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const base = process.env.RENDER_BASE ?? "http://localhost:3100";
const { demoSlugs } = await import("./demo-slugs.mjs");
await mkdir("public/demo", { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
for (const slug of demoSlugs) {
  for (const view of ["side", "top"]) {
    const out = `public/demo/${slug}${view === "top" ? "-top" : ""}.webp`;
    if (existsSync(out) && !process.env.FORCE) continue;
    await page.goto(`${base}/dev-render/${slug}?view=${view}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const png = `public/demo/${slug}${view === "top" ? "-top" : ""}.png`;
    await page.screenshot({ path: png, omitBackground: true, timeout: 180000 });
    execFileSync("python3", ["-c", `from PIL import Image; im=Image.open('${png}'); im=im.crop(im.getbbox()); im.thumbnail((1200,1200)); W=max(im.size)+120; bg=Image.new('RGBA',(W,W),(0,0,0,0)); bg.paste(im,((W-im.width)//2,(W-im.height)//2)); bg.save('${png.replace(".png", ".webp")}', quality=88)`]);
    execFileSync("rm", [png]);
    console.log("rendered", slug, view);
  }
}
await browser.close();
