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

  map(f: (x: any) => any) {
    return new AST(this.type, f(this.value), this.start, this.end);
  }
}

function fromPairs(pairs: [string, any][]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [k, v] of pairs) {
    obj[k] = v;
  }
  return obj;
}

class JSONish extends Language<AST> {
  getRules(ctx: Tokenizer) {
    return {
      default: [
        () => ctx.match("lbracket", /\[/),
        () => ctx.match("rbracket", /\]/),
        () => ctx.match("lbrace", /\{/),
        () => ctx.match("rbrace", /\}/),
        () => ctx.match("comma", /\,/),
        () => ctx.match("colon", /\:/),
        () => ctx.match("true", /true/),
        () => ctx.match("false", /false/),
        () => ctx.match("null", /null/),
        () => ctx.match("string", /"(?:\\["bnfrt]|[^\\\r\n])*"/),
        () => ctx.match("number", /-?[0-9]+\.[0-9]+[eE][+-]?[0-9]+/),
        () => ctx.match("number", /-?[0-9]+\.[0-9]+/),
        () => ctx.match("number", /-?[0-9]+[eE][+-]?[0-9]+/),
        () => ctx.match("number", /-?[0-9]+/),
        () => ctx.skip(/\s+/)
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
    return this.String()
      .or(() => this.Number())
      .or(() => this.True())
      .or(() => this.False())
      .or(() => this.Null())
      .or(() => this.Array())
      .or(() => this.Object());
  }

  // It's basically cheating to just pass this straight off to JS's number
  // handling, but JSON numbers are a subset of JS numbers so it's not really a
  // big deal
  Number(): Result<AST> {
    return this.token("number").map(node => node.map(s => +s));
  }

  // TODO: Interpret the backslash escaped characters inside the string
  String(): Result<AST> {
    return this.token("string").map(node =>
      node.map(s => s.slice(1, s.length - 1))
    );
  }

  True(): Result<AST> {
    return this.token("true").map(node => node.map(() => true));
  }

  False(): Result<AST> {
    return this.token("false").map(node => node.map(() => false));
  }

  Null(): Result<AST> {
    return this.token("null").map(node => node.map(() => null));
  }

  LBracket(): Result<AST> {
    return this.token("lbracket");
  }

  RBracket(): Result<AST> {
    return this.token("rbracket");
  }

  LBrace(): Result<AST> {
    return this.token("lbrace");
  }

  RBrace(): Result<AST> {
    return this.token("rbrace");
  }

  Comma(): Result<AST> {
    return this.token("comma");
  }

  Colon(): Result<AST> {
    return this.token("colon");
  }

  Array(): Result<AST> {
    return this.map3(
      () => this.LBracket(),
      () => this.sepBy0(() => this.Atom(), () => this.Comma()),
      () => this.RBracket(),
      (lb, items, rb) => new AST("array", items, lb.start, rb.end)
    );
  }

  _KeyValuePair(): Result<[string, any]> {
    return this.map3(
      () => this.String(),
      () => this.Colon(),
      () => this.Atom(),
      (key, _colon, value) => [key.value, value.value] as [string, any]
    );
  }

  Object(): Result<AST> {
    return this.map3(
      () => this.LBrace(),
      () => this.sepBy0(() => this._KeyValuePair(), () => this.Comma()),
      () => this.RBrace(),
      (lb, pairs, rb) => new AST("object", fromPairs(pairs), lb.start, rb.end)
    )
  }

  static parse(input: string) {
    return new JSONish().parse(input);
  }
}

const input = `
{
  "blah": false,
  "nice": true,
  "ok.cool": {},
  "multi-item  is cool": [1, 2, 1.34, 1e1, 1.2E-3, [{}, {}], true, false, null]
}
`;

console.log(input);
console.log();
show(JSONish.parse(input));
