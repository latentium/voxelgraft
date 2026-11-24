---
name: voxelgraft
description: Builds and checks voxel 3D assets written in the VoxelGraft JSON DSL, and
  exports an HTML file for a human to review. Use when the user asks to create, edit,
  check, or build a voxel asset, or mentions VoxelGraft.
allowed-tools: Bash(voxelgraft help)
---

!`voxelgraft help`

Agents other than Claude Code do not support the notation on the line above.
In Claude Code, if the help content is shown, go to S5.
If the help content is not shown, start from S1.

- S1: Ask the user whether you may search for the location and run a
  command to show the help.
- S2: Search for the executable bin/voxelgraft in these places:
  1. the path where the voxelgraft Skills exist, if the agent can tell you
  2. the Skills folder of the agent you are using now
  3. the current directory
- S3: If it does not exist, ask the user what to do.
- S4: If you find the executable, run `voxelgraft help`.
- S5: Briefly show the user what this tool can do, and ask how they want
  to proceed.

## When the user asks you to make a 3D asset

- S6: Ask the user what they want to make, and whether to make it in
  All-at-once mode or Part-by-part mode. If you get no answer, use
  All-at-once mode.
- S7: If the following directories are not found, ask the user where to
  work.

  ```
  .voxelgraft/
  |-- drafts/
  `-- build/
  ```

- S8: Explain the steps for making the asset, organizing the flow up to
  the final artifact. Explain that these are the planned steps before the
  work starts. Show the paths of the directories you will use, and explain
  how you will use them.
- S9: When the user agrees, start making the 3D asset.
  - Part-by-part: work in `drafts/`, and repeat a loop in which the user
    checks how each part is displayed. Put the final artifact in `build/`.
  - All-at-once (make it all the way through at once): use `drafts/` as
    your work area, at your own discretion. Put the final artifact in
    `build/`.

If something unexpected happens along the way, stop, explain the current
state, and ask the user to decide.

## Mechanism for making a 3D asset

This section explains what to display during S6 to S9.

- Show the Phase Indicator from S6 until the task is complete.
- In S6, check only the box for ASKING, and show the ASKING Checklist.
- Fill in each item of the ASKING Checklist based on your dialogue with
  the user. If an item has no default value, do not fill it in with your
  own guess; use what the user says as the source.
- When every item of the ASKING Checklist is filled in, check the box for
  PLANNED and ask the user to approve the task plan (ask whether to proceed
  with this plan, or whether there is anything to change).
- If there is something to change, go back to ASKING and ask the user what
  to change.
- When the user approves the task plan you presented in PLANNED, check
  the box for STARTED and start making the 3D asset.
- While making the 3D asset, hide the ASKING Checklist. Instead, show the
  Task Progress Checklist (generated automatically from S8).

## Notes on the display

### Phase Indicator

    [ ] ASKING -> [ ] PLANNED -> [ ] STARTED

Check the boxes of the phases one by one.
Do not start making the 3D asset before STARTED.

### ASKING Checklist

When the content of an item is decided, check its box and replace the item
label with a concrete description.

- [ ] What to make
- [ ] Mode: Part-by-part / All-at-once (default)
- [ ] Directories: the ones explained in S8 (default)
- [ ] Task end condition: the final artifact of what to make is complete (default)
- [ ] Planned steps: a summary of what was explained in S8 (default)

### Task Progress Checklist

Generate it automatically from S8. Any display format is fine.

## Notes on everything

S1 to S9 are identifiers of sequential steps.

For steps other than making a 3D asset, the user's instructions take
priority.
