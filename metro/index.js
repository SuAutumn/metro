const Metro = require("metro");
const assert = require("assert");
const fs = require("fs");

function cleanUp(folderPath) {
  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
  } catch (error) {
    console.info(`Error cleaning up ${folderPath}:`, error?.message);
  } finally {
    fs.mkdirSync(folderPath);
    console.log(`Clean up ${folderPath} folder.`);
  }
}

async function main() {
  cleanUp("./dist");
  const config = await Metro.loadConfig();
  assert(config, "配置错误");
  await Metro.runBuild(config, {
    entry: "index.js",
    out: "./dist/bundle.js",
  });
}

main();
