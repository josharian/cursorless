;; import scm.collections.scm
;; import scm.name.scm

(
  (program
    (_) @statement
  ) @_.iteration
  (#not-type? @statement comment)
)

(comment) @comment @textFragment

(anonymous_node
  name: (_) @string @textFragment
)

(predicate
  name: (identifier) @functionCallee
) @functionCall @functionCallee.domain

(grouping) @functionCall.iteration @functionCallee.iteration

(predicate
  (parameters
    (_) @argumentOrParameter
  )
) @_.iteration

(named_node
  name: _ @type
) @_.domain

(anonymous_node
  name: (_) @type
) @_.domain

(field_definition
  name: (identifier) @collectionKey
  ":"
  (_) @value
) @_.domain
