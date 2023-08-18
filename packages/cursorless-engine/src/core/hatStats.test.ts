import {
  HatStability,
  HatStyleMap,
  HatStyleName,
  InMemoryTextDocument,
  InMemoryTextEditor,
  Selection,
  TokenHat,
  TokenHatSplittingMode,
  getCursorlessRepoRoot,
} from "@cursorless/common";
import * as fs from "fs";
import { unitTestSetup } from "../test/unitTestSetup";
import { TokenGraphemeSplitter } from "../tokenGraphemeSplitter";
import { allocateHats } from "../util/allocateHats";
import path = require("path");
import { getRankedTokens } from "../util/allocateHats/getRankedTokens";

// TODO: dedup with vscode

export const HAT_COLORS = [
  "default",
  "blue",
  "green",
  "red",
  "pink",
  "yellow",
  "userColor1",
  "userColor2",
] as const;

export const HAT_NON_DEFAULT_SHAPES = [
  "ex",
  "fox",
  "wing",
  "hole",
  "frame",
  "curve",
  "eye",
  "play",
  "bolt",
  "crosshairs",
] as const;

export const HAT_SHAPES = ["default", ...HAT_NON_DEFAULT_SHAPES] as const;

const charForShape: Map<string, string> = new Map(
  Object.entries({
    ex: "x",
    fox: "v",
    wing: "w", // TODO: this is the only one that looks nothing like its shape
    hole: "o",
    frame: "#",
    curve: "^",
    eye: "0",
    play: ">",
    bolt: "~",
    crosshairs: "+",
  }),
);

const charForColor: Map<string, string> = new Map(
  Object.entries({
    default: "*",
    blue: "b",
    green: "g",
    red: "r",
    pink: "p",
    yellow: "y",
    userColor1: "1",
    userColor2: "2",
  }),
);

const tokenHatSplittingDefaults: TokenHatSplittingMode = {
  preserveCase: false,
  lettersToPreserve: [],
  symbolsToPreserve: [],
};

// TODO: this is WAY too slow.
// figure out how to optimize hat allocation
suite("hatStats", () => {
  unitTestSetup(({ configuration }) => {
    configuration.mockConfiguration("tokenHatSplittingMode", {
      ...tokenHatSplittingDefaults,
    });
  });
  const colors = HAT_COLORS;
  const shapes = HAT_SHAPES;
  // allHatStyles is the cross product of all colors and shapes
  const allHatStyles: HatStyleMap = Object.fromEntries(
    colors.flatMap((color) =>
      shapes.map((shape) => [
        shape === "default" ? `${color}` : `${color}-${shape}`,
        {
          penalty: penaltyForColorShape(color, shape),
        },
      ]),
    ),
  );

  const fixturePath = path.join(
    getCursorlessRepoRoot(),
    "packages",
    "cursorless-engine",
    "src",
    "test",
    "fixtures",
    "hat-stats",
  );

  fs.readdirSync(fixturePath).forEach((file) => {
    if (
      file.endsWith(".stats") ||
      file.endsWith(".golden") ||
      file.startsWith(".") // silly dot files
    ) {
      return;
    }

    test(file, () => {
      // TODO: test with fewer hats enabled also?
      const filepath = path.join(fixturePath, file);
      // console.log(`working on: ${file}`);

      const slurp = fs.readFileSync(filepath, "utf-8");
      const doc: InMemoryTextDocument = new InMemoryTextDocument(
        filepath.toString(),
        slurp,
      );

      // get a list of all tokens so that we can iterate over them,
      // placing the primary selection before each one in turn
      const editor = new InMemoryTextEditor(doc, true);
      const allTokens = getRankedTokens(editor, [editor]);

      const nHats: number[] = [];
      const nPenalty0: number[] = [];
      const nPenalty1: number[] = [];
      const nPenalty2: number[] = [];
      // take exactly 16 tokens from allTokens, equally spaced,
      // not every 16th token
      const someTokens = allTokens.filter(
        (_, index) => index % Math.floor(allTokens.length / 16) === 0,
      );

      someTokens.forEach((token, index) => {
        editor.primarySelection = new Selection(
          token.token.range.start,
          token.token.range.start,
        );

        const tokenHat = allocateHats(
          new TokenGraphemeSplitter(),
          allHatStyles,
          [], // for now, no old token hats
          HatStability.greedy, // doesn't matter for now, because there are no old hats,
          editor,
          [editor],
        );

        if (index === 0) {
          // TODO: extract this into a function
          // write a golden file
          // iterate over all tokens, writing out hats and ranges and content
          const w = fs.createWriteStream(`${filepath}.golden`);
          const lines = slurp.split(/\r?\n/);
          lines.forEach((line, lineno) => {
            // use only one empty line per empty input line, rather than three
            if (line.length === 0) {
              return;
            }
            // TODO: this is wasteful. oh well?
            const lineTokens = allTokens.filter(
              (token) => token.token.range.end.line === lineno,
            );
            let shapeLine = "";
            let colorLine = "";
            let rangeLine = "";
            lineTokens.forEach((token) => {
              const tokenRange = token.token.range;
              if (tokenRange.start.line !== tokenRange.end.line) {
                throw new Error(
                  `multi-line tokens not supported, have ${tokenRange.concise()}`,
                );
              }

              // TODO: this is inefficient, no?
              const hat = tokenHat.find(
                // todo: fix this to work
                (hat) => hat.token.range.isEqual(token.token.range),
              ) as TokenHat;
              if (hat === undefined) {
                return;
              }
              const hatRange = hat.hatRange;
              const [color, shape] = colorShapeForHatStyle(hat.hatStyle);
              if (shape !== "default") {
                shapeLine += " ".repeat(
                  hatRange.start.character - shapeLine.length,
                );
                shapeLine += charForShape.get(shape);
              }
              colorLine += " ".repeat(
                hatRange.start.character - colorLine.length,
              );
              colorLine += charForColor.get(color);
              const width =
                tokenRange.end.character - tokenRange.start.character;
              let rangeStr = "";
              if (width === 1) {
                rangeStr = "#";
              } else if (width === 2) {
                rangeStr = "[]";
              } else if (width > 2) {
                rangeStr = "[" + "-".repeat(width - 2) + "]";
              } else {
                throw new Error(`unexpected width: ${width}`);
              }
              rangeLine += " ".repeat(
                tokenRange.start.character - rangeLine.length,
              );
              rangeLine += rangeStr;
            });
            if (shapeLine.length !== 0) {
              w.write(shapeLine + "\n");
            }
            if (colorLine.length !== 0) {
              w.write(colorLine + "\n");
            }
            if (line.length !== 0) {
              // TODO: tabs, emoji, sigh
              line = line.replace(/\t/, "␉");
              w.write(line + "\n");
            }
            if (rangeLine.length !== 0) {
              w.write(rangeLine + "\n");
            }
            w.write("\n");
          });
          w.end();
        }

        // todo: do another allocation nearby with balanced/stable,
        // and track % of hats that move

        nHats.push((100 * tokenHat.length) / allTokens.length);
        const nTokensWithPenalty: number[] = [0, 0, 0];
        tokenHat.forEach((tokenHat) => {
          const hatStyle = tokenHat.hatStyle;
          const penalty = penaltyForHatStyle(hatStyle);
          nTokensWithPenalty[penalty] += 1;
        });
        nPenalty0.push((100 * nTokensWithPenalty[0]) / allTokens.length);
        nPenalty1.push((100 * nTokensWithPenalty[1]) / allTokens.length);
        nPenalty2.push((100 * nTokensWithPenalty[2]) / allTokens.length);
      });

      let s = "";
      s += `nTokens: ${allTokens.length}\n`;
      s += describeDistribution("nHats", nHats) + "\n";
      s += describeDistribution("nPenalty0", nPenalty0) + "\n";
      s += describeDistribution("nPenalty1", nPenalty1) + "\n";
      s += describeDistribution("nPenalty2", nPenalty2) + "\n";
      fs.writeFileSync(filepath + ".stats", s);
    });
  });
});

function colorShapeForHatStyle(hatStyle: HatStyleName): [string, string] {
  const [color, shape] = hatStyle.split("-");
  return [color, shape ?? "default"];
}

function penaltyForHatStyle(hatStyle: HatStyleName): number {
  const [color, shape] = colorShapeForHatStyle(hatStyle);
  return penaltyForColorShape(color, shape ?? "default");
}

function penaltyForColorShape(color: string, shape: string): number {
  return (shape === "default" ? 0 : 1) + (color === "default" ? 0 : 1);
}

function describeDistribution(name: string, x: number[]): string {
  const n = x.length;
  const mean = x.reduce((a, b) => a + b, 0) / n;
  const variance =
    x.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const min = Math.min(...x);
  const max = Math.max(...x);
  // create a sparkline histogram with 50 bins
  const binCounts = new Array(51).fill(0);
  x.forEach((x) => {
    const bin = Math.floor((x / 100) * 50);
    binCounts[bin] += 1;
  });
  const spark = sparkline(binCounts);
  return `${name}:\n\tmean: ${asPercent(mean)}\n\tstd: ${asPercent(
    std,
  )}\n\tmin: ${asPercent(min)}\n\tmax: ${asPercent(max)}\n\tspark: ${spark}\n`;
}

function asPercent(n: number): string {
  return (
    n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + "%"
  );
}

function sparkline(pcts: number[]) {
  const bars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const max = Math.max(...pcts);
  const chars = pcts.map((pct) => {
    if (pct === 0) {
      return " ";
    }
    const idx = Math.ceil((pct / max) * bars.length) - 1;
    return bars[idx];
  });
  const chunk = chars.length / 4;
  return (
    `0 ${chars.slice(0 * chunk, 1 * chunk).join("")} ` +
    `25 ${chars.slice(1 * chunk, 2 * chunk).join("")} ` +
    `50 ${chars.slice(2 * chunk, 3 * chunk).join("")} ` +
    `75 ${chars.slice(3 * chunk, 4 * chunk).join("")} ` +
    `100`
  );
}
