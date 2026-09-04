# OpenX Agent Portal

OpenX Agent Portal is a local management studio for connected AI agents. It pairs a Next.js Portal with a TypeScript Gateway and optional Python agent worker.

It lets operators register agents, inspect skills and usage, and follow safe task telemetry and working-log updates. XRPL RLUSD analytics remain an on-demand, separate view.

## Run locally

Requirements: Node.js 18+ and npm. Python 3.11+ is needed only for the optional agent worker.

Install dependencies and start the Gateway and Portal in separate terminals:

```bash
npm --prefix gateway install
npm --prefix portal install
npm --prefix gateway run dev
```

```bash
npm --prefix portal run dev
```

Open the Portal at http://localhost:3010. The Gateway health endpoint is http://localhost:7411/health.

To run the example connected agent, copy its environment template, store `OPENX_AGENT_KEY` only in your local secret manager, then run:

```bash
cd agent
python3 main.py
```

`./start.sh` is an alternative production-style launcher: it installs missing dependencies, builds both services, and replaces processes already using ports 3010 and 7411.

## Checks

```bash
npm --prefix gateway test
npm --prefix gateway run build
npm --prefix portal run typecheck
```
