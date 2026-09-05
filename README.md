# OpenX Agent Portal

OpenX Agent Portal is an AI-native management studio and operator control plane for autonomous AI agents, pairing an Express Gateway sidecar (`:7411`), a Next.js Operator Portal (`:3010`), and an autonomous agent worker.

## Portal Management Functions

- **Manage & Track Working Tasks:** Real-time visibility into agent task execution, progressive phases, working logs, and cryptographic artifact delivery.
- **Credit, Quota & Usage Metering:** Transparent tracking of per-agent token consumption, model pricing tiers, quota policies, and credit allocations.
- **Dream-Cycle & REM Cognitive Lessons:** Extract, replay, and retain strategic lessons learned from the agent's REM reflection loops for recursive self-improvement.
- **Pay-to-Use via XRPL Settlement & T54:** Auditable, on-chain micropayment settlement on the XRP Ledger (RLUSD) with T54 routing policies and wallet safety limits.

## AI-Native Architecture & Code Structure

```text
xrpl-openx-portal/
├── agent/                  # Autonomous Agent Runtime
│   ├── main.py             # Agent execution entrypoint & task loops
│   ├── sync_agent.py       # Telemetry, heartbeats & working-log sync
│   └── gateway_client.py   # Gateway client (tasks, telemetry, settlements)
├── gateway/                # Control Plane Sidecar (:7411)
│   ├── src/server.ts       # REST & telemetry endpoints
│   ├── src/db/             # Embedded SQLite schema & task/settlement ledgers
│   └── src/services/       # Agent registry, XRPL native settlement, dream gateway
├── portal/                 # Operator Studio (:3010)
│   ├── src/app/            # Next.js App Router (Studio hub, agent tabs, docs)
│   ├── src/components/     # Dashboards (Dream-Cycle, Tasks, Skills, Wallet)
│   └── src/lib/            # Portal context, auth & gateway RPC client
├── docs/                   # System maps, architectural specs & PRDs
└── .nim/                   # Reliability harness: lessons store & delivery contracts
```

## Run Locally

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

- Portal: http://localhost:3010
- Gateway health: http://localhost:7411/health

To run the example connected agent, copy its environment template, set `OPENX_AGENT_KEY`, and run:

```bash
cd agent
python3 main.py
```

*Alternative launcher:* `./start.sh` installs missing dependencies, builds both services, and replaces processes on ports 3010 and 7411.

## Checks

```bash
npm --prefix gateway test
npm --prefix gateway run build
npm --prefix portal run typecheck
```
