const { parseSync, transformFromAstSync } = require("@babel/core");

const transform = ({ filename, src, options, plugins }) => {
  const OLD_BABEL_ENV = process.env.BABEL_ENV;
  process.env.BABEL_ENV = options.dev
    ? "development"
    : process.env.BABEL_ENV || "production";
  try {
    const babelConfig = {
      caller: { name: "metro", bundler: "metro", platform: options.platform },
      ast: true,
      babelrc: options.enableBabelRCLookup,
      code: false,
      cwd: options.projectRoot,
      highlightCode: true,
      filename,
      plugins,
      sourceType: "unambiguous",
      cloneInputAst: false,
    };

    const sourceAst = parseSync(src, babelConfig);

    const result = transformFromAstSync(sourceAst, src, babelConfig);

    // The result from `transformFromAstSync` can be null (if the file is ignored)
    if (!result) {
      return { ast: null };
    }

    return {
      ast: result.ast,
      metadata: result.metadata,
    };
  } finally {
    if (OLD_BABEL_ENV) {
      process.env.BABEL_ENV = OLD_BABEL_ENV;
    }
  }
};

module.exports = {
  transform,
};
