(
  (named_node
    "(" @collectionItem.iteration.start
    name: _
    _ @collectionItem
    ")" @collectionItem.iteration.end
  )
  (#end-position! @collectionItem.iteration.start)
  (#start-position! @collectionItem.iteration.end)
)

(
  (grouping
    "(" @collectionItem.iteration.start
    (_) @collectionItem
    ")" @collectionItem.iteration.end
  )
  (#end-position! @collectionItem.iteration.start)
  (#start-position! @collectionItem.iteration.end)
)

(
  (list
    "[" @list.start @collectionItem.iteration.start
    (_) @collectionItem
    "]" @list.end @collectionItem.iteration.end
  ) @list.domain
  (#end-position! @collectionItem.iteration.start)
  (#start-position! @collectionItem.iteration.end)
)
