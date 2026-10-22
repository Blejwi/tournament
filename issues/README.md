# Issues

This folder is the project's issue tracker. One Markdown file per issue.

- **File name:** `NNNN-short-slug.md`, numbered in creation order (`0001-…`, `0002-…`).
- **Frontmatter:** every issue starts with

  ```yaml
  ---
  id: 1
  title: Short title
  status: open        # open | in-progress | done | wontfix
  labels: [ready-for-agent]
  created: 2026-10-22
  ---
  ```

- **Triage labels:**
  - `needs-triage`: not yet reviewed
  - `needs-info`: blocked on a question to the user
  - `ready-for-agent`: fully specified, an agent can pick it up
  - `ready-for-human`: needs a person (decision, hardware, credentials)
- **Closing:** set `status: done` and add a short `## Resolution` section linking the commits.
- **Links:** reference other issues as `#NNNN` (e.g. `#0001`).
