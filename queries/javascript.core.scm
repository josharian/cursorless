;; import javascript.fieldAccess.scm

(_
    name: (_) @name
) @_.domain

(augmented_assignment_expression
    left: (_) @name
) @_.domain

(assignment_expression
    left: (_) @name
) @_.domain

[
  (program)
  (formal_parameters)
] @name.iteration

(
  (_
    body: (_
        .
        "{" @name.iteration.start
        "}" @name.iteration.end
        .
    )
  )
  (#end-position! @name.iteration.start)
  (#start-position! @name.iteration.end)
)
