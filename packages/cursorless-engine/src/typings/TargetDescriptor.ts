import {
  PartialPrimitiveTargetDescriptor,
  Mark,
  Modifier,
  PositionModifier,
  PartialRangeType,
  ImplicitTargetDescriptor,
  ScopeType,
} from "@cursorless/common";

export interface PrimitiveTargetDescriptor
  extends PartialPrimitiveTargetDescriptor {
  /**
   * The mark, eg "air", "this", "that", etc
   */
  mark: Mark | undefined;

  /**
   * Zero or more modifiers that will be applied in sequence to the output from
   * the mark.  Note that the modifiers will be applied in reverse order.  For
   * example, if the user says "take first char name air", then we will apply
   * "name" to the output of "air" to select the name of the function or
   * statement containing "air", then apply "first char" to select the first
   * character of the name.
   */
  modifiers: Modifier[];

  /**
   * We separate the positional modifier from the other modifiers because it
   * behaves differently and and makes the target behave like a destination for
   * example for bring.  This change is the first step toward #803
   */
  positionModifier?: PositionModifier;
}

interface BaseRangeTargetDescriptor {
  type: "range";
  anchor: PrimitiveTargetDescriptor | ImplicitTargetDescriptor;
  active: PrimitiveTargetDescriptor;
  excludeAnchor: boolean;
  excludeActive: boolean;
  rangeType: PartialRangeType | "every";
}

interface SimpleRangeTargetDescriptor extends BaseRangeTargetDescriptor {
  rangeType: PartialRangeType;
}

/** Represents targets such as "every line air past bat" */
export interface EveryRangeTargetDescriptor extends BaseRangeTargetDescriptor {
  rangeType: "every";
  scopeType: ScopeType;

  /** Modifiers to be applied after constructing the "every" range */
  modifiers: Modifier[];

  /**
   * Position modifiers to be applied after constructing the "every" range. We
   * separate the positional modifier from the other modifiers because it
   * behaves differently and and makes the target behave like a destination for
   * example for bring.  This change is the first step toward #803
   */
  positionModifier?: PositionModifier;
}

export type RangeTargetDescriptor =
  | SimpleRangeTargetDescriptor
  | EveryRangeTargetDescriptor;

export interface ListTargetDescriptor {
  type: "list";
  elements: (PrimitiveTargetDescriptor | RangeTargetDescriptor)[];
}

export type TargetDescriptor =
  | PrimitiveTargetDescriptor
  | RangeTargetDescriptor
  | ListTargetDescriptor
  | ImplicitTargetDescriptor;
