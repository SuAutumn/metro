const generate = require("@babel/generator").default;
const template = require("@babel/template").default;
const babel = require("@babel/core");
const micromatch = require("micromatch");

/**
 * 给function添加function.toString方法
 * 值为函数的源代码字符串。
 * 适用于函数声明、变量声明中的函数表达式或箭头函数，以及类方法。
 * 该方法会在函数被调用时返回其源代码字符串。
 */
class FunctionString {
  /**
   * @param {import("@babel/core").NodePath} path
   * @param {import("@babel/core").types} types
   * @param {import("@babel/core")} myBabel
   */
  constructor(path, types, myBabel) {
    this.path = path;
    this.types = types;
    this.myBabel = myBabel;
  }

  /**
   * 判断当前节点是否为函数（函数表达式、函数声明或箭头函数）
   * @returns {boolean}
   */
  isFunction() {
    const { path } = this;
    return (
      path.isFunctionExpression() ||
      path.isFunctionDeclaration() ||
      path.isArrowFunctionExpression()
    );
  }

  /**
   * 判断当前函数是否直接定义在顶层（Program）中
   * @returns {boolean}
   */
  isFunctionInProgram() {
    if (this.path.isFunctionDeclaration()) {
      return this.path.parentPath.isProgram();
    }
    if (
      this.path.isFunctionExpression() ||
      this.path.isArrowFunctionExpression()
    ) {
      // 如果是函数表达式，检查它是否在变量声明中且变量声明在顶层
      return (
        this.path.parentPath.isVariableDeclarator() &&
        this.path.parentPath.parentPath.isVariableDeclaration() &&
        this.path.parentPath.parentPath.parentPath.isProgram()
      );
    }
  }

  /**
   * 判断当前函数是否作为对象属性存在于对象表达式中
   * @returns {boolean}
   */
  isFunctionInObjectExpression() {
    const t = this.types;
    const { path } = this;
    return (
      t.isProperty(path.parent) && t.isObjectExpression(path.parentPath.parent)
    );
  }

  /**
   * 检查函数是否在对象表达式或文件顶层中，且不是插件生成的节点
   * @returns {boolean}
   */
  isFunctionInObjectExpressionOrProgram() {
    // 不是目标函数 或者 节点是由插件生成的，直接返回 false
    if (!this.isFunction() || this.path.node._generatedByPlugin) {
      return false;
    }
    return this.isFunctionInObjectExpression() || this.isFunctionInProgram();
  }

  /**
   * 获取当前函数的 NodePath
   * - 函数声明直接返回自身
   * - 有名字的函数表达式返回自身，否则返回其变量声明
   * - 箭头函数返回其变量声明或属性节点
   * - 立即执行的匿名函数返回 null
   * @returns {import('@babel/core').NodePath | null}
   */
  getFunction() {
    const t = this.types;
    const { path } = this;
    if (path.isFunctionDeclaration()) {
      return path;
    }
    if (path.isFunctionExpression()) {
      if (path.node.id) {
        return path;
      } else if (path.parentPath.isVariableDeclarator()) {
        return path.parentPath;
      }
    }
    if (path.isArrowFunctionExpression()) {
      if (path.parentPath.isVariableDeclarator()) {
        return path.parentPath;
      }
      if (path.parentPath.isProperty()) {
        // 如果是箭头函数，检查它是否在对象表达式中
        return path;
      }
    }
    // 立即执行的匿名函数会返回null
    return null;
  }

  /**
   * 生成 toString 方法节点，并插入到合适的位置
   */
  generateFunctionStringNode() {
    const t = this.types;
    const toStringFunctionNode = t.functionExpression(
      null,
      [],
      t.blockStatement([
        t.returnStatement(t.stringLiteral(this.getFunctionString())),
      ])
    );
    // 标记该节点为插件生成
    toStringFunctionNode._generatedByPlugin = true;
    if (this.isFunctionInProgram()) {
      const f = this.getFunction();
      if (!f) {
        return;
      }
      const name = f.node.id?.name;
      if (!name) {
        return;
      }
      const statement = t.expressionStatement(
        t.assignmentExpression(
          "=",
          t.memberExpression(t.identifier(name), t.identifier("toString")),
          toStringFunctionNode
        )
      );
      this.insertAfter(statement, f);
      return;
    }
    if (this.isFunctionInObjectExpression()) {
      const f = this.getFunction();
      if (!f) {
        return;
      }
      const tmp = template(`(() => {
        const _tmpFunc = FUNCTION;
        _tmpFunc.toString = FUNCTION_STRING;
        return _tmpFunc;
      })()`);
      const statement = tmp({
        FUNCTION: f.node,
        FUNCTION_STRING: toStringFunctionNode,
      });
      this.path.replaceWith(statement);
      return;
    }
  }

  /**
   * 在指定 path 后插入语句
   * @param {import("@babel/core").Node} statement
   * @param {import('@babel/core').NodePath} path
   */
  insertAfter(statement, path) {
    const t = this.types;
    if (path.isFunctionDeclaration()) {
      path.insertAfter(statement);
      return;
    }
    if (path.isVariableDeclarator()) {
      const { parentPath } = path;
      if (parentPath.isVariableDeclaration()) {
        parentPath.insertAfter(statement);
        return;
      }
    }
  }

  /**
   * 获取当前函数的源代码字符串，自动去除 TypeScript 类型
   * @returns {string}
   */
  getFunctionString() {
    const t = this.types;
    const { path } = this;
    const { myBabel } = this;
    const cloneNode = t.cloneNode(path.node);

    const { ast } = myBabel.transformFromAstSync(
      t.file(
        t.program(
          [
            t.isStatement(cloneNode)
              ? cloneNode
              : t.expressionStatement(cloneNode),
          ],
          [],
          "module"
        )
      ),
      null,
      {
        plugins: ["@babel/plugin-transform-typescript"],
        ast: true,
        code: false,
        configFile: false,
      }
    );

    const codeNode = t.isExpressionStatement(ast.program.body[0])
      ? ast.program.body[0].expression
      : ast.program.body[0];

    return generate(codeNode, {
      retainLines: false,
      retainFunctionParens: true,
      concise: true,
    }).code.replace(/;$/, ""); // 去掉末尾的分号
  }
}

/**
 * 给function添加function.toString方法
 * 值为函数的源代码字符串。
 * 适用于函数声明、变量声明中的函数表达式或箭头函数，以及类方法。
 * 该方法会在函数被调用时返回其源代码字符串。
 * @param {import("@babel/core")} babel - The Babel object.
 * @param {import("@babel/core").types} babel.types - Babel types utility for AST manipulation.
 * @param {{include: string}} options - Options for the plugin.
 * @returns {import("@babel/core").PluginObj} A Babel visitor object to traverse and transform the AST.
 */
module.exports = function ({ types: t }, options = {}) {
  const { include } = options;
  return {
    visitor: {
      Function(path, state) {
        const filename =
          state.file && state.file.opts && state.file.opts.filename;
        if (include && filename && !micromatch.isMatch(filename, include)) {
          return;
        }
        const functionString = new FunctionString(path, t, babel);
        if (functionString.isFunctionInObjectExpressionOrProgram()) {
          functionString.generateFunctionStringNode();
        }
      },
    },
  };
};
