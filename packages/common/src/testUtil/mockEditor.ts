import { URI } from "vscode-uri";
import {
  EndOfLine,
  Position,
  Range,
  Selection,
  TextEditor,
  TextEditorOptions,
  TextLine,
} from "..";
import { TextDocument } from "../types/TextDocument";

export class InMemoryTextLine implements TextLine {
  /**
   * The zero-based line number.
   */
  readonly lineNumber: number;

  /**
   * The text of this line without the line separator characters.
   */
  readonly text: string;

  /**
   * The eol character(s) of this line: "\n" or "\r\n".
   */
  private eol: string;

  constructor(lineNumber: number, text: string, eol: string) {
    if (lineNumber < 0) {
      throw new Error("lineNumber must be non-negative");
    }
    this.lineNumber = lineNumber;
    // TODO: validate text
    this.text = text;
    if (eol !== "\n" && eol !== "\r\n") {
      throw new Error("eol must be \\n or \\r\\n");
    }
    this.eol = eol;
  }

  /**
   * The range this line covers without the line separator characters.
   */
  get range(): Range {
    return new Range(this.lineNumber, 0, this.lineNumber, this.text.length);
  }

  /**
   * The range this line covers with the line separator characters.
   */
  get rangeIncludingLineBreak(): Range {
    return new Range(
      this.lineNumber,
      0,
      this.lineNumber,
      this.text.length + this.eol.length,
    );
  }

  /**
   * The offset of the first character which is not a whitespace character as defined
   * by `/\s/`. **Note** that if a line is all whitespace the length of the line is returned.
   */
  get firstNonWhitespaceCharacterIndex(): number {
    const idx = this.text.search(/\S/);
    return idx === -1 ? this.text.length : idx;
  }

  /**
   * The offset of the last character which is not a whitespace character as defined
   * by `/\s/`. **Note** that if a line is all whitespace 0 is returned.
   */
  get lastNonWhitespaceCharacterIndex(): number {
    const matches = this.text.match(/\S/g);
    if (!matches) {
      return 0;
    }
    return this.text.lastIndexOf(matches[matches.length - 1]);
  }

  /**
   * Whether this line is whitespace only, shorthand
   * for {@link TextLine.firstNonWhitespaceCharacterIndex} === {@link TextLine.text TextLine.text.length}.
   */
  get isEmptyOrWhitespace(): boolean {
    return this.firstNonWhitespaceCharacterIndex === this.text.length;
  }
}

// map of file (asa strings) to language ids
// TODO: is there a canonical list of these somewhere else?
const languageIdMap: { [key: string]: string } = {
  txt: "plaintext",
  js: "javascript",
  ts: "typescript",
  go: "go",
  py: "python",
  rs: "rust",
  java: "java",
  c: "c",
};

export class InMemoryTextDocument implements TextDocument {
  readonly uri: URI;
  readonly languageId: string;
  readonly version: number;
  readonly range: Range;
  readonly eol: EndOfLine;
  private lines: InMemoryTextLine[];
  private contents: string;

  constructor(filename: string, contents: string) {
    this.uri = URI.file(filename);
    const extension = filename.slice(filename.lastIndexOf("."));
    this.languageId = languageIdMap[extension];
    this.version = 1;
    if (contents.indexOf("\r\n") !== -1) {
      throw new Error("InMemoryTextDocument does not support CRLF (yet?)");
    }
    this.contents = contents;
    const rawLines = contents.split("\n");
    this.lines = rawLines.map((line, i) => {
      return new InMemoryTextLine(i, line, "\n");
    });
    this.range = new Range(
      0,
      0,
      this.lineCount - 1,
      this.lineLength(this.lineCount - 1),
    );
    this.eol = "LF";
  }

  get lineCount(): number {
    return this.lines.length;
  }

  private lineLength(line: number): number {
    return this.lines[line].text.length + 1; // EOF
  }

  public lineAt(x: number | Position): TextLine {
    if (typeof x === "number") {
      return this.lines[x];
    }
    return this.lines[x.line];
  }

  public offsetAt(position: Position): number {
    // nice docs, vscode. what even is an offset??
    // "Converts the position to a zero-based offset."
    // thanks, that's very illuminating.
    // maybe this is right? i think?
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += this.lineAt(i).rangeIncludingLineBreak.end.character;
    }
    offset += position.character;
    return offset;
  }

  public positionAt(offset: number): Position {
    // "Converts a zero-based offset to a position."
    // uh, ok.
    // TODO: anyone's guess as to whether this is right
    let line = 0;
    // TODO: I had this as > originally
    // and things broke--we were getting bad ranges.
    // figure out how to write a unit test for it?
    while (offset >= this.lineAt(line).rangeIncludingLineBreak.end.character) {
      offset -= this.lineAt(line).rangeIncludingLineBreak.end.character;
      line++;
    }
    return new Position(line, offset);
  }

  public getText(range?: Range): string {
    if (range === undefined) {
      return this.contents;
    }
    const startOffset = this.offsetAt(range.start);
    const endOffset = this.offsetAt(range.end);
    return this.contents.slice(startOffset, endOffset);
  }

  public normalizePosition(position: Position): Position {
    return this.positionAt(this.offsetAt(position));
  }

  public normalizeRange(range: Range): Range {
    return new Range(
      this.normalizePosition(range.start),
      this.normalizePosition(range.end),
    );
  }
}

export class InMemoryTextEditor implements TextEditor {
  public primarySelection: Selection;

  constructor(document: TextDocument, active: boolean) {
    this.id = document.uri.toString();
    this.document = document;
    this.primarySelection = new Selection(0, 0, 0, 0);
    // TODO: support visible ranges
    // TODO: support multiple selections
    // TODO: support options
    this.options = new DefaultTextEditorOptions();
    this.isActive = active;
  }

  /**
   * Unique identifier for this text editor
   */
  readonly id: string;

  /**
   * The document associated with this text editor. The document will be the same for the entire lifetime of this text editor.
   */
  readonly document: TextDocument;

  /**
   * The current visible ranges in the editor (vertically).
   * This accounts only for vertical scrolling, and not for horizontal scrolling.
   */
  get visibleRanges(): Range[] {
    return [this.document.range];
  }

  /**
   * The selections in this text editor.
   */
  get selections(): Selection[] {
    return [this.primarySelection];
  }

  /**
   * Text editor options.
   */
  readonly options: TextEditorOptions;

  /**
   * True if this text editor is active.
   */
  readonly isActive: boolean;

  /**
   * Check if this text editor is equal to `other`.
   *
   * @param other A text editor.
   * @return `true` if the this text editor is equal to `other`.
   */
  isEqual(other: TextEditor): boolean {
    return this.id === other.id;
  }
}

class DefaultTextEditorOptions implements TextEditorOptions {
  get tabSize(): number | string {
    return 4;
  }

  get insertSpaces(): boolean | string {
    return true;
  }
}
