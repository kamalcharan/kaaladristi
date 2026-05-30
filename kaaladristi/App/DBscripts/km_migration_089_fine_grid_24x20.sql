-- Migration 089: Convert workspace grid from 12×10 to 24×20
--
-- Each old grid line N maps to new grid line (N * 2 - 1).
-- This doubles the grid resolution while preserving visual proportions:
--   old col 1-8 span (8 cols) → new col 1-16 span (16 of 24 cols)
--   old row 1-9 span (9 rows) → new row 1-18 span (18 of 20 rows)
-- Cell height changes from 6rem to 3rem in the frontend, keeping canvas size identical.

UPDATE user_frameworks
SET blocks = (
  SELECT jsonb_agg(
    block || jsonb_build_object(
      'grid_position', jsonb_build_object(
        'col_start', ((block -> 'grid_position' ->> 'col_start')::int * 2 - 1),
        'col_end',   ((block -> 'grid_position' ->> 'col_end')::int   * 2 - 1),
        'row_start', ((block -> 'grid_position' ->> 'row_start')::int * 2 - 1),
        'row_end',   ((block -> 'grid_position' ->> 'row_end')::int   * 2 - 1)
      )
    )
  )
  FROM jsonb_array_elements(blocks) AS block
)
WHERE blocks IS NOT NULL
  AND jsonb_array_length(blocks) > 0;
