export const DEMO_ACCOUNT = '0xdE00000000000000000000000000000000000De01';
const KEY = 'dvote-demo-v1';
const creator = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
function seed() {
  const now = Math.floor(Date.now() / 1000);
  return [
    { id: 0, title: 'Fund the next community hackathon', description: 'Let’s bring our community together for a weekend of building. This proposal allocates resources for a student-led hackathon, including mentorship, venue support, and prizes for open-source projects.', deadline: now + 2 * 86400 + 5 * 3600, yesVotes: 128, noVotes: 24, creator },
    { id: 1, title: 'Launch a Web3 learning circle', description: 'Create a weekly space to learn Solidity, explore smart contract security, and build decentralized applications together. Sessions will be open to all skill levels.', deadline: now + 4 * 86400, yesVotes: 86, noVotes: 12, creator },
    { id: 2, title: 'Introduce monthly project showcases', description: 'A monthly stage for the things we’re building. Members can demo projects, exchange feedback, and discover their next collaborators.', deadline: now + 6 * 86400, yesVotes: 64, noVotes: 31, creator },
    { id: 3, title: 'Make our resources open source', description: 'Publish our workshop materials, starter projects, and learning guides in a public repository so everyone can learn and contribute.', deadline: now - 86400, yesVotes: 184, noVotes: 16, creator },
    { id: 4, title: 'Host a design × development meetup', description: 'Bring designers and developers into the same room for an evening of practical workshops and collaborative prototyping.', deadline: now - 3 * 86400, yesVotes: 71, noVotes: 83, creator },
  ].map(p => ({ ...p, voted: false }));
}
export function loadDemo() {
  try { const data = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(data) && data.every(p => typeof p.title === 'string' && Number.isFinite(p.deadline))) return data; } catch { /* Storage may be unavailable. */ }
  return seed();
}
export function saveDemo(proposals) { localStorage.setItem(KEY, JSON.stringify(proposals)); }
export function resetDemo() { localStorage.removeItem(KEY); return seed(); }
