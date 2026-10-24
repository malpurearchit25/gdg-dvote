async function main() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(1000) });
      const data = await response.json();
      if (data.result === '0x7a69') { console.log('Hardhat Local RPC is ready.'); return; }
    } catch { /* The child node is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local RPC did not become available on chain 31337.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
