class Loc {
  constructor(
    readonly offset: number,
    readonly line: number,
    readonly column: number
  ) {}

  addChunk(text: string) {
    let { line, column } = this;
    for (const c of text) {
      if (c === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
    }
    return new Loc(this.offset + text.length, line, column);
  }

  toString() {
    return `#<Location offset=${this.offset} line=${this.line} column=${this.column}>`;
  }
}

class Token {
  constructor(
    readonly type: string,
    readonly text: string,
    readonly start: Loc,
    readonly end: Loc
  ) {}
}

interface TokenizeHelper {
  (context: TokenizeContext): Token | Loc | void;
}

class TokenizeContext {
  constructor(readonly input: string, readonly location: Loc) {}

  text() {
    return this.input.slice(this.location.offset);
  }

  anchor(pattern: RegExp) {
    return new RegExp(`^${pattern.source}`, pattern.flags);
  }

  private _match(type: string | void, pattern: RegExp): Token | Loc | void {
    const match = this.text().match(this.anchor(pattern));
    if (match) {
      const [text] = match;
      const loc = this.location.addChunk(text);
      if (type) {
        return new Token(type, text, this.location, loc);
      }
      return loc;
    }
    return undefined;
  }

  match(type: string, pattern: RegExp) {
    return this._match(type, pattern);
  }

  skip(pattern: RegExp) {
    return this._match(undefined, pattern);
  }
}

abstract class Tokenizer {
  abstract states: Record<string, TokenizeHelper[]>;

  private _state: string[] = [];

  state() {
    return this._state[this._state.length - 1];
  }

  pushState(state: string) {
    this._state.push(state);
  }

  popState() {
    this._state.pop();
  }

  *tokenize(input: string) {
    this._state = ["default"];
    const length = input.length;
    let loc = new Loc(0, 1, 1);
    while (loc.offset < length) {
      const funcs = this.states[this.state()];
      const ctx = new TokenizeContext(input, loc);
      for (let i = 0; i < funcs.length; i++) {
        const oldLength = this._state.length;
        const func = funcs[i];
        const tokLoc = func(ctx);
        if (tokLoc instanceof Token) {
          loc = tokLoc.end;
          yield tokLoc;
          break;
        } else if (tokLoc instanceof Loc) {
          loc = tokLoc;
          break;
        }
        if (oldLength !== this._state.length) {
          // Pop the state automatically if the tokenize helper didn't match
          this.popState();
        }
        // Last item
        if (i === funcs.length - 1) {
          throw new Error(`tokenizer error at ${loc}`);
        }
      }
    }
    yield new Token("eof", "", loc, loc);
  }
}

class LispTokenizer extends Tokenizer {
  states = {
    default: [
      (ctx: TokenizeContext) => ctx.match("comment", /;.*\n/),
      (ctx: TokenizeContext) => ctx.match("lparen", /\(/),
      (ctx: TokenizeContext) => ctx.match("rparen", /\)/),
      (ctx: TokenizeContext) => ctx.match("symbol", /[a-z][a-z0-9]*/i),
      (ctx: TokenizeContext) => ctx.skip(/\s+/),
      (ctx: TokenizeContext) => ctx.match("any", /./)
    ]
  };
}

class Parser {
  parse(tokens: Token[]) {
    return tokens;
  }
}

class LispParser extends Parser {
  // ...
}

class Language {
  constructor(readonly tokenizer: Tokenizer, readonly parser: Parser) {}

  parse(input: string) {
    return this.parser.parse([...this.tokenizer.tokenize(input)]);
  }
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
