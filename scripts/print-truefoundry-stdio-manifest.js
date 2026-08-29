import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../trueforge/artiji-cloud-stdio.cjs", import.meta.url);
const source = await readFile(sourceUrl, "utf8");

const manifest = {
  mcpServers: {
    "artiji-commerce": {
      command: "node",
      args: ["-e", source, "artiji-commerce"]
    }
  }
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
