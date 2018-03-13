import { Tokenizer, Parser, Location } from ".";

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

class AST {
  constructor(
    readonly type: string,
    readonly value: any,
    readonly start: Location,
    readonly end: Location
  ) {}
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
    return this.parseAtom();
  }

  parseAtom() {
    return (
      this.parseNumber() ||
      this.parseIdentifier() ||
      this.parseList() ||
      this.expected("number, identifier, or list")
    );
  }

  parseNumber() {
    return this.token("Number") || this.expected("number");
  }

  parseIdentifier() {
    return this.token("Identifier") || this.expected("identifier");
  }

  parseLeftParen() {
    return this.token("LeftParen") || this.expected("(");
  }

  parseRightParen() {
    return this.token("RightParen") || this.expected(")");
  }

  parseList() {
    const lp = this.parseLeftParen();
    if (!lp) {
      return undefined;
    }
    const items: AST[] = [];
    let item = undefined;
    while ((item = this.parseAtom())) {
      items.push(item);
    }
    const rp = this.parseRightParen();
    if (!rp) {
      return undefined;
    }
    return new AST("List", items, lp.start, rp.end);
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
console.log(Lisp.parse(input));
