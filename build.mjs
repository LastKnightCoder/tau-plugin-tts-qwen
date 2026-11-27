import { buildPortablePluginManifest, PORTABLE_SHARED_MODULES } from "@tau/plugins/portable";
import { build } from "esbuild";
import AdmZip from "adm-zip";
import { lstat, mkdir, readdir, readFile, writeFile, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

const LOCALIZED_README_PATTERN = /^README\.([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.md$/;

async function copyLocalizedReadmes(staging) {
  const seen = new Set();
  const entries = (await readdir(".", { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of entries) {
    const match = LOCALIZED_README_PATTERN.exec(entry.name);
    if (!match) continue;
    const stats = await lstat(entry.name);
    if (stats.isSymbolicLink() || !stats.isFile())
      throw new Error(`多语言说明文档必须为普通文件：${entry.name}`);
    let locale;
    try {
      if (match[1].length > 35) throw new Error("too long");
      locale = new Intl.Locale(match[1]).toString();
    } catch {
      throw new Error(`无效的多语言说明文档语言标识：${entry.name}`);
    }
    if (seen.has(locale)) throw new Error(`重复的多语言说明文档语言标识：${locale}`);
    seen.add(locale);
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(entry.name));
    } catch {
      throw new Error(`${entry.name} 必须为有效的 UTF-8 文本`);
    }
    if (!content.trim()) throw new Error(`${entry.name} 必须包含非空内容`);
    await writeFile(path.join(staging, `README.${locale}.md`), content);
  }
}

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));

const shared = [...PORTABLE_SHARED_MODULES];
await mkdir("dist", { recursive: true });
const staging = await mkdtemp(path.resolve("dist/.building-"));
const buildId = randomUUID();
const pointer = path.resolve("dist", `.building-pointer-${buildId}`);
try {
  const readme = await readFile("README.md", "utf8");
  if (!readme.trim()) throw new Error("README.md 必须包含插件介绍与使用说明");
  if (typeof manifest.description !== "string" || !manifest.description.trim())
    throw new Error("manifest.description 必须为非空简介");
  await writeFile(path.join(staging, "README.md"), readme);
  await copyLocalizedReadmes(staging);
  for (const name of ["LICENSE", "CHANGELOG.md"]) {
    try {
      await writeFile(path.join(staging, name), await readFile(name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const result = await build({
    entryPoints: ["src/index.tsx"],
    outfile: path.join(staging, "main.js"),
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: "es2022",
    jsx: "automatic",
    external: shared,
    metafile: true,
    loader: { ".svg": "dataurl" },
    define: {
      __PLUGIN_META__: JSON.stringify({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
      }),
    },
  });
  for (const output of Object.values(result.metafile.outputs)) {
    for (const dependency of output.imports) {
      if (dependency.external && !shared.includes(dependency.path))
        throw new Error(`插件构建包含未支持的外部依赖：${dependency.path}`);
    }
  }
  const styles = Object.keys(result.metafile.outputs).some(file => file.endsWith("main.css"));
  const integrity = {};
  for (const file of ["main.js", ...(styles ? ["main.css"] : [])])
    integrity[file] = createHash("sha256")
      .update(await readFile(path.join(staging, file)))
      .digest("hex");
  const builtManifest = buildPortablePluginManifest(manifest, {
    main: "main.js",
    integrity,
    ...(styles ? { styles: "main.css" } : {}),
  });
  await writeFile(
    path.join(staging, "manifest.json"),
    JSON.stringify(
      {
        ...builtManifest,
        ...(manifest.i18n ? { i18n: builtManifest.i18n ?? manifest.i18n } : {}),
        ...(manifest.locales ? { locales: builtManifest.locales ?? manifest.locales } : {}),
      },
      null,
      2
    )
  );
  const destination = path.resolve("dist", `${manifest.version}-${buildId}`);
  await rename(staging, destination);
  await writeFile(
    pointer,
    JSON.stringify({
      formatVersion: 1,
      id: manifest.id,
      buildId,
      directory: path.basename(destination),
    })
  );
  await rename(pointer, path.resolve("dist", `tau-build-${manifest.id}.json`));
  const zip = new AdmZip();
  zip.addLocalFolder(destination, manifest.id);
  const archive = path.resolve("dist", `${manifest.id}-${manifest.version}.zip`);
  zip.writeZip(archive);
  console.log(`构建完成：${archive}`);
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
} finally {
  await rm(pointer, { force: true });
}
