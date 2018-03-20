import * as util from "util";

import { Location, Tokenizer, Language } from ".";

function show<T>(value: T) {
  console.log(util.inspect(value, { depth: null, colors: true }));
  return value;
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

class Lisp extends Language<AST> {
  getRules(ctx: Tokenizer) {
    return {
      default: [
        () => ctx.match("comment", /;.*\n/),
        () => ctx.match("lparen", /\(/),
        () => ctx.match("rparen", /\)/),
        () => ctx.match("number", /[0-9]+/i),
        () => ctx.match("symbol", /[a-z][a-z0-9]*/i),
        () => ctx.skip(/\s+/),
        () => ctx.match("any", /./)
      ]
    };
  }

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

  LParen() {
    return this.token("lparen") || this.expected("(");
  }

  RParen() {
    return this.token("rparen") || this.expected(")");
  }

  List() {
    const lp = this.LParen();
    if (!lp) {
      return undefined;
    }
    const items: AST[] = [];
    let item = undefined;
    while ((item = this.Atom())) {
      items.push(item);
    }
    const rp = this.RParen();
    if (!rp) {
      return undefined;
    }
    return new AST("list", items, lp.start, rp.end);
  }

  static parse(input: string) {
    return new Lisp().parse(input);
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
