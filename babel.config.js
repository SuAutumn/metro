module.exports = {
  presets: ["@react-native/babel-preset"],
  plugins: [
    "@babel/plugin-transform-typescript",
    ["./metro/babel-plugin-function-string.js", { include: "**/*.js" }],
  ],
};
