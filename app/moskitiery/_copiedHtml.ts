import { readFile } from "node:fs/promises";
import { join } from "node:path";

const htmlPath = join(process.cwd(), "public", "copied-konfiguruj", "moskitiery.html");

export async function renderCopiedMoskitieryHtml() {
  const html = await readFile(htmlPath, "utf8");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
