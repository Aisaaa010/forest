import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await checkDirectory(file);
    else if (file.endsWith(".vue")) {
      const source = await readFile(file, "utf8");
      const { descriptor, errors } = parse(source, { filename: file });
      if (errors.length) throw new Error(`${file}: ${errors.join("\n")}`);
      const script = compileScript(descriptor, { id: file });
      const template = compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id: file,
        compilerOptions: { bindingMetadata: script.bindings },
      });
      if (template.errors.length)
        throw new Error(`${file}: ${template.errors.join("\n")}`);
      console.log(`Vue checked: ${file}`);
    } else if (file.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(result.stderr);
    }
  }
}
await checkDirectory("src");
console.log("All Vue components and JavaScript modules passed syntax checks.");
