import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const distRoot = new URL("../dist/", import.meta.url);

test("Netlify向けの静的サイトを生成する", async () => {
  const html = await readFile(new URL("index.html", distRoot), "utf8");

  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<title>投票ラボ/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/assets\/[^"']+\.js/);
  assert.match(html, /\/assets\/[^"']+\.css/);
  await access(new URL("og.png", distRoot));
});

test("Netlify設定とクライアント専用構成を維持する", async () => {
  const [config, source, files] = await Promise.all([
    readFile(new URL("netlify.toml", projectRoot), "utf8"),
    readFile(new URL("src/App.tsx", projectRoot), "utf8"),
    readdir(projectRoot),
  ]);

  assert.match(config, /command = "npm run build"/);
  assert.match(config, /publish = "dist"/);
  assert.match(source, /detectPrimaryColor/);
  assert.match(source, /canvas\.toDataURL\("image\/png"\)/);
  assert.ok(!files.includes(".openai"));
  assert.ok(!files.includes("worker"));
  assert.ok(!files.includes("db"));
});
