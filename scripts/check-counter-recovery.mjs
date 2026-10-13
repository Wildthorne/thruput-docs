// Run after prepare-counter-guide.mjs and dependency installation in the extracted app.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const app = process.argv[2];
if (!app) throw new Error('Usage: node scripts/check-counter-recovery.mjs EXTRACTED_APP');
const parent = pathToFileURL(resolve(app, 'package.json')).href;
const require = createRequire(parent);
const { tsImport } = await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
const sdk = await tsImport('@thruputchain/client', parent);
const { ERC20 } = await tsImport('@thruputchain/client/contracts', parent);
const { MockTransport } = await tsImport('@thruputchain/client/transport', parent);
const { archiveExpiredUpdate } = await tsImport(pathToFileURL(resolve(app, 'src/updates.ts')).href, parent);
const client = await sdk.createThruputClient({
  cluster: sdk.defineCluster({ networkHash: sdk.networkHash(sdk.hashFromHex(`0x${'00'.repeat(32)}`)), capabilities: [] }),
  transport: new MockTransport(),
});
const signer = new sdk.PrivateKeySigner(new Uint8Array(32).fill(1));
const account = sdk.createPubkeyAccount({ signer });
const wallet = sdk.createWalletClient({ client, account });
const tx = await wallet.prepareExecution({
  invocation: ERC20.v0_1.transfer.invocation(account.address, sdk.gasAmount(500_000n), { receiver: account.address, amount: 1n }),
  gasLimit: sdk.gasAmount(1_000_000n),
});
const signed = await sdk.signTransaction(tx, [{ signer, publicKeyId: 0n }], client.network.networkHash);
const record = { hash: sdk.toHex0x(sdk.hashSignedTransaction(signed)),
  signedTransaction: sdk.toHex0x(sdk.serializeSignedTransaction(signed)),
  account: sdk.toHex0x(account.address), networkId: sdk.toHex0x(client.network.networkHash) };
const expiry = tx.uniquifier.block_expiry_height;
const key = 'counter:test';
const saved = new Map([[key, JSON.stringify(record)]]);
const storage = { setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
const expired = { ...client, getChainTip: async () => ({ height: expiry }), getTransactionReceipt: async () => null };

await assert.rejects(archiveExpiredUpdate({ ...expired, getChainTip: async () => ({ height: expiry - 1n }) }, record, key, storage), /not expired/);
await assert.rejects(archiveExpiredUpdate(expired, { ...record, networkId: 'wrong' }, key, storage), /original network/);
await assert.rejects(archiveExpiredUpdate(expired, { ...record, hash: 'wrong' }, key, storage), /does not match/);
await assert.rejects(archiveExpiredUpdate({ ...expired, getTransactionReceipt: async () => ({}) }, record, key, storage), /receipt is available/);
await assert.rejects(archiveExpiredUpdate({ ...expired, getTransactionReceipt: async () => { throw new Error('RPC unavailable'); } }, record, key, storage), /RPC unavailable/);
await assert.rejects(archiveExpiredUpdate(expired, record, key, { ...storage, setItem: () => { throw new Error('storage full'); } }), /storage full/);
assert.deepEqual([...saved.keys()], [key], 'Failed recovery must preserve the active record');
await archiveExpiredUpdate(expired, record, key, storage);
assert.equal(saved.has(key), false);
assert.deepEqual(JSON.parse(saved.get(`${key}:archived:${record.hash}`)), {
  ...record, outcome: 'unresolved', archivedAtHeight: expiry.toString(),
});
console.log('Counter recovery passed: expiry boundary, original network/hash, receipt/RPC guards, persistence failure, and evidence-preserving archival.');
