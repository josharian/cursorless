import { SimpleScopeTypeType } from "@cursorless/common";
import type { SyntaxNode } from "web-tree-sitter";
import {
  NodeFinder,
  NodeMatcher,
  NodeMatcherAlternative,
  SelectionWithEditor,
} from "../typings/Types";
import { patternFinder } from "../util/nodeFinders";
import {
  argumentMatcher,
  cascadingMatcher,
  conditionMatcher,
  createPatternMatchers,
  matcher,
  patternMatcher,
  trailingMatcher,
} from "../util/nodeMatchers";
import {
  argumentSelectionExtractor,
  childRangeSelector,
  extendForwardPastOptional,
  getNodeInternalRange,
  getNodeRange,
  pairSelectionExtractor,
  selectWithLeadingDelimiter,
  simpleSelectionExtractor,
  unwrapSelectionExtractor,
} from "../util/nodeSelectors";
import { branchMatcher } from "./branchMatcher";
import { elseExtractor, elseIfExtractor } from "./elseIfExtractor";
import { ternaryBranchMatcher } from "./ternaryBranchMatcher";

// Generated by the following command:
// > curl https://raw.githubusercontent.com/tree-sitter/tree-sitter-typescript/4c20b54771e4b390ee058af2930feb2cd55f2bf8/typescript/src/node-types.json \
//   | jq '[.[] | select(.type == "statement" or .type == "declaration") | .subtypes[].type]'
const STATEMENT_TYPES = [
  "abstract_class_declaration",
  "ambient_declaration",
  "break_statement",
  "class_declaration",
  "continue_statement",
  "debugger_statement",
  "declaration",
  "do_statement",
  "empty_statement",
  "enum_declaration",
  "export_statement",
  "expression_statement",
  "for_in_statement",
  "for_statement",
  "function_declaration",
  "function_signature",
  "generator_function_declaration",
  "if_statement",
  "import_alias",
  "import_statement",
  "interface_declaration",
  "internal_module",
  "labeled_statement",
  "lexical_declaration",
  "module",
  "return_statement",
  //   "statement_block", This is disabled since we want the whole statement and not just the block
  "switch_statement",
  "throw_statement",
  "try_statement",
  "type_alias_declaration",
  "variable_declaration",
  "while_statement",
  "with_statement",
];

function typeMatcher(): NodeMatcher {
  const delimiterSelector = selectWithLeadingDelimiter(":");
  return function (selection: SelectionWithEditor, node: SyntaxNode) {
    if (
      node.parent?.type === "new_expression" &&
      node.type !== "new" &&
      node.type !== "arguments"
    ) {
      const identifierNode = node.parent.children.find(
        (n) => n.type === "identifier",
      );
      const argsNode = node.parent.children.find(
        (n) => n.type === "type_arguments",
      );
      if (identifierNode && argsNode) {
        return [
          {
            node,
            selection: pairSelectionExtractor(
              selection.editor,
              identifierNode,
              argsNode,
            ),
          },
        ];
      } else if (identifierNode) {
        return [
          {
            node: identifierNode,
            selection: simpleSelectionExtractor(
              selection.editor,
              identifierNode,
            ),
          },
        ];
      }
    }

    const typeAnnotationNode = node.children.find((child) =>
      ["type_annotation", "opting_type_annotation"].includes(child.type),
    );
    const targetNode = typeAnnotationNode?.lastChild;

    if (targetNode) {
      return [
        {
          node: targetNode,
          selection: delimiterSelector(selection.editor, targetNode),
        },
      ];
    }
    return null;
  };
}

function valueMatcher() {
  const pFinder = patternFinder(
    "assignment_expression[right]",
    "augmented_assignment_expression[right]",
    "*[value]",
    "shorthand_property_identifier",
  );
  return matcher(
    (node: SyntaxNode) =>
      node.type === "jsx_attribute" ? node.lastChild : pFinder(node),
    selectWithLeadingDelimiter(
      ":",
      "=",
      "+=",
      "-=",
      "*=",
      "/=",
      "%=",
      "**=",
      "&=",
      "|=",
      "^=",
      "<<=",
      ">>=",
    ),
  );
}

const mapTypes = ["object", "object_pattern"];
const listTypes = ["array", "array_pattern"];

function itemNodeFinder(): NodeFinder {
  return (node: SyntaxNode) => {
    if (
      node.type === "variable_declarator" &&
      node.childForFieldName("value") == null
    ) {
      return node;
    }
    return null;
  };
}

const nodeMatchers: Partial<
  Record<SimpleScopeTypeType, NodeMatcherAlternative>
> = {
  map: mapTypes,
  list: listTypes,
  string: ["string", "template_string"],
  collectionItem: matcher(itemNodeFinder(), argumentSelectionExtractor()),
  collectionKey: trailingMatcher(
    [
      "pair[key]",
      "jsx_attribute.property_identifier!",
      "shorthand_property_identifier",
    ],
    [":"],
  ),
  value: cascadingMatcher(
    valueMatcher(),
    patternMatcher("return_statement.~return!"),
    patternMatcher("yield_expression.~yield!"),
  ),
  ifStatement: "if_statement",
  comment: "comment",
  regularExpression: "regex",
  className: ["class_declaration[name]", "class[name]"],
  functionCall: ["call_expression", "new_expression"],
  functionCallee: cascadingMatcher(
    patternMatcher("call_expression[function]"),
    matcher(
      patternFinder("new_expression"),
      childRangeSelector(["arguments"], []),
    ),
  ),
  statement: cascadingMatcher(
    matcher(
      patternFinder(
        "property_signature",
        "public_field_definition",
        "abstract_method_signature",
      ),
      extendForwardPastOptional(";"),
    ),
    patternMatcher(
      ...STATEMENT_TYPES.map((type) => `export_statement?.${type}`),
      "method_definition",
    ),
  ),
  condition: cascadingMatcher(
    patternMatcher("ternary_expression[condition]"),
    conditionMatcher(
      "if_statement[condition]",
      "for_statement[condition]",
      "while_statement[condition]",
      "do_statement[condition]",
    ),
  ),
  switchStatementSubject: matcher(
    patternFinder("switch_statement[value]"),
    unwrapSelectionExtractor,
  ),
  branch: cascadingMatcher(
    patternMatcher("switch_case"),
    matcher(patternFinder("else_clause"), elseExtractor("if_statement")),
    matcher(patternFinder("if_statement"), elseIfExtractor()),
    branchMatcher("try_statement", ["catch_clause", "finally_clause"]),
    ternaryBranchMatcher("ternary_expression", [1, 2]),
  ),
  class: [
    "export_statement?.class_declaration", // export class | class
    "export_statement?.abstract_class_declaration", // export abstract class | abstract class
    "export_statement.class", // export default class
  ],
  type: cascadingMatcher(
    // Typed parameters, properties, and functions
    typeMatcher(),
    // matcher(findTypeNode, selectWithLeadingDelimiter(":")),
    // Type alias/interface declarations
    patternMatcher(
      "export_statement?.type_alias_declaration",
      "export_statement?.interface_declaration",
    ),
  ),
  argumentOrParameter: argumentMatcher("formal_parameters", "arguments"),
  // XML, JSX
  attribute: ["jsx_attribute"],
};

export const patternMatchers = createPatternMatchers(nodeMatchers);

export function stringTextFragmentExtractor(
  node: SyntaxNode,
  _selection: SelectionWithEditor,
) {
  if (
    node.type === "string_fragment" ||
    node.type === "regex_pattern" ||
    node.type === "jsx_text"
  ) {
    return getNodeRange(node);
  }

  if (node.type === "template_string") {
    // Exclude starting and ending quotation marks
    return getNodeInternalRange(node);
  }

  return null;
}
