import * as util from "util";
import * as P from "parsimmon";

declare module "parsimmon" {
  interface Parser<T> {
    tie(): Parser<string>;
    sepBy<U>(sep: Parser<U>): Parser<T[]>;
    sepBy1<U>(sep: Parser<U>): Parser<T[]>;
    wrap(l: Parser<any>, r: Parser<any>): Parser<T>;
    node(type: string): Parser<any>;
  }
}

function show<T>(value: T) {
  console.log(util.inspect(value, { depth: null, colors: true }));
  return value;
}

function fromPairs(pairs: [string, any][]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [k, v] of pairs) {
    obj[k] = v;
  }
  return obj;
}

class AST {
  constructor(
    readonly type: string,
    readonly value: any,
    readonly start: P.Index,
    readonly end: P.Index
  ) {}

  map(f: (x: any) => any) {
    return new AST(this.type, f(this.value), this.start, this.end);
  }
}

const JSONish = P.createLanguage({
  Atom: (r: any) =>
    P.alt(r.String, r.Number, r.True, r.False, r.Null, r.Array, r.Object),

  String: () =>
    P.seqMap(
      P.string('"'),
      P.regexp(/(?:\\["bnfrt]|[^\\\r\n"])*/),
      P.string('"'),
      (lq, text, rq) => text
    ).node("text"),

  Number: () =>
    P.seq(
      P.string("-").fallback(""),
      P.regexp(/[0-9]+/),
      P.regexp(/\.[0-9]+/).fallback(""),
      P.regexp(/[eE][+-]?[0-9]+/).fallback("")
    )
      .tie()
      .map(Number)
      .node("number"),

  True: () =>
    P.string("true")
      .result(true)
      .node("true"),

  False: () =>
    P.string("false")
      .result(false)
      .node("false"),

  Null: () =>
    P.string("null")
      .result(null)
      .node("null"),

  _: () => P.optWhitespace,

  Comma: r => P.string(",").trim(r._),
  Colon: r => P.string(":").trim(r._),
  LBracket: r => P.string("[").trim(r._),
  RBracket: r => P.string("]").trim(r._),
  LBrace: r => P.string("{").trim(r._),
  RBrace: r => P.string("}").trim(r._),

  Array: r =>
    r.Atom.sepBy(r.Comma)
      .wrap(r.LBracket, r.RBracket)
      .node("array"),

  _ObjectPair: r => P.seqMap(r.String, r.Colon, r.Atom, (k, c, v) => [k, v]),

  Object: r =>
    r._ObjectPair
      .sepBy(r.Comma)
      .map(fromPairs)
      .wrap(r.LBrace, r.RBrace)
      .node("object")
});

const input = `\
{
  "blah": false,
  "nice": true,
  "ok.cool": {},
  "multi-item  is cool": [1, 2, 1.34, 1e1, 1.2E-3, [{}, {}], true, false, null]
}
`;

console.log(input);
console.log();
show(JSONish.Atom.tryParse(input));
