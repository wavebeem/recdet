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
  (): Token | Loc | void;
}

abstract class Tokenizer {
  abstract states: Record<string, TokenizeHelper[]>;

  private _state: string[] = [];
  input: string = "";
  location: Loc = new Loc(0, 1, 1);

  state() {
    return this._state[this._state.length - 1];
  }

  pushState(state: string) {
    this._state.push(state);
  }

  popState() {
    this._state.pop();
  }

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

  *tokenize(input: string) {
    this._state = ["default"];
    this.input = input;
    const length = input.length;
    this.location = new Loc(0, 1, 1);
    while (this.location.offset < length) {
      const funcs = this.states[this.state()];
      for (let i = 0; i < funcs.length; i++) {
        const oldLength = this._state.length;
        const func = funcs[i];
        const tokLoc = func();
        if (tokLoc instanceof Token) {
          this.location = tokLoc.end;
          yield tokLoc;
          break;
        } else if (tokLoc instanceof Loc) {
          this.location = tokLoc;
          break;
        }
        if (oldLength !== this._state.length) {
          // Pop the state automatically if the tokenize helper didn't match
          this.popState();
        }
        // Last item
        if (i === funcs.length - 1) {
          // TODO: more context in error message
          throw new Error(`tokenizer error at ${this.location}`);
        }
      }
    }
    yield new Token("eof", "", this.location, this.location);
  }
}

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
