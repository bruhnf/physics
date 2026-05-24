# Physics — Project Root

## What This Project Is

"Physics" is a multi-level S.T.E.M. focused game designed to teach individuals the concepts surrounding matter, energy, and the fundamental forces of the universe. The game does this by guiding the "player" through 'Levels of the game which are labeled as "physics experiments". The player must pass the current "Physics Experiment" in order to progress to the next level. Each Physics experiment is a puzzle that is focused on a single concept of Physics. The puzzles are a combination of graphics, animation and user interactive dynamic controls that allow the player to adjust components to the problem, numbers, and/or variables in order to solve the current Physics puzzle. This allows the player to visualize the concept being taught by being able to interact with the game. Each level gets increasingly more difficult. For instance, a simple level of the game could be a puzzle on speed and distance. The game allows the player to adjust different conditions of the environment to see how it affects the speed of an object. And not just here on Earth but in space as well. Another example - a player is given the task to launch a rocket into space. The player is given some information about the rocket but then given some dynamic variables that they must calculate the proper valuse in order for the rocket to achieve orbit. I want you to review Physics text books and find other experiments that would fit into this game concept and include any you feel would work for the player. 

Keep in mind this is the basic concept of the game. But I want you to expand on this concept as creatively and technically as possible. My goal is to end up with a playable game that is both entertaining and educational. 



## Folder Structure

```
E:\Projects\Physics\                  ← YOU ARE HERE (project root)
│
├── CLAUDE.md                         ← This file. Project-level context.
├── notes/                            ← Planning notes, ideas, brainstorms
├── scratch/                          ← Temporary test files, experiments
├── assets/                           ← Potential images, icons, design mockups
├── docs/                             ← Documentation, specs, research
│   ├── architecture/                 ← System design documents
│   ├── api/                          ← API documentation
│   ├── legal/                        ← Regulatory notes, disclaimers, terms
│   └── product/                      ← PRDs, feature specs, user stories
│
└── PhysicsApp/                       ← ALL source code lives here. See its own CLAUDE.md.
    ├── backend/
    ├── frontend/
    └── website/
```

## Rules for This Root Folder

- **DO NOT** place source code, config files, package.json, or any build artifacts here
- This folder is for reference materials, planning, documentation, and project-level context only
- All code goes in `./PhysicsApp/` — no exceptions
- Cowork: when generating documentation, save outputs to `./docs/` with appropriate subfolder
- Cowork: when reviewing code, read from `./PhysicsApp/` but write review notes to `./docs/`

## Tool Attribution (Claude Code + Claude Cowork)

Both Claude Code and Claude Cowork write to the same purpose-based folder structure
(`docs/`, `notes/`, `PhysicsApp/`, etc.). Attribution lives in git, not in folder layout.

**Commit convention:** add the originating tool as a conventional-commit scope.

- `feat(cowork): add orbital-mechanics level spec`
- `docs(code): document /api/v1/levels response shape`
- `refactor(code): extract score calculation`
- `chore(cowork): research candidate physics experiments`

When a commit substantively combines work from both tools, use `(both)` and mention
specifics in the body. Plain conventional commits without a scope (`feat:`, `fix:`)
are reserved for human-authored changes.

Rationale: a single source of truth organized by *purpose* scales; attribution by
*author* doesn't. Git already tracks who wrote what — the scope makes it visible in
`git log --oneline` without forking the folder layout.

## Keeping CLAUDE.md Files Current (Standing Instruction for Claude Code)

This project is developed using two AI tools — Claude Code (VSCode) and Claude Cowork — that share this repo. The CLAUDE.md files are the single source of truth that both tools read. **Claude Code must keep them up to date automatically** — no reminder needed from Bruhn.

**Update the relevant CLAUDE.md whenever you:**
- Introduce a new library, package, or external service
- Make an architectural decision (file structure, data flow, pattern choice)
- Establish a new coding convention or deviate from an existing one
- Add a new API route shape, Prisma model, or significant data structure
- Resolve a meaningful trade-off (and why you resolved it the way you did)
- Discover that something documented here is wrong or outdated — fix it on the spot

**Which file to update:**
- Decisions affecting the whole project → `E:\Projects\Physics\CLAUDE.md`
- Decisions affecting the codebase (stack, conventions, patterns) → `E:\Projects\Physics\PhysicsApp\CLAUDE.md`
- Both files reference each other — keep them consistent

**How to update:** Edit the file in the same commit as the code change that prompted it. Use `docs(code):` as the commit scope per the convention above. Keep entries concise — a sentence or two is enough for most decisions. The goal is that any future session (by either tool) can read the CLAUDE.md and immediately understand why things are the way they are.

## Developer Profile

- Familiar with the tech stack listed in PhysicsApp/CLAUDE.md but actively improving
- Prefers clear explanations when introducing new patterns or architectural decisions
- Wants to be presented with options and trade-offs rather than silent decisions
- Working solo — code clarity and self-documenting patterns matter more than speed
