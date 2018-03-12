import { Tokenizer, Parser, Language } from ".";

class LispTokenizer extends Tokenizer {
  states = {
    default: [
      () => this.match("comment", /;.*\n/),
      () => this.match("lparen", /\(/),
      () => this.match("rparen", /\)/),
      () => this.match("symbol", /[a-z][a-z0-9]*/i),
      () => this.skip(/\s+/),
      () => this.match("any", /./)
    ]
  };
}

class LispParser extends Parser {
  // ...
}

class Lisp extends Language {
  static parse(input: string) {
    return new Lisp(new LispTokenizer(), new LispParser()).parse(input);
  }
}

const input = `\
(list
  1
  2
  (add a b))
`;
console.log(input);
console.log(Lisp.parse(input));
