Store your curated image library here.

Recommended structure:

- Flat folder is supported: `public/images/library/`
- Optional subfolders still work: `public/images/library/areas/`, `public/images/library/units/`

Rules:

1. Use square or near-square PNG/JPG images (e.g. 1024x1024 or 1024x896).
2. Keep one consistent visual style across files (cartoon/illustration).
3. Use kebab-case or underscored filenames (e.g. `human-body.png`, `human_body.png`).
4. Add/update matching entries in `src/data/image-library.json`.
5. The `path` in JSON must start with `/images/library/...`.

If `IMAGE_LIBRARY_ONLY=true`, the app will only use this folder + JSON mapping
and will not call Unsplash.
