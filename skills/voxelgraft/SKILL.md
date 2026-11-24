---
name: voxelgraft
description: Builds and checks voxel 3D assets written in the VoxelGraft JSON DSL, and
  exports an HTML file for a human to review. Use when the user asks to create, edit,
  check, or build a voxel asset, or mentions VoxelGraft.
allowed-tools: Bash(voxelgraft help)
---

!`voxelgraft help`

Agents other than Claude Code do not support the notation on the line above.
In Claude Code, if the help content is shown, go to step 5.
If the help content is not shown, start from step 1.

1. Ask the user whether you may search for the location and run a command
   to show the help.
2. Search for the executable bin/voxelgraft in these places:
   1. the path where the voxelgraft Skills exist, if the agent can tell you
   2. the Skills folder of the agent you are using now
   3. the current directory
3. If it does not exist, ask the user what to do.
4. If you find the executable, run voxelgraft help.
5. Briefly show the user what this tool can do, and ask how they want to
   proceed.

## When the user asks you to make a 3D asset

6. Ask the user what they want to make, and whether to make it in auto mode
   or part by part. If you get no answer, use auto mode.
7. If the following directories are not found, ask the user where to work.

   ```
   .voxelgraft/
   |-- drafts/
   `-- build/
   ```

8. Explain the steps for making the asset, organizing the flow up to the
   final artifact. Explain that these are the planned steps before the work
   starts. Show the paths of the directories you will use, and explain how
   you will use them.
9. When the user agrees, start making the 3D asset.
   - Part by part: work in `drafts/`, and repeat a loop in which the user
     checks how each part is displayed. Put the final artifact in `build/`.
   - Auto (make it all the way through at once): use `drafts/` as your work
     area, at your own discretion. Put the final artifact in `build/`.

If something unexpected happens along the way, stop, explain the current
state, and ask the user to decide.

## Mechanism for making a 3D asset

This section explains what to display during steps 6 to 9.

- Show the phase indicator from step 6 until the task is complete.
- In step 6, check only ASKING, and show the ASKING checklist.
- Fill in each item of the ASKING checklist based on your dialogue with
  the user. If an item has no default value, do not fill it in with your
  own guess; use what the user says as the source.
- When every item of the ASKING checklist is filled in, check PLANNED and
  ask the user to approve the task plan (ask whether to proceed with this
  plan, or whether there is anything to change).
- If there is something to change, go back to ASKING and ask the user what
  to change.
- When the user approves the task plan you presented in PLANNED, check
  STARTED and start making the 3D asset.
- While making the 3D asset, hide the ASKING checklist. Instead, show the
  task progress checklist (generated automatically from step 8).

## Notes on the display

### Phase indicator

    [ ] ASKING -> [ ] PLANNED -> [ ] STARTED

Check the phases one by one.
Do not start making the 3D asset before STARTED.

### ASKING checklist

When the content of an item is decided, check it and replace the item
label with a concrete description.

- [ ] What to make
- [ ] Mode: Part by part / Auto (default)
- [ ] Directories: the ones explained in step 8 (default)
- [ ] Task end condition: the final artifact of what to make is complete (default)
- [ ] Planned steps: a summary of what was explained in step 8 (default)

### Task progress checklist

Generate it automatically from step 8. Any display format is fine.

## Notes on everything

For steps other than making a 3D asset, the user's instructions take
priority.
