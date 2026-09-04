# WorktreeWise Application Instructions

Follow the workspace instructions in `../AGENTS.md`.

## Architecture and Implementation

- `src/main`: Electron lifecycle, native capabilities, Git/filesystem/process integrations, and IPC handlers.
- `src/renderer`: React UI, feature state, dialogs, navigation, and user interactions.
- `src/shared` and `src/types`: contracts shared across process boundaries.
- Keep privileged Node and filesystem operations out of renderer code. Expose the smallest necessary typed API through the existing preload/IPC pattern.
- Reuse established services, hooks, stores, components, styling, and error-handling conventions before introducing abstractions.
- Keep Git commands scoped to the selected repository/worktree and handle paths safely across Windows, macOS, and Linux.
- Preserve backward-compatible persisted settings or provide a migration/default when their shape changes.
- Do not alter authentication, licensing, repository-opening behavior, packaging, or update behavior unless the task explicitly requires it.

## Feature Work

For implementation work, read `../.codex/skills/worktreewise-feature-development/SKILL.md`.

- Trace a feature end-to-end: renderer entry point, state, typed bridge, main handler/service, and completion/error feedback.
- Validate user input before invoking Git or filesystem operations.
- Keep long-running work asynchronous and expose meaningful loading, empty, success, and error states.
- Add or update focused tests where the repository has an established test seam.
- Prefer accessibility-friendly labels and stable test IDs for controls that require automation.
- Verify with targeted tests first, then lint/build in proportion to the change.

## Screenshot Source of Truth

- Inspect application source before automating or describing a feature.
- Capture the real Electron application after the main UI and feature-specific data have fully loaded.
- Store canonical images in `poc/screenshots` using ordered, descriptive filenames.
- Prefer accessible roles, names, labels, and existing test IDs in Playwright. Avoid brittle CSS selectors.
- Keep automation repeatable and scoped to deterministic demo data.

## Capture Quality

- Hide the Git Log Author column before capture and verify no names remain visible.
- Use realistic, meaningful values in forms and dialogs.
- For asynchronous screens, wait for real content instead of loading labels, spinners, or skeletons.
- For sparse checkout, wait for folders to load and select one or two representative folders.
- Ensure drawers and sidebars are fully visible within the viewport.
- Do not open native dialogs. Stop before actions that would open one.
- Do not confirm rename, move, delete, lock, prune, repair, or similar actions when the purpose is documentation capture only.
- Skip Clear Cache in Settings.
- Do not record video or GIF unless explicitly requested.

After approval, synchronize captures according to `../.codex/skills/worktreewise-release-capture/SKILL.md`.
