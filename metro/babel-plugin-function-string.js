const generate = require("@babel/generator").default;
const template = require("@babel/template").default;
const micromatch = require("micromatch");
const nodeJsPath = require("path");

/**
 * 给function添加function.toString方法
 * 值为函数的源代码字符串。
 * 适用于函数声明、变量声明中的函数表达式或箭头函数，以及类方法。
 * 该方法会在函数被调用时返回其源代码字符串。
 */
class FunctionString {
  /** 已经处理的节点 或者 插件生成ast节点标记，可以跳过 */
  static SKIP_NODE = Symbol("plugin_transform_function_string");
  /**
   * @param {import("@babel/core").NodePath} path
   * @param {import("@babel/core").types} types
   */
  constructor(path, types) {
    this.path = path;
    this.types = types;
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
    if (!this.isFunction() || this.isNodeCanSkip(this.path.node)) {
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

  generateFunctionStringNode(functionString) {
    const t = this.types;
    return t.functionExpression(
      null,
      [],
      t.blockStatement([t.returnStatement(t.stringLiteral(functionString))])
    );
  }

  /**
   * 标记节点已被处理
   * @param {import("@babel/types").Node} node ast节点
   */
  markNodeCanSkip(node) {
    node[FunctionString.SKIP_NODE] = true;
  }

  /**
   * 是否可以不处理该节点
   * @returns {boolean}
   */
  isNodeCanSkip(node) {
    return node[FunctionString.SKIP_NODE];
  }

  /**
   * 生成一个表达式语句，将自定义的 toString 实现赋值给当前函数的 toString 属性。
   * 使用传入的 functionStringNode 作为 toString 的实现。
   * @param {import("@babel/types").Node} functionNode - 函数节点
   * @param {import("@babel/types").Node} functionStringNode - 函数源码节点
   * @returns {import("@babel/types").Statement | undefined} 返回赋值 toString 属性的表达式语句 AST 节点，
   *   如果未找到函数或函数名则返回 undefined。
   */
  generateStatementInProgram(functionNode, functionStringNode) {
    const functionName = functionNode.id?.name;
    if (!functionName) {
      return;
    }
    const t = this.types;
    return t.expressionStatement(
      t.assignmentExpression(
        "=",
        t.memberExpression(
          t.identifier(functionName),
          t.identifier("toString")
        ),
        functionStringNode
      )
    );
  }

  /**
   * 在对象表达式中生成一个包含自定义 toString 方法的函数表达式语句。
   *
   * 该方法会获取当前作用域下的函数节点，并为其动态添加一个 toString 方法，
   * 使其返回指定的函数字符串节点。最终返回一个立即执行函数表达式（IIFE），
   * 该表达式返回带有自定义 toString 方法的函数对象。
   *
   * @param {import("@babel/types").Node } functionNode - 表示函数节点。
   * @param {import("@babel/types").Node } functionStringNode - 表示函数字符串实现的 AST 节点。
   * @returns {import("@babel/types").Statement| undefined} 返回赋值 toString 属性的表达式语句 AST 节点，
   */
  generateStatementInObjectExpression(functionNode, functionStringNode) {
    const tmp = template(`(() => {
        const _tmpFunc = FUNCTION;
        _tmpFunc.toString = FUNCTION_STRING;
        return _tmpFunc;
      })()`);
    return tmp({
      FUNCTION: functionNode,
      FUNCTION_STRING: functionStringNode,
    });
  }

  insertFunctionStringNodeInProgram(functionPath) {
    const functionStringNode = this.generateFunctionStringNode(
      this.getFunctionString()
    );
    const statement = this.generateStatementInProgram(
      functionPath.node,
      functionStringNode
    );
    if (!statement) {
      return;
    }
    const targetPath = this.getInsertTargetPath(functionPath);
    if (targetPath) {
      this.markNodeCanSkip(this.path.node);
      this.markNodeCanSkip(functionStringNode);
      targetPath.insertAfter(statement);
    }
  }

  insertFunctionStringNodeInObjectExpression(functionPath) {
    const functionStringNode = this.generateFunctionStringNode(
      this.getFunctionString()
    );
    const statement = this.generateStatementInObjectExpression(
      functionPath.node,
      functionStringNode
    );
    this.markNodeCanSkip(this.path.node);
    this.markNodeCanSkip(functionStringNode);
    this.path.replaceWith(statement);
  }

  /**
   * 生成 toString 方法节点，并插入到合适的位置
   */
  insertFunctionStringNode() {
    const functionPath = this.getFunction();
    if (!functionPath) {
      return;
    }
    if (this.isFunctionInProgram()) {
      this.insertFunctionStringNodeInProgram(functionPath);
    } else if (this.isFunctionInObjectExpression()) {
      this.insertFunctionStringNodeInObjectExpression(functionPath);
    }
  }

  /**
   * 寻找合适的path，以便在 path 后插入语句
   * @param {import('@babel/core').NodePath} path
   * @return {import('@babel/core').NodePath | null}
   */
  getInsertTargetPath(path) {
    if (path.isFunctionDeclaration()) {
      return path;
    }
    if (path.isVariableDeclarator()) {
      const { parentPath } = path;
      if (parentPath.isVariableDeclaration()) {
        return parentPath;
      }
    }
    return null;
  }

  /**
   * 获取当前函数的源代码字符串，自动去除 TypeScript 类型
   * @returns {string}
   */
  getFunctionString() {
    return generate(this.path.node, {
      comments: false,
      retainLines: false,
      retainFunctionParens: true,
      concise: true,
    }).code;
  }
}

/**
 * 给function添加function.toString方法
 * 值为函数的源代码字符串。
 * 适用于函数声明、变量声明中的函数表达式或箭头函数，以及类方法。
 * 该方法会在函数被调用时返回其源代码字符串。
 * @param {import("@babel/core")} babel - The Babel object.
 * @param {import("@babel/core").types} babel.types - Babel types utility for AST manipulation.
 * @param {{include: string[]}} options - Options for the plugin.
 * @returns {import("@babel/core").PluginObj} A Babel visitor object to traverse and transform the AST.
 */
module.exports = function ({ types: t }, options = {}) {
  const { include = [] } = options;
  return {
    visitor: {
      Function: {
        exit(path, state) {
          const { filename, root } = state.file.opts;
          if (
            !filename ||
            include.length === 0 ||
            include.every(
              (v) => !micromatch.isMatch(nodeJsPath.relative(root, filename), v)
            )
          ) {
            return;
          }
          const functionString = new FunctionString(path, t);
          if (functionString.isFunctionInObjectExpressionOrProgram()) {
            functionString.insertFunctionStringNode();
          }
        },
      },
    },
  };
};
