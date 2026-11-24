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
   - Part by part: work in drafts, and repeat a loop in which the user checks
     how each part is displayed. Put the final artifact in build.
   - Auto (make it all the way through at once): use drafts as your work
     area, at your own discretion.

If something unexpected happens along the way, stop, explain the current
state, and ask the user to decide.
