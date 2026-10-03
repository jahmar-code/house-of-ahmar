// Offline guards for local links and source provenance in the knowledge vault.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".next", "node_modules", "backups", "artifacts", "test-results", "playwright-report"]);
function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name) || entry.name.startsWith(".")) return [];
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

const files = markdownFiles(root);
const broken = [];
let links = 0;
let notes = 0;
let sources = 0;
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const name = relative(root, file);
  if (name.startsWith("docs/pkm/")) {
    notes += 1;
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    if (!frontmatter) {
      broken.push(`${name}: missing vault frontmatter`);
    } else {
      for (const field of ["title", "summary", "tags"]) {
        if (!new RegExp(`^${field}:[ \t]*\\S.*$`, "m").test(frontmatter)) {
          broken.push(`${name}: missing or empty ${field}`);
        }
      }
      const verified = frontmatter.match(/^verified:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
      const timestamp = verified ? Date.parse(`${verified}T00:00:00.000Z`) : NaN;
      if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== verified) {
        broken.push(`${name}: verified must be a real YYYY-MM-DD date`);
      }
      // The vault's contract deliberately uses a simple block list of paths.
      // Keep the guard dependency-free; prose accuracy still needs source review.
      const sourceBlock = `${frontmatter}\n`.match(/^source:\s*\r?\n((?:[ \t]+-[^\r\n]+\r?\n)+)/m)?.[1];
      const paths = sourceBlock ? [...sourceBlock.matchAll(/^[ \t]+-\s+(.+)$/gm)].map((match) => match[1].trim().replace(/^['"]|['"]$/g, "")) : [];
      if (!paths.length) broken.push(`${name}: source must list repository paths`);
      for (const path of paths) {
        sources += 1;
        const absolute = resolve(root, path);
        const local = relative(root, absolute);
        if (!path || local === ".." || local.startsWith("../") || !existsSync(absolute)) {
          broken.push(`${name}: missing or non-repository source ${path}`);
        }
      }
    }
  }
  const source = raw.replace(/```[\s\S]*?```/g, "");
  for (const match of source.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s]+?)(?:\s+"[^"]*")?\)(?=\s|[.,;:]|$)/gm)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
    let path;
    try {
      path = decodeURIComponent(target.split("#")[0].split("?")[0]);
    } catch {
      broken.push(`${name}: malformed link ${target}`);
      continue;
    }
    if (!path) continue;
    links += 1;
    const absolute = resolve(dirname(file), path);
    if (!existsSync(absolute) || (!statSync(absolute).isFile() && !statSync(absolute).isDirectory())) {
      broken.push(`${relative(root, file)}: ${target}`);
    }
  }
}
if (broken.length) {
  console.error(`Documentation errors (${broken.length}):\n${broken.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation: ${files.length} Markdown files, ${links} local links, ${notes} vault notes, ${sources} source paths checked.`);
}
