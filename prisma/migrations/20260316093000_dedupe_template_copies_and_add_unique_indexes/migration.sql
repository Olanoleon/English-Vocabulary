-- One-time cleanup: keep a single org copy per template.
-- Preference order: customized copies first, then oldest record.
WITH ranked_areas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, source_template_id
      ORDER BY is_customized DESC, created_at ASC, id ASC
    ) AS rn
  FROM areas
  WHERE
    organization_id IS NOT NULL
    AND source_template_id IS NOT NULL
    AND scope_type = 'org'
),
duplicate_areas AS (
  SELECT id
  FROM ranked_areas
  WHERE rn > 1
)
DELETE FROM areas
WHERE id IN (SELECT id FROM duplicate_areas);

WITH ranked_sections AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, source_template_id
      ORDER BY is_customized DESC, created_at ASC, id ASC
    ) AS rn
  FROM sections
  WHERE
    organization_id IS NOT NULL
    AND source_template_id IS NOT NULL
),
duplicate_sections AS (
  SELECT id
  FROM ranked_sections
  WHERE rn > 1
)
DELETE FROM sections
WHERE id IN (SELECT id FROM duplicate_sections);

-- Hard guard: one org template copy per source template.
CREATE UNIQUE INDEX IF NOT EXISTS areas_org_template_unique_idx
  ON areas (organization_id, source_template_id)
  WHERE
    organization_id IS NOT NULL
    AND source_template_id IS NOT NULL
    AND scope_type = 'org';

CREATE UNIQUE INDEX IF NOT EXISTS sections_org_template_unique_idx
  ON sections (organization_id, source_template_id)
  WHERE
    organization_id IS NOT NULL
    AND source_template_id IS NOT NULL;
