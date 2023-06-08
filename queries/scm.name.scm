;; Include everything leading up to the first capture in the domain for name
(
  (_
    _ @dummy
    .
    (capture) @name @_.domain.end
  ) @_.domain.start
  (#not-type? @_.domain.start parameters)
  (#not-parent-type? @_.domain.start field_definition)
  (#child-range! @_.domain.start 0 0)
  (#not-type? @dummy capture)
)

;; In a field definition, include the field name in the domain for nmae
(
  (field_definition
    name: (identifier) @_.domain.start
    (_
      _ @dummy
      .
      (capture) @name @_.domain.end
    )
  )
  (#not-type? @dummy capture)
)

;; Only include the capture itself in its domain after the first capture
(
  (_
    (capture)
    .
    (capture) @name
  ) @dummy
  (#not-type? @dummy parameters)
)

[
  (list)
  (anonymous_node)
  (grouping)
  (named_node)
] @name.iteration
