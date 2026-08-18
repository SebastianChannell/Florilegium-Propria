import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function massAsset(url) {
  const nested = url.pathname.match(/^\/api\/mass\/(1954|1960)\/(\d{4}-\d{2}-\d{2})$/);
  const legacy = url.pathname.match(/^\/api\/mass\/(\d{4}-\d{2}-\d{2})$/);
  const date = nested?.[2] ?? legacy?.[1];
  if (!date) return null;
  const rubric = nested?.[1] ?? url.searchParams.get("rubrics") ?? "1960";
  const prefix = rubric === "1954" ? "pre-1955/" : "";
  return `/data/mass/${prefix}${date.slice(0, 4)}/${date}.json`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let pathname = massAsset(url) ?? url.pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const candidate = normalize(join(root, relativePath));
  const filePath = candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : join(root, "index.html");

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Propria is available at http://localhost:${port}`);
});
