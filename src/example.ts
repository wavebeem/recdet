import * as util from "util";

import { Tokenizer, Parser, Location } from ".";

function show<T>(value: T) {
  console.log(util.inspect(value, { depth: null, colors: true }));
  return value;
}

class LispTokenizer extends Tokenizer {
  states = {
    default: [
      () => this.match("comment", /;.*\n/),
      () => this.match("lparen", /\(/),
      () => this.match("rparen", /\)/),
      () => this.match("number", /[0-9]+/i),
      () => this.match("symbol", /[a-z][a-z0-9]*/i),
      () => this.skip(/\s+/),
      () => this.match("any", /./)
    ]
  };
}

class AST {
  constructor(
    readonly type: string,
    readonly value: any,
    readonly start: Location,
    readonly end: Location
  ) {}

  map(f: (x: any) => any) {
    return new AST(this.type, f(this.value), this.start, this.end);
  }
}

class LispParser extends Parser<AST> {
  token(type: string) {
    const token = this.consume(type);
    if (token) {
      return new AST(token.type, token.text, token.start, token.end);
    }
    return undefined;
  }

  default() {
    return this.Atom();
  }

  Atom() {
    return (
      this.Number() ||
      this.Symbol() ||
      this.List() ||
      this.expected("number, identifier, or list")
    );
  }

  Number() {
    const t = this.token("number");
    if (t) {
      return t.map(s => +s);
    }
    return this.expected("number");
  }

  Symbol() {
    return this.token("symbol") || this.expected("symbol");
  }

  parseLeftParen() {
    return this.token("lparen") || this.expected("(");
  }

  parseRightParen() {
    return this.token("rparen") || this.expected(")");
  }

  List() {
    const lp = this.parseLeftParen();
    if (!lp) {
      return undefined;
    }
    const items: AST[] = [];
    let item = undefined;
    while ((item = this.Atom())) {
      items.push(item);
    }
    const rp = this.parseRightParen();
    if (!rp) {
      return undefined;
    }
    return new AST("list", items, lp.start, rp.end);
  }
}

class Lisp {
  static parse(input: string) {
    return new LispParser(new LispTokenizer().tokenize(input)).parse();
  }
}

const input = `\
(list
  1
  2
  (add a b))
`;
console.log(input);
console.log();
show(Lisp.parse(input));
debugger;
