export class Location {
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
    return new Location(this.offset + text.length, line, column);
  }

  toString() {
    return `#<Location offset=${this.offset} line=${this.line} column=${
      this.column
    }>`;
  }

  toEnglish() {
    return `line ${this.line}, column ${this.column}`;
  }
}

export class Token {
  constructor(
    readonly type: string,
    readonly text: string,
    readonly start: Location,
    readonly end: Location
  ) {}
}

export abstract class Tokenizer {
  abstract states: Record<string, (() => Token | Location | void)[]>;

  private _state: string[] = [];
  input: string = "";
  location: Location = new Location(0, 1, 1);

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

  // TODO: Maybe there's a better way to handle this than returning this ad-hoc
  // union type? Perhaps a proper algebraic sum type with tags? idk
  private _match(type: string | void, pattern: RegExp): Token | Location | void {
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
    this.location = new Location(0, 1, 1);
    while (this.location.offset < length) {
      const funcs = this.states[this.state()];
      for (let i = 0; i < funcs.length; i++) {
        const oldLength = this._state.length;
        const func = funcs[i];
        const tokLoc = func.call(this);
        if (tokLoc instanceof Token) {
          this.location = tokLoc.end;
          yield tokLoc;
          break;
        } else if (tokLoc instanceof Location) {
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

// TODO: Close the iterator? idk
export abstract class Parser<AST> {
  abstract default(): AST | void;

  lastError: string = "<unknown error>";
  lastToken: Token | void = undefined;

  constructor(readonly tokens: Iterator<Token>) {}

  expected(message: string) {
    this.lastError = message;
    return undefined;
  }

  consume(type: string) {
    const { done, value } = this.tokens.next();
    if (!done && value.type === type) {
      this.lastToken = value;
      return value;
    }
    return undefined;
  }

  // TODO: return more information about failures
  parse() {
    const node = this.default();
    if (node) {
      return node;
    }
    throw new Error(this.errorMessage());
  }

  errorMessage() {
    console.log(this.lastToken);
    const loc = this.lastToken ? this.lastToken.start : new Location(0, 1, 1);
    return `expected ${this.lastError} at ${loc.toEnglish()}`;
  }
}
