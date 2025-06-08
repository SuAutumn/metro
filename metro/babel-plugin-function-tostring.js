/**
 * Babel plugin to add a `toString` method to functions, variables, and class methods.
 *
 * This plugin modifies the AST to append a `toString` method that returns the source code
 * of the function or method it is attached to. It supports function declarations, variable
 * declarators with function expressions or arrow functions, and class methods.
 *
 * @param {import("@babel/core")} babel - The Babel object.
 * @param {import("@babel/core").types} babel.types - Babel types utility for AST manipulation.
 * @returns {import("@babel/core").PluginObj} A Babel visitor object to traverse and transform the AST.
 */
module.exports = function ({ types: t }) {
  return {
    visitor: {
      FunctionDeclaration(path, state) {
        const { node } = path;
        const funcName = node.id.name;
        const funcCode = path.getSource();

        const toStringMethod = t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.memberExpression(
              t.identifier(funcName),
              t.identifier("toString")
            ),
            t.functionExpression(
              null,
              [],
              t.blockStatement([t.returnStatement(t.stringLiteral(funcCode))])
            )
          )
        );

        path.insertAfter(toStringMethod);
      },
      VariableDeclarator(path) {
        const { node } = path;
        if (
          t.isFunctionExpression(node.init) ||
          t.isArrowFunctionExpression(node.init)
        ) {
          const varName = node.id.name;
          const funcCode = path.getSource();

          const toStringMethod = t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(
                t.identifier(varName),
                t.identifier("toString")
              ),
              t.functionExpression(
                null,
                [],
                t.blockStatement([t.returnStatement(t.stringLiteral(funcCode))])
              )
            )
          );

          path.parentPath.insertAfter(toStringMethod);
        }
      },
      ClassBody(path) {
        console.log("ClassBody", path.node.type);
      },
      ClassMethod(path, state) {
        const { node } = path;
        const methodName = node.key.name;
        const className = path.findParent((p) => {
          console.log(
            "find parent code:",
            p.node.type,
            JSON.stringify(p.getSource())
          );
          return p.isClassDeclaration();
        }).node.id.name;
        const funcCode = path.getSource();

        const toStringMethod = t.classMethod(
          "method",
          t.identifier("toString"),
          [],
          t.blockStatement([t.returnStatement(t.stringLiteral(funcCode))])
        );

        // Avoid adding multiple toString methods
        const hasToString = path.parent.body.some(
          (method) => method.key && method.key.name === "toString"
        );

        if (!hasToString) {
          path.parent.body.push(toStringMethod);
        }
      },
    },
  };
};
