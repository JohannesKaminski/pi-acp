# pidea

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![check](https://github.com/JohannesKaminski/pidea/actions/workflows/check.yml/badge.svg)](https://github.com/JohannesKaminski/pidea/actions/workflows/check.yml)

pidea lets you use the [pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) in the AI Chat of JetBrains IDEs such as IntelliJ IDEA. pi can also use the IDE's own tools: search symbols, read and edit files through the editor, run inspections. Other clients that speak the Agent Client Protocol (ACP) work too, with partial coverage.

This project started as a fork of [svkozak/pi-acp](https://github.com/svkozak/pi-acp) (via ryan-brosas/pi-acp-jetbrain) and has since diverged. The original MIT copyright is retained in [LICENSE](LICENSE).

## Requirements

- Node.js 22.19 or newer
- pi 1.0.0 or newer, with a working model: run `pi` once in a terminal to check

## Install

```bash
npm install -g https://github.com/JohannesKaminski/pidea/releases/latest/download/pidea.tgz
pidea setup
```

Then restart the IDE and pick **pidea** in the AI Chat.

The first command installs the latest release (other versions are on the [releases page](https://github.com/JohannesKaminski/pidea/releases)). The second writes the agent entry into `~/.jetbrains/acp.json`; other clients only need `pidea` as their agent command.

If `npm install -g` fails with `EACCES` or wants sudo, don't use sudo. Install Node.js with a version manager such as nvm, or give npm a folder in your home: `npm config set prefix ~/.local` and add `~/.local/bin` to your `PATH` (not on Windows). npm explains both in [resolving EACCES errors](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

## Update

```bash
pidea update
```

Then restart the IDE. `pidea update --check` only shows the installed and the latest version. pidea also tells you in the chat when a new pidea or pi release is out.

## What `pidea setup` does

It adds a `pidea` entry to `~/.jetbrains/acp.json` with absolute paths to `node`, pidea and `pi`, and an explicit `PATH`, so the IDE finds everything no matter how it was started. Your other agents and settings in that file stay as they are, and the original file is saved once as `acp.json.bak`.

Run it again after you switch Node.js versions or move pi. Options: `--dry-run` prints the result without writing it, `--name <entry>` picks another entry name, and `--config <path>` writes to another file.

To write the entry yourself, open the AI Chat menu (upper-right corner), choose **Add Custom Agent**, and use absolute paths from `which pidea`, `which node`, and `which pi` (`where` on Windows, with `;` between `PATH` entries):

```json
{
  "default_mcp_settings": {
    "use_idea_mcp": true,
    "use_custom_mcp": true
  },
  "agent_servers": {
    "pidea": {
      "command": "/path/to/pidea",
      "args": [],
      "env": { "PATH": "/folder/of/node:/folder/of/pi:/usr/local/bin:/usr/bin:/bin" }
    }
  }
}
```

`use_idea_mcp` gives pi the IDE's tools; IntelliJ turns it off by default.

## Using it

Next to the chat input you can change, per session:

| Setting       | What it does                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Model         | Any model pi has available.                                                                                                       |
| Thinking      | The reasoning levels the current model supports.                                                                                  |
| Tool approval | **Off** (default), **Ask for edits & commands**, or **Ask for everything**. You get Allow, Always allow, and Reject.              |
| File access   | **Through the editor** (default): pi sees unsaved changes and its edits land in the editor, where you can undo them. Or **Disk**. |

Selections and files you attach in the editor reach pi with their file and line range. Chats you reopen show their full history. Slash commands include pi's prompts and skills plus `/compact`, `/export`, `/session`, `/name`, `/queue`, `/changelog`, `/steering`, and `/follow-up`.

pi only has read, bash, edit, and write by default. For dedicated search tools, add `"defaultTools": ["+grep", "+find", "+ls"]` to `~/.pi/agent/settings.json`.

## IntelliJ-first mode

With `PIDEA_IDE_MODE` set in the agent entry's `env`, pi works through IntelliJ instead of its own file tools: IntelliJ reads, searches, applies edits, and opens the changed files.

- `off` (default): pi has both its own tools and the IDE's tools.
- `prefer`: pi's file tools are replaced by IntelliJ's while the IDE connection is healthy, and come back if it drops.
- `required`: pi's file tools are always removed; without a healthy IDE connection, the chat says it is blocked.

Bash stays available, so this is a working style, not a sandbox. The [reference](REFERENCE.md#intellij-first-coding-mode) has the details.

## Configuration

Set environment variables in the `env` of the agent entry in `~/.jetbrains/acp.json`. The common ones:

| Variable               | Effect                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `PIDEA_TOOL_APPROVAL`  | Default tool approval for new chats: `off`, `edits`, or `all`. |
| `PIDEA_FILE_ACCESS`    | Default file access: `editor` or `disk`.                       |
| `PIDEA_IDE_MODE`       | IntelliJ-first mode: `off`, `prefer`, or `required`.           |
| `PIDEA_PI_COMMAND`     | Full path to `pi`, if it is not on the `PATH`.                 |
| `PIDEA_UPDATE_CHECK=0` | No update notice in the chat.                                  |
| `PIDEA_DEBUG_ACP=1`    | Log what the IDE sends to `~/.pi/pidea/acp-debug.log`.         |

All variables are listed in the [reference](REFERENCE.md#environment-variables).

## Troubleshooting

- **"ACP process exited unexpectedly. Exit code 127"**: the IDE can't find `node` or `pi`. IDEs started from a desktop launcher, the Dock, or JetBrains Toolbox often don't see the `PATH` from your shell profile. Run `pidea setup` again, or list every needed folder in the entry's `PATH`: it replaces the inherited `PATH`, it doesn't add to it.
- **Changes don't show up**: restart the IDE after editing `acp.json`, and open a new chat after updating pidea or changing IntelliJ's MCP settings. IntelliJ reuses running agent processes.
- **Provider login**: run `pidea --terminal-login`.

## Limitations

- pidea trusts the IDE that starts it: the IDE chooses the working directory and the MCP servers pidea starts. Use it only with IDEs and MCP settings you control, and don't expose it as a service.
- Shell commands run locally, not in the IDE's terminal.
- More protocol details and gaps are in the [reference](REFERENCE.md#protocol-coverage-gaps).

## More

- [REFERENCE.md](REFERENCE.md): how pidea maps ACP to pi, the IDE bridge, all environment variables.
- [CONTRIBUTING.md](CONTRIBUTING.md): running from source, tests, CI, releasing.

## License

MIT. See [LICENSE](LICENSE).
