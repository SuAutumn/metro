function greet(name: string): string {
  return `Hello, ${name}!`;
}

const sayBye = function (name: string) {
  return `Goodbye, ${name}!`;
};

const sayHi = (name: string) => `Hi, ${name}!`;

const a = {
  c: () => {
    return "c";
  },
  sayHi,
};

class Person {
  speak() {
    return "Speaking...";
  }
}
