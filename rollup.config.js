import { fileURLToPath } from "url";
import path, { dirname } from "path";
import alias from "@rollup/plugin-alias";
import typescript from "rollup-plugin-typescript2";
import image from "@rollup/plugin-image";
import less from "rollup-plugin-less";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  input: "src/index.tsx", // 你的入口文件
  output: {
    dir: "dist", // 输出目录
    format: "esm",
    preserveModules: true, // 保留模块结构
    preserveModulesRoot: "src", // 保留相对 src 目录的结构
  },
  plugins: [
    alias({
      entries: [
        {
          find: "@",
          replacement: path.resolve(__dirname, "src"), // 将 @ 替换为 src 目录
        },
      ],
    }),
    typescript({
      tsconfig: "./tsconfig.json", // 使用你自定义的 tsconfig 文件
    }),
    image(), // 处理图片
    less({
      output: false, // 输出 CSS 文件
      insert: false,
    }),
  ],
  external: ["react", "react-dom", "react/jsx-runtime"], // 如果有外部依赖（如 React），可以在这里列出
};
