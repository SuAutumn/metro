module.exports = async ({ code }) => {
  return {
    code, // 返回未压缩的代码
    map: null, // 不生成 source map
  };
};
