function greet(name) {
  return `Hello, ${name}!`;
}

const sayBye = function (name) {
  return `Goodbye, ${name}!`;
};
const sayHi = (name) => `Hi, ${name}!`;

const a = {
  c: () => {
    return "c";
  },
  d() {
    return "d";
  },
  sayHi,
};

class Person {
  speak() {
    return "Speaking...";
  }
}
