# R+ Windows installer exit codes (NSIS)

Silent install: `R+-x.x.x-x64.exe /S`

| Code | Meaning |
|------|---------|
| 0 | Installation completed successfully |
| 1 | Installation cancelled by user |
| 2 | Installation aborted by script (error: disk full, files in use, extract failure, etc.) |

R+ uses electron-builder NSIS (per-user). Reboot is not required.
Upgrading an existing installation returns 0 on success.
No network connection is required to install.
