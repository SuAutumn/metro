import metroConfig from "@react-native/metro-config";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultConfig = metroConfig.getDefaultConfig(__dirname);

console.log(Object.keys(defaultConfig));

const {
  transformer: { babelTransformerPath },
  transformerPath,
} = defaultConfig;
console.log(transformerPath);
console.log(babelTransformerPath);

export default defaultConfig;
