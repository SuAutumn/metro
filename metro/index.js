import Metro from "metro";

const config = await Metro.loadConfig();

await Metro.runBuild(config, {
  entry: "index.js",
  out: "bundle.js",
});
