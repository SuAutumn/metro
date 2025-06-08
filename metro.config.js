const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  transformer: {
    // 禁用 minify，通过设置 minifierPath 为 null 或自定义空 minifier
    minifierPath: require.resolve("./fake-minifier"),
    babelTransformerPath: require.resolve("./metro/babel-transformer"),
  },
});
