import * as assert from "assert";
import { InMemoryTextDocument, Range } from "..";

suite("mockEditor", () => {
  test("basic", () => {
    const s = "abc\n\n123\n";
    const doc: InMemoryTextDocument = new InMemoryTextDocument("test.txt", s);

    for (let i = 0; i < s.length; i++) {
      const pos = doc.positionAt(i);
      const offset = doc.offsetAt(pos);
      assert.equal(offset, i);
    }
    const line0 = doc.lineAt(0);
    assert.equal(line0.text, "abc");
    assert.equal(line0.firstNonWhitespaceCharacterIndex, 0);
    assert.equal(line0.isEmptyOrWhitespace, false);
    assert.equal(line0.lineNumber, 0);
    assert.ok(line0.range.isEqual(new Range(0, 0, 0, 2)));
    assert.equal(line0.rangeIncludingLineBreak.start.character, 0);
    assert.equal(line0.lastNonWhitespaceCharacterIndex, 2);

    const line1 = doc.lineAt(1);
    assert.equal(line1.text, "");
    assert.equal(line1.firstNonWhitespaceCharacterIndex, 0);
    assert.equal(line1.isEmptyOrWhitespace, true);
    assert.equal(line1.lineNumber, 1);
    assert.ok(line1.range.isEqual(new Range(1, 0, 1, 0)));
    assert.equal(line1.rangeIncludingLineBreak.start.character, 0);
    assert.equal(line1.lastNonWhitespaceCharacterIndex, 0);
  });
});
