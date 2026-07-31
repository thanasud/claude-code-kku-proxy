# Claude Code Local Proxy (for KKU Intelsphere & Custom APIs)

A small local proxy that sits between [Claude Code](https://github.com/anthropics/claude-code) and a custom Anthropic-compatible API gateway (**KKU Intelsphere**), fixing a bug where switching models via the `/model` command in the terminal crashes with an error.

## The Problem

Some API gateways (for example, calling `deepseek-v4-pro`) always respond with an **SSE (Server-Sent Events) stream**, even when Claude Code sends a non-streaming request — which is exactly what it does when checking a model before switching to it. Claude Code expects a single flat JSON object in that case, so receiving raw SSE text instead causes it to fail with an error.

## How This Proxy Fixes It

- **Normal chat requests (streaming requested):** the proxy passes the response straight through with no delay or buffering.
- **Model-switch requests (non-streaming requested, but the gateway replies with SSE anyway):** the proxy buffers the entire SSE stream, reassembles it into a standard JSON response, and returns that to Claude Code — allowing model switching to work smoothly.

## Installation & Usage

1. Download or clone this repository.
2. Open a terminal in this folder and run it (requires [Node.js](https://nodejs.org/) to be installed):

   ```bash
   node proxy.mjs
   ```

   The proxy will start on `http://127.0.0.1:4319`.

3. In another terminal window, start `claude` as usual.
4. Point Claude Code at the proxy by running:

   ```
   /config set ANTHROPIC_BASE_URL http://127.0.0.1:4319
   ```

That's it — Claude Code will now route all requests through the proxy, and model switching will work correctly.

## 🔁 Run on Startup (optional)

If you don't want to manually start the proxy every time you reboot, use the included setup scripts. They auto-detect the correct paths — no editing required.

**Windows** — double-click `setup-autostart.bat`. It registers a hidden background task that starts the proxy automatically at every login (no terminal window). To remove it later, double-click `uninstall-autostart.bat`.

**macOS** — run:

```bash
./setup-autostart.sh
```

This installs a `launchd` agent that starts the proxy automatically at login and restarts it if it ever crashes. Logs are written to `/tmp/claudeproxy.log` and `/tmp/claudeproxy.err`. To remove it later, run:

```bash
./uninstall-autostart.sh
```

## ⚙️ Advanced Configuration (Environment Variables)

You can customize the proxy's behavior with the following environment variables before running it:

| Variable | Description | Default |
|---|---|---|
| `PROXY_PORT` | Local port the proxy listens on | `4319` |
| `UPSTREAM_BASE_URL` | Base URL of the upstream API gateway | `https://gen.ai.kku.ac.th/api` |

Example:

```bash
PROXY_PORT=8080 UPSTREAM_BASE_URL=https://api.yourdomain.com node proxy.mjs
```

## License

See [LICENSE](./LICENSE).
