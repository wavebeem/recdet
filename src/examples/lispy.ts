import * as util from "util";

import { Location, Tokenizer, Result, Token, Language } from "..";

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

  static fake(type: string, x: any) {
    return new AST(type, x, Location.FAKE, Location.FAKE);
  }

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

  token(type: string): Result<AST> {
    return this.consume(type).map(({ type, text, start, end }) => {
      return new AST(type, text, start, end);
    });
  }

  default(): Result<AST> {
    return this.Atom();
  }

  Atom(): Result<AST> {
    return this.Number()
      .or(() => this.Symbol())
      .or(() => this.List());
  }

  Number(): Result<AST> {
    return this.token("number").map(node => node.map(s => +s));
  }

  Symbol(): Result<AST> {
    return this.token("symbol");
  }

  LParen(): Result<AST> {
    return this.token("lparen");
  }

  RParen(): Result<AST> {
    return this.token("rparen");
  }

  // List(): Result<AST> {
  //   return this.LParen().flatMap(lp => {
  //     return this.many0(() => this.Atom()).flatMap(items => {
  //       return this.RParen().map(rp => {
  //         return new AST("list", items, lp.start, rp.end);
  //       });
  //     });
  //   });
  // }

  List(): Result<AST> {
    return this.map3(
      () => this.LParen(),
      () => this.many0(() => this.Atom()),
      () => this.RParen(),
      (lp, items, rp) => new AST("list", items, lp.start, rp.end)
    );
  }

  static parse(input: string) {
    return new Lisp().parse(input);
  }
}

const input = "a b";

// const input = `\
// (list
//   1
//   2
//   (add a b))
// `;

console.log(input);
console.log();
show(Lisp.parse(input));
