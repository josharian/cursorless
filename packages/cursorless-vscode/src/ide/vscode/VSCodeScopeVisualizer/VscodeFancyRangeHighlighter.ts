import {
  CharacterRange,
  CompositeKeyDefaultMap,
  GeneralizedRange,
  LineRange,
  Range,
  isLineRange,
  partition,
} from "@cursorless/common";
import { toVscodeRange } from "@cursorless/vscode-common";
import { chain, flatmap } from "itertools";
import * as vscode from "vscode";
import {
  DecorationRangeBehavior,
  DecorationRenderOptions,
  TextEditorDecorationType,
  window,
} from "vscode";
import { RangeTypeColors } from "./RangeTypeColors";
import { VscodeTextEditorImpl } from "../VscodeTextEditorImpl";
import { generateDecorationsForCharacterRange } from "./getDecorationRanges/generateDecorationsForCharacterRange";
import { generateDecorationsForLineRange } from "./getDecorationRanges/generateDecorationsForLineRange";
import {
  BorderStyle,
  DecorationStyle,
  StyleParameters,
  StyleParametersRanges,
} from "./getDecorationRanges/getDecorationRanges.types";
import { getDifferentiatedRanges } from "./getDecorationRanges/getDifferentiatedRanges";

/**
 * Manages VSCode decoration types for a highlight or flash style.
 */
export class VscodeFancyRangeHighlighter {
  private decorator: Decorator;

  constructor(colors: RangeTypeColors) {
    this.decorator = new Decorator(colors);
  }

  setRanges(editor: VscodeTextEditorImpl, ranges: GeneralizedRange[]) {
    const [lineRanges, characterRanges] = partition<LineRange, CharacterRange>(
      ranges,
      isLineRange,
    );

    const decoratedRanges = Array.from(
      chain(
        flatmap(characterRanges, ({ start, end }) =>
          generateDecorationsForCharacterRange(editor, new Range(start, end)),
        ),
        flatmap(lineRanges, ({ start, end }) =>
          generateDecorationsForLineRange(start, end),
        ),
      ),
    );

    this.decorator.setDecorations(
      editor,
      getDifferentiatedRanges(decoratedRanges, getBorderKey),
    );
  }

  dispose() {
    this.decorator.dispose();
  }
}

function getBorderKey({
  top,
  right,
  left,
  bottom,
  isWholeLine,
}: DecorationStyle) {
  return [top, right, left, bottom, isWholeLine ?? false];
}

class Decorator {
  private decorationTypes: CompositeKeyDefaultMap<
    StyleParameters<DecorationStyle>,
    TextEditorDecorationType
  >;

  constructor(colors: RangeTypeColors) {
    this.decorationTypes = new CompositeKeyDefaultMap(
      ({ style }) => getDecorationStyle(colors, style),
      ({
        style: { top, right, bottom, left, isWholeLine },
        differentiationIndex,
      }) => [
        top,
        right,
        bottom,
        left,
        isWholeLine ?? false,
        differentiationIndex,
      ],
    );
  }

  setDecorations(
    editor: VscodeTextEditorImpl,
    decoratedRanges: StyleParametersRanges<DecorationStyle>[],
  ) {
    const untouchedDecorationTypes = new Set(this.decorationTypes.values());

    decoratedRanges.forEach(({ styleParameters, ranges }) => {
      const decorationType = this.decorationTypes.get(styleParameters);

      editor.vscodeEditor.setDecorations(
        decorationType,
        ranges.map(toVscodeRange),
      );

      untouchedDecorationTypes.delete(decorationType);
    });

    untouchedDecorationTypes.forEach((decorationType) => {
      editor.vscodeEditor.setDecorations(decorationType, []);
    });
  }

  dispose() {
    Array.from(this.decorationTypes.values()).forEach((decorationType) => {
      decorationType.dispose();
    });
  }
}

function getDecorationStyle(
  colors: RangeTypeColors,
  borders: DecorationStyle,
): vscode.TextEditorDecorationType {
  const options: DecorationRenderOptions = {
    light: {
      backgroundColor: colors.background.light,
      borderColor: getBorderColor(
        colors.borderSolid.light,
        colors.borderPorous.light,
        borders,
      ),
    },
    dark: {
      backgroundColor: colors.background.dark,
      borderColor: getBorderColor(
        colors.borderSolid.dark,
        colors.borderPorous.dark,
        borders,
      ),
    },
    borderStyle: getBorderStyle(borders),
    borderWidth: "1px",
    borderRadius: getBorderRadius(borders),
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    isWholeLine: borders.isWholeLine,
  };

  return window.createTextEditorDecorationType(options);
}

function getBorderStyle(borders: DecorationStyle): string {
  return [borders.top, borders.right, borders.bottom, borders.left].join(" ");
}

function getBorderColor(
  solidColor: string,
  porousColor: string,
  borders: DecorationStyle,
): string {
  return [
    borders.top === BorderStyle.solid ? solidColor : porousColor,
    borders.right === BorderStyle.solid ? solidColor : porousColor,
    borders.bottom === BorderStyle.solid ? solidColor : porousColor,
    borders.left === BorderStyle.solid ? solidColor : porousColor,
  ].join(" ");
}

function getBorderRadius(borders: DecorationStyle): string {
  return [
    borders.top === BorderStyle.solid && borders.left === BorderStyle.solid
      ? "2px"
      : "0px",
    borders.top === BorderStyle.solid && borders.right === BorderStyle.solid
      ? "2px"
      : "0px",
    borders.bottom === BorderStyle.solid && borders.right === BorderStyle.solid
      ? "2px"
      : "0px",
    borders.bottom === BorderStyle.solid && borders.left === BorderStyle.solid
      ? "2px"
      : "0px",
  ].join(" ");
}