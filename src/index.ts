export class Location {
  constructor(
    readonly offset: number,
    readonly line: number,
    readonly column: number
  ) {}

  static FAKE = new Location(-1, -1, -1);

  addChunk(text: string) {
    let { line, column } = this;
    for (const c of text) {
      if (c === "\n") {
        line++;
        column = 1;
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

type TokenizerRules = Record<string, (() => Token | Location | void)[]>;

export class Tokenizer {
  private _state: string[] = [];
  rules: TokenizerRules;
  input: string = "";
  location: Location = new Location(0, 1, 1);

  constructor(getRules: (context: Tokenizer) => TokenizerRules) {
    this.rules = getRules(this);
  }

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
  private _match(
    type: string | void,
    pattern: RegExp
  ): Token | Location | void {
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

  tokenize(input: string) {
    const ret: Token[] = [];
    this._state = ["default"];
    this.input = input;
    const length = input.length;
    this.location = new Location(0, 1, 1);
    while (this.location.offset < length) {
      const funcs = this.rules[this.state()];
      for (let i = 0; i < funcs.length; i++) {
        const oldLength = this._state.length;
        const func = funcs[i];
        const tokLoc = func.call(this);
        if (tokLoc instanceof Token) {
          this.location = tokLoc.end;
          ret.push(tokLoc);
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
    ret.push(new Token("eof", "", this.location, this.location));
    return ret;
  }
}

// TODO: accumulate multiple failures and concat those on fail
export abstract class Parser<AST> {
  abstract default(): Result<AST>;

  i: number = 0;
  tokens: Token[] = [];

  consume(type: string): Result<Token> {
    const { i, tokens } = this;
    if (i < tokens.length && tokens[i].type === type) {
      this.i++;
      return Result.ok(this.tokens[i]);
    }
    return Result.err([this.tokens[i]]);
  }

  all<A>(funcs: [() => Result<A>]): Result<[A]>;
  all<A, B>(funcs: [() => Result<A>, () => Result<B>]): Result<[A, B]>;
  all<A, B, C>(
    funcs: [() => Result<A>, () => Result<B>, () => Result<C>]
  ): Result<[A, B, C]>;
  all<T>(funcs: (() => Result<T>)[]): Result<T[]> {
    const a: T[] = [];
    for (const f of funcs) {
      const r = f();
      if (r instanceof Err) {
        return r;
      }
      r.map(t => a.push(t));
    }
    return Result.ok(a);
  }

  many0<T>(func: () => Result<T>): Result<T[]> {
    return func()
      .flatMap((item: T) => {
        return this.many0(func).map((items: T[]) => [...items, item]);
      })
      .or(() => {
        return Result.ok([] as T[]);
      });
  }

  // TODO: add many1

  // TODO: return more information about failures
  parseTokens(tokens: Token[]): Result<AST> {
    this.tokens = tokens;
    this.i = 0;
    return this.default();
    // throw new Error("what");
  }
}

export abstract class Language<R> extends Parser<R> {
  abstract getRules(context: Tokenizer): TokenizerRules;
  tokenizer: Tokenizer = new Tokenizer(this.getRules.bind(this));

  parse(input: string) {
    return super.parseTokens(this.tokenizer.tokenize(input));
  }
}

export abstract class Result<T> {
  static ok<T>(value: T): Result<T> {
    return new OK(value);
  }

  static err<T>(tokens: Token[]): Result<T> {
    return new Err(tokens);
  }

  abstract flatMap<U>(func: (value: T) => Result<U>): Result<U>;
  abstract map<U>(func: (value: T) => U): Result<U>;
  abstract or(func: () => Result<T>): Result<T>;
}

class OK<T> extends Result<T> {
  constructor(readonly _value: T) {
    super();
  }

  flatMap<U>(func: (value: T) => Result<U>): Result<U> {
    return func(this._value);
  }

  map<U>(func: (value: T) => U): Result<U> {
    return new OK(func(this._value));
  }

  or(func: () => Result<T>): Result<T> {
    return this;
  }
}

class Err<T> extends Result<T> {
  constructor(readonly _tokens: Token[]) {
    super();
  }

  flatMap<U>(func: (value: T) => Result<U>): Result<U> {
    return new Err(this._tokens);
  }

  map<U>(func: (value: T) => U): Result<U> {
    return new Err(this._tokens);
  }

  or(func: () => Result<T>): Result<T> {
    return func();
  }
}
