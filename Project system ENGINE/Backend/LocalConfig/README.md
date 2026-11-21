# ResQTrack Backend LocalConfig Directory

This tracked folder is bind-mounted into the `resqtrack-backend` Docker container
at `/app/LocalConfig` (read-only).

## Why this directory is tracked

Docker Desktop on Windows, macOS, and Linux automatically creates an empty
directory on the host whenever `docker-compose.yml` bind-mounts a single file
that does not yet exist on a freshly cloned repository. Mounting the tracked
`LocalConfig/` directory instead prevents `UnauthorizedAccessException` /
`EISDIR` crashes when `.NET ConfigurationBuilder` loads optional local JSON
overrides.

## Usage on a Fresh PC / Laptop

1. Recommended: copy the root `.env.example` to `.env` and populate
   `ANTHROPIC_API_KEY` and `ROBOFLOW_API_KEY`.
2. Optional JSON override: copy `appsettings.Local.example.json` in this
   folder to `appsettings.Local.json` (which is gitignored) and fill in only
   the keys you want to override for local non-Docker or Docker runs.
3. Never commit `appsettings.Local.json` or `.env` with real API keys.
