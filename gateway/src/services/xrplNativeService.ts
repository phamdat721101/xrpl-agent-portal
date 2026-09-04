import { createHash, randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

export type RlusdSnapshot = { ledger_index: number; ledger_hash: string | null; evaluated_at: string; verified: boolean; supply: { circulating: string | null; issuer: string | null }; movement: { amm: unknown; orderbook: unknown; settlements_24h: number }; trustlines: { lines: number | null }; source_errors: string[] };
const rpcUrl = () => process.env.XRPL_RPC_URL || 'https://s.altnet.rippletest.net:51234';
const issuer = () => process.env.OPENX_RLUSD_ISSUER || null;
const currency = () => process.env.OPENX_RLUSD_CURRENCY || 'RLUSD';
const now = () => new Date().toISOString();
const id = () => randomUUID();

async function rpc(method: string, params: Record<string, unknown>[]) {
  const response = await fetch(rpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params }), signal: AbortSignal.timeout(5_000) });
  const body = await response.json() as { result?: Record<string, any>; error?: { message?: string } | string };
  if (!response.ok || body.error || !body.result) throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || `xrpl_rpc_${response.status}`);
  return body.result;
}

export class XrplNativeService {
  public async refreshAnalytics(): Promise<RlusdSnapshot> {
    const targetIssuer = issuer();
    if (!targetIssuer) throw new Error('rlusd_issuer_not_configured');
    const errors: string[] = [];
    const [server, balances, amm, offers, lines] = await Promise.all([
      rpc('server_info', []).catch((e) => { errors.push(`server_info:${e.message}`); return null; }),
      rpc('gateway_balances', [{ account: targetIssuer, ledger_index: 'validated', strict: true }]).catch((e) => { errors.push(`gateway_balances:${e.message}`); return null; }),
      rpc('amm_info', [{ asset: { currency: 'XRP' }, asset2: { currency: currency(), issuer: targetIssuer } }]).catch((e) => { errors.push(`amm_info:${e.message}`); return null; }),
      rpc('book_offers', [{ taker_gets: { currency: currency(), issuer: targetIssuer }, taker_pays: { currency: 'XRP' }, limit: 50, ledger_index: 'validated' }]).catch((e) => { errors.push(`book_offers:${e.message}`); return null; }),
      rpc('account_lines', [{ account: targetIssuer, ledger_index: 'validated', limit: 400 }]).catch((e) => { errors.push(`account_lines:${e.message}`); return null; }),
    ]);
    if (errors.length || !server || !balances || !amm || !offers || !lines) throw new Error(errors.join('|') || 'xrpl_snapshot_incomplete');
    const ledger = server.info?.validated_ledger || {};
    const obligations = balances.obligations || {};
    const snapshot: RlusdSnapshot = { ledger_index: Number(ledger.seq || 0), ledger_hash: typeof ledger.hash === 'string' ? ledger.hash : null, evaluated_at: now(), verified: true, supply: { circulating: typeof obligations[currency()] === 'string' ? obligations[currency()] : null, issuer: targetIssuer }, movement: { amm: amm.amm || amm, orderbook: offers.offers || [], settlements_24h: 0 }, trustlines: { lines: Array.isArray(lines.lines) ? lines.lines.length : null }, source_errors: [] };
    gatewayDatabase.raw().prepare('INSERT INTO xrpl_ledger_snapshots(id, ledger_index, ledger_hash, payload, source_errors, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id(), snapshot.ledger_index, snapshot.ledger_hash, JSON.stringify(snapshot), '[]', snapshot.evaluated_at);
    return snapshot;
  }
  public latestSnapshot(): RlusdSnapshot | null { const row = gatewayDatabase.raw().prepare('SELECT payload FROM xrpl_ledger_snapshots ORDER BY created_at DESC LIMIT 1').get() as { payload?: string } | undefined; try { return row?.payload ? JSON.parse(row.payload) as RlusdSnapshot : null; } catch { return null; } }
  public snapshotHash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
  public createProfile(agentId: string, profileId: string, address: string | null, limits = { daily: '100', perTx: '5' }) { const timestamp = now(); gatewayDatabase.raw().prepare('INSERT INTO xrpl_wallet_profiles(agent_id, profile_id, address, network, daily_limit_rlusd, per_tx_limit_rlusd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(agent_id) DO UPDATE SET profile_id=excluded.profile_id,address=excluded.address,updated_at=excluded.updated_at').run(agentId, profileId, address, 'xrpl-testnet', limits.daily, limits.perTx, timestamp, timestamp); return this.profile(agentId); }
  public profile(agentId: string) { return gatewayDatabase.raw().prepare('SELECT agent_id, profile_id, address, network, daily_limit_rlusd, per_tx_limit_rlusd, updated_at FROM xrpl_wallet_profiles WHERE agent_id = ?').get(agentId) || null; }
  public recordOperation(agentId: string, kind: string, status: string, detail: unknown, amount?: string, hash?: string) { const operation = { id: id(), agent_id: agentId, kind, status, amount_rlusd: amount || null, transaction_hash: hash || null, detail, created_at: now() }; gatewayDatabase.raw().prepare('INSERT INTO xrpl_wallet_operations(id, agent_id, kind, status, amount_rlusd, transaction_hash, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(operation.id, agentId, kind, status, operation.amount_rlusd, operation.transaction_hash, JSON.stringify(detail), operation.created_at); return operation; }
  public publishPolicy(agentId: string, rules: unknown) { const current = gatewayDatabase.raw().prepare('SELECT MAX(version) AS version FROM xrpl_routing_policies WHERE agent_id = ?').get(agentId) as { version?: number }; const policy = { id: id(), agent_id: agentId, version: (current.version || 0) + 1, rules, status: 'published', created_at: now() }; gatewayDatabase.raw().prepare('INSERT INTO xrpl_routing_policies(id, agent_id, version, rules, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(policy.id, agentId, policy.version, JSON.stringify(rules), policy.status, policy.created_at); return policy; }
  public latestPolicy(agentId: string) { const row = gatewayDatabase.raw().prepare('SELECT * FROM xrpl_routing_policies WHERE agent_id = ? ORDER BY version DESC LIMIT 1').get(agentId) as any; return row ? { ...row, rules: JSON.parse(row.rules), acknowledged: Boolean(gatewayDatabase.raw().prepare('SELECT 1 FROM xrpl_routing_policy_acks WHERE policy_id = ? AND agent_id = ?').get(row.id, agentId)) } : null; }
  public acknowledgePolicy(agentId: string, policyId: string) { gatewayDatabase.raw().prepare('INSERT OR REPLACE INTO xrpl_routing_policy_acks(policy_id, agent_id, applied_at) VALUES (?, ?, ?)').run(policyId, agentId, now()); return this.latestPolicy(agentId); }
}
export const xrplNativeService = new XrplNativeService();
