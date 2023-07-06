import { GeneralizedRange, Range } from "@cursorless/common";
import { flatmap } from "itertools";
import { Vscode } from "@cursorless/vscode-common";
import { VscodeTextEditorImpl } from "../../VscodeTextEditorImpl";
import { RangeTypeColors } from "../RangeTypeColors";
import { VscodeFancyRangeHighlighterRenderer } from "./VscodeFancyRangeHighlighterRenderer";
import { generateDecorationsForCharacterRange } from "./generateDecorationsForCharacterRange";
import { generateDecorationsForLineRange } from "./generateDecorationsForLineRange";
import { generateDifferentiatedRanges } from "./generateDifferentiatedRanges";
import { DifferentiatedStyledRange } from "./getDecorationRanges.types";
import { groupDifferentiatedStyledRanges } from "./groupDifferentiatedStyledRanges";

/**
 * Manages VSCode decoration types for a highlight or flash style.
 */
export class VscodeFancyRangeHighlighter {
  private renderer: VscodeFancyRangeHighlighterRenderer;

  constructor(vscode: Vscode, colors: RangeTypeColors) {
    this.renderer = new VscodeFancyRangeHighlighterRenderer(vscode, colors);
  }

  setRanges(editor: VscodeTextEditorImpl, ranges: GeneralizedRange[]) {
    const decoratedRanges: Iterable<DifferentiatedStyledRange> = flatmap(
      generateDifferentiatedRanges(ranges),

      function* ({ range, differentiationIndex }) {
        const iterable =
          range.type === "line"
            ? generateDecorationsForLineRange(range.start, range.end)
            : generateDecorationsForCharacterRange(
                editor,
                new Range(range.start, range.end),
              );

        for (const { range, style } of iterable) {
          yield {
            range,
            differentiatedStyle: { style, differentiationIndex },
          };
        }
      },
    );

    this.renderer.setRanges(
      editor,
      groupDifferentiatedStyledRanges(decoratedRanges),
    );
  }

  dispose() {
    this.renderer.dispose();
  }
}