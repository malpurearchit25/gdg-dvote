import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, Clock3, Copy, FileText, Fingerprint, Globe2, Layers3, LayoutDashboard, Link2, LoaderCircle, Menu, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users, Vote, Wallet, X, ExternalLink, AlertCircle, Activity, BookOpen, LogOut } from 'lucide-react';
import { connectWallet, readProposals, submit, switchNetwork, watchChanges, friendlyError, contractAddress, chainId, rpcUrl } from './services/blockchain';
import { DEMO_ACCOUNT, loadDemo, saveDemo, resetDemo } from './services/demo';

const short = address => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected';
const number = value => value.toLocaleString();
const date = value => new Date(value * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const bytes = value => new TextEncoder().encode(value).length;
function remaining(deadline, now) {
  const s = deadline - now;
  if (s <= 0) return 'Voting ended';
  if (s < 3600) return `${Math.max(1, Math.ceil(s / 60))}m left`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m left`;
  return `${Math.floor(s / 86400)}d ${Math.floor(s % 86400 / 3600)}h left`;
}

function Modal({ title, subtitle, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handler = event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const elements = ref.current?.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]');
      if (!elements?.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [onClose, busy]);
  return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="modal-heading"><div><span className="eyebrow">YOUR COMMUNITY. YOUR CALL.</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={20}/></button></div>{children}</section></div>;
}

function ResultBars({ p }) {
  const total = p.yesVotes + p.noVotes;
  const yes = total ? Math.round(p.yesVotes / total * 100) : 0;
  return <div className="results"><div className="result-labels"><span><i className="dot yes"/>Yes <strong>{yes}%</strong></span><span>No <strong>{total ? 100 - yes : 0}%</strong><i className="dot no"/></span></div><div className="result-track" role="img" aria-label={`${p.yesVotes} yes votes, ${p.noVotes} no votes`}><span style={{ width: `${total ? yes : 0}%` }}/></div><div className="result-counts"><span>{number(p.yesVotes)} votes</span><span>{number(p.noVotes)} votes</span></div></div>;
}

function ProposalCard({ p, now, onOpen }) {
  const active = p.deadline > now;
  return <article className="proposal-card"><div className="card-top"><span className={`badge ${active ? 'active' : 'closed'}`}><i/>{active ? 'Active' : 'Closed'}</span><span className="proposal-id">#{String(p.id + 1).padStart(3, '0')}</span></div><button className="card-title" onClick={() => onOpen(p.id)}><h3>{p.title}</h3><ArrowUpRight size={19}/></button><p className="card-description">{p.description}</p><div className="card-creator"><span className="avatar">{p.creator.slice(2, 4).toUpperCase()}</span><span>by <span title={p.creator}>{short(p.creator)}</span></span>{p.voted && <span className="voted"><Check size={12}/>You voted</span>}</div><ResultBars p={p}/><div className="card-footer"><span><Clock3 size={14}/>{remaining(p.deadline, now)}</span><button onClick={() => onOpen(p.id)}>{active ? (p.voted ? 'View vote' : 'Cast your vote') : 'View results'}<ArrowRight size={15}/></button></div></article>;
}

export default function App() {
  const [mode, setMode] = useState('demo');
  const [demo, setDemo] = useState(loadDemo);
  const [live, setLive] = useState([]);
  const [account, setAccount] = useState('');
  const [network, setNetwork] = useState(null);
  const [demoConnected, setDemoConnected] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [filter, setFilter] = useState('All proposals');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [modal, setModal] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tx, setTx] = useState(null);
  const [lastHash, setLastHash] = useState('');
  const [block, setBlock] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [chainClock, setChainClock] = useState(null);
  const [choice, setChoice] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', duration: '4320' });
  const [formError, setFormError] = useState('');
  const epoch = useRef(0);
  const loadingRef = useRef(false);
  const readSequence = useRef(0);
  const connected = mode === 'demo' ? (demoConnected ? DEMO_ACCOUNT : '') : account;
  const proposals = mode === 'demo' ? demo : live;
  const now = mode === 'blockchain' && chainClock ? Math.max(Math.floor(clock / 1000), chainClock.timestamp + Math.floor((clock - chainClock.at) / 1000)) : Math.floor(clock / 1000);
  const busy = Boolean(tx);
  const wrongNetwork = mode === 'blockchain' && account && network !== chainId;

  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);
  const refresh = useCallback(async (force = false) => {
    if (mode !== 'blockchain' || (loadingRef.current && force !== true)) return;
    const version = epoch.current;
    const sequence = ++readSequence.current;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await readProposals(account);
      if (version === epoch.current && sequence === readSequence.current) { setLive(data.proposals); setBlock(data.blockNumber); setChainClock({ timestamp: data.blockTime, at: Date.now() }); setError(''); }
    } catch (err) { if (version === epoch.current && sequence === readSequence.current) setError(friendlyError(err)); }
    finally { if (version === epoch.current && sequence === readSequence.current) { loadingRef.current = false; setLoading(false); } }
  }, [mode, account]);
  useEffect(() => {
    epoch.current++;
    loadingRef.current = false;
    setLoading(false);
    setLive([]);
    setChainClock(null);
    if (mode !== 'blockchain') return;
    refresh();
    const timer = setInterval(refresh, 12000);
    const stop = watchChanges(refresh);
    return () => { epoch.current++; clearInterval(timer); stop(); };
  }, [refresh, mode]);
  useEffect(() => {
    if (!window.ethereum?.on) return;
    const accountsChanged = accounts => { setAccount(accounts[0] || ''); setNotice('Wallet account updated.'); };
    const chainChanged = id => setNetwork(Number(id));
    window.ethereum.on('accountsChanged', accountsChanged);
    window.ethereum.on('chainChanged', chainChanged);
    return () => { window.ethereum.removeListener('accountsChanged', accountsChanged); window.ethereum.removeListener('chainChanged', chainChanged); };
  }, []);

  async function connect() {
    if (mode === 'demo') { setDemoConnected(true); setNotice('Demo wallet connected. Actions are saved only in this browser.'); return; }
    setConnecting(true); setError('');
    try { const wallet = await connectWallet(); setAccount(wallet.account); setNetwork(wallet.network); }
    catch (err) { const message = friendlyError(err); if (modal) setFormError(message); else setError(message); }
    finally { setConnecting(false); }
  }
  function changeMode(value) {
    setMode(value); setModal(null); setError(''); setNotice(''); setLastHash('');
  }
  const closeModal = useCallback(() => { setModal(null); setChoice(null); setFormError(''); }, []);
  function openProposal(id) { setChoice(null); setFormError(''); setModal({ type: 'proposal', id }); }
  async function transact(action, args, updateDemo) {
    setFormError(''); setError('');
    if (!connected) { await connect(); return; }
    if (wrongNetwork) { setFormError(`Switch your wallet to chain ${chainId} before continuing.`); return; }
    const transactionEpoch = epoch.current;
    setTx({ stage: mode === 'demo' ? 'Saving demo action…' : 'Approve the transaction in your wallet', hash: '' });
    try {
      if (mode === 'demo') {
        const next = updateDemo(demo);
        saveDemo(next); setDemo(next);
      } else {
        const hash = await submit(action, args, connected, hash => setTx({ stage: 'Transaction submitted. Waiting for confirmation…', hash }));
        setLastHash(hash);
        if (transactionEpoch === epoch.current) await refresh(true);
      }
      closeModal(); setNotice(mode === 'demo' ? 'Saved in demo mode. No blockchain transaction was sent.' : 'Transaction confirmed on the local blockchain.');
    } catch (err) { setFormError(friendlyError(err)); }
    finally { setTx(null); }
  }
  function create(event) {
    event.preventDefault();
    const title = form.title.trim(), description = form.description.trim(), duration = Number(form.duration) * 60;
    if (!title || bytes(title) > 120 || !description || bytes(description) > 2000 || duration < 60 || duration > 2592000) { setFormError('Add a title (up to 120 bytes), description (up to 2,000 bytes), and a duration from 1 minute to 30 days.'); return; }
    transact('createProposal', [title, description, duration], current => [{ id: current.length ? Math.max(...current.map(p => p.id)) + 1 : 0, title, description, creator: DEMO_ACCOUNT, deadline: Math.floor(Date.now() / 1000) + duration, yesVotes: 0, noVotes: 0, voted: false }, ...current]);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setNotice('Copied to clipboard.'); } catch { setError('Clipboard access is unavailable. Select and copy the address manually.'); }
  }
  const active = proposals.filter(p => p.deadline > now).length;
  const totalVotes = proposals.reduce((sum, p) => sum + p.yesVotes + p.noVotes, 0);
  const myVotes = connected ? proposals.filter(p => p.voted).length : 0;
  const visible = proposals.filter(p => {
    if (page === 'activity' && (!connected || !(p.voted || p.creator.toLowerCase() === connected.toLowerCase()))) return false;
    if (filter === 'Active' && p.deadline <= now || filter === 'Closed' && p.deadline > now || filter === 'Voted' && (!connected || !p.voted)) return false;
    return `${p.title} ${p.description}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => sort === 'popular' ? b.yesVotes + b.noVotes - a.yesVotes - a.noVotes : sort === 'ending' ? a.deadline - b.deadline : b.id - a.id);
  const selected = modal?.type === 'proposal' ? proposals.find(p => p.id === modal.id) : null;
  const canVote = selected && selected.deadline > now && !selected.voted;
  function navigate(next) { setPage(next); setFilter('All proposals'); setSearch(''); setMobileNav(false); }

  return <div className="app-shell">
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}><a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('dashboard'); }}><span className="brand-mark"><Vote size={25}/></span>dVote<span className="brand-dot">.</span></a><span className="sidebar-label">WORKSPACE</span><nav><button className={page === 'dashboard' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('dashboard')}><LayoutDashboard size={19}/>Overview<span className="nav-count">{proposals.length}</span></button><button className={page === 'activity' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('activity')}><Activity size={19}/>My activity</button><button className={page === 'guide' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('guide')}><BookOpen size={19}/>How it works<ArrowUpRight size={15} className="nav-external"/></button></nav><div className="sidebar-note"><div className="note-icon"><ShieldCheck size={22}/></div><h4>Built on trust.<br/>Verified by everyone.</h4><p>Every decision is recorded.<br/>Every voice counts.</p><button onClick={() => navigate('guide')}>Explore dVote<ArrowUpRight size={14}/></button></div><div className="sidebar-bottom"><span className="network-led"/> {mode === 'demo' ? 'Interactive demo' : 'Hardhat Local'}<button aria-label="Open network settings" onClick={() => setModal({ type: 'network' })}><SlidersHorizontal size={16}/></button></div><span className="version">dVote protocol · v1.0</span></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{page === 'dashboard' ? 'Overview' : page === 'activity' ? 'My activity' : 'How it works'}</strong></div><div className="header-actions"><button className="network-pill" onClick={() => setModal({ type: 'network' })}><span className="network-led"/>{mode === 'demo' ? 'Demo mode' : 'Local network'}<ChevronDown size={13}/></button><button className="wallet-button" disabled={connecting || busy} onClick={() => connected ? setModal({ type: 'wallet' }) : connect()}>{connecting ? <LoaderCircle size={16} className="spin"/> : <Wallet size={16}/>}<span>{connected ? short(connected) : 'Connect wallet'}</span>{connected && <i className="wallet-connected"/>}</button></div></header>
      <main><div className="mode-banner"><span><span className="small-caps">{mode === 'demo' ? 'DEMO WORKSPACE' : 'ON-CHAIN WORKSPACE'}</span>{mode === 'demo' ? 'Explore freely. Demo votes stay in this browser.' : `Ethereum-compatible · Chain ${chainId} · ${block === null ? 'Waiting for node' : `Block ${number(block)}`}`}</span><button onClick={() => mode === 'demo' ? changeMode('blockchain') : setModal({ type: 'network' })}>{mode === 'demo' ? 'Use blockchain' : 'Network settings'}<ArrowUpRight size={13}/></button></div>
      {error && <div className="alert" role="alert"><AlertCircle size={18}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
      {wrongNetwork && <div className="alert" role="alert"><AlertCircle size={18}/><span>Your wallet is on chain {network}. Switch to Hardhat Local to vote.</span><button onClick={() => switchNetwork().catch(err => setError(friendlyError(err)))}>Switch network</button></div>}
      {page === 'guide' ? <div className="guide"><span className="eyebrow">A LITTLE LESS TRUST. A LOT MORE TRANSPARENCY.</span><h1>Decisions, made together.</h1><p className="guide-intro">dVote puts community proposals and votes on an Ethereum-compatible blockchain. Anyone can inspect the rules and results.</p><div className="steps">{[[Wallet, '01', 'Connect your wallet', 'Your wallet is your account. In blockchain mode, use a local development wallet on Hardhat chain 31337. Private keys stay in your wallet.'], [FileText, '02', 'Put an idea forward', 'Create a proposal with a clear title, a description, and a voting window from one minute to 30 days. Anyone can propose.'], [Vote, '03', 'Make your voice count', 'Choose Yes or No and approve the transaction. Each wallet can vote once per proposal, before its deadline.'], [ShieldCheck, '04', 'Verify the outcome', 'View live totals or inspect the Solidity contract, transaction receipt, and VoteCast events. The chain enforces the final deadline.']].map(([Icon, n, title, description]) => <article key={n}><div className="step-top"><Icon size={25}/><span>{n}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div><div className="guide-details"><h3>Designed for learning and open governance</h3><p>One wallet is not one person: someone with several wallets can vote several times. Wallet addresses and voting choices are public, so this is not a secret ballot system. This prototype is not audited and is not suitable for binding public elections.</p><p>Demo mode uses sample data and browser storage. Blockchain mode reads a real local contract; transactions require local test ETH for gas. Results show the simple Yes/No majority, with no quorum requirement.</p><button className="primary-button" onClick={() => navigate('dashboard')}>Explore proposals<ArrowRight size={16}/></button></div></div> : <>
        <section className="hero"><div className="hero-content"><span className="hero-kicker"><span/>DECENTRALIZED DECISIONS. SHARED FUTURES.</span><h1>{page === 'activity' ? <>Your voice.<br/><em>Your impact.</em></> : <>A voice in every<br/><em>decision.</em></>}</h1><p>{page === 'activity' ? 'The proposals you’ve created and the decisions you’ve helped shape, all in one place.' : 'Turn ideas into collective action. Propose, vote, and shape what comes next — transparently, together.'}</p><button className="hero-button" onClick={() => { setForm({ title: '', description: '', duration: '4320' }); setModal({ type: 'create' }); }}><Plus size={17}/>Create a proposal<ArrowUpRight size={16}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="floating-chip chip-top"><ShieldCheck size={17}/><span>Verifiable by design</span></div><div className="ballot"><div className="ballot-paper"><Check size={43} strokeWidth={2.5}/></div><div className="ballot-top"/><div className="ballot-face"><Vote size={45} strokeWidth={1.3}/></div><div className="ballot-side"/></div><div className="floating-chip chip-bottom"><i/>Your vote. On record.</div><span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span></div></section>
        <section className="stats" aria-label="Voting statistics">{[[Layers3, 'Total proposals', proposals.length, 'Ideas put forward'], [Clock3, 'Active now', active, 'Ready for your voice'], [Users, 'Total votes cast', totalVotes, mode === 'demo' ? 'Sample community votes' : 'Recorded on-chain'], [Fingerprint, 'Your votes', myVotes, connected ? 'Decisions you helped shape' : 'Connect to participate']].map(([Icon, label, value, hint]) => <article key={label}><div className="stat-heading"><span>{label}</span><Icon size={17}/></div><strong>{number(value)}</strong><span className="stat-hint">{hint}</span></article>)}</section>
        <section className="proposals-section"><div className="section-heading"><div><div className="title-row"><h2>{page === 'activity' ? 'Your participation' : 'Community proposals'}</h2><span className="count-badge">{page === 'activity' ? visible.length : proposals.length}</span></div><p>{page === 'activity' ? 'Your created proposals and submitted votes.' : 'Big ideas start here. Be part of what happens next.'}</p></div><button className="refresh-button" disabled={loading} onClick={() => mode === 'demo' ? setNotice('Demo data is up to date.') : refresh()}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>Refresh</span></button></div><div className="proposal-toolbar"><div className="tabs" role="group" aria-label="Filter proposals">{['All proposals', 'Active', 'Closed', 'Voted'].map(item => <button key={item} className={filter === item ? 'current' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}{item === 'Active' && <i/>}</button>)}</div><div className="search-sort"><label className="search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search proposals…" aria-label="Search proposals"/></label><label className="sort"><SlidersHorizontal size={15}/><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort proposals"><option value="newest">Newest</option><option value="popular">Most votes</option><option value="ending">Deadline</option></select></label></div></div>
        {loading && !proposals.length ? <div className="empty"><LoaderCircle className="spin"/><h3>Reading the blockchain…</h3></div> : visible.length ? <div className="proposal-grid">{visible.map(p => <ProposalCard key={p.id} p={{ ...p, voted: Boolean(connected && p.voted) }} now={now} onOpen={openProposal}/>)}</div> : <div className="empty"><FileText size={32}/><h3>{page === 'activity' && !connected ? 'Your story starts with a wallet' : 'No proposals here yet'}</h3><p>{search ? 'Try a different search or filter.' : page === 'activity' ? 'Connect and participate in a proposal to see it here.' : mode === 'blockchain' ? 'Start the local node and deploy the contract, then create your first proposal.' : 'Be the first to put an idea forward.'}</p>{!connected ? <button className="primary-button" onClick={connect}>Connect wallet<Wallet size={16}/></button> : <button className="primary-button" onClick={() => setModal({ type: 'create' })}>Create a proposal<Plus size={16}/></button>}</div>}
        <div className="trust-strip"><ShieldCheck size={16}/><span>{mode === 'demo' ? 'Sample data for exploration' : 'Rules enforced by the smart contract'}<i/>One vote per wallet<i/>Public, verifiable results</span><button onClick={() => navigate('guide')}>Learn more<ArrowUpRight size={13}/></button></div></section>
      </>}
      <footer><span className="footer-brand">dVote<span>.</span></span><span>Collective decisions. Lasting impact.</span><span className="footer-right">Built for the community<Globe2 size={13}/></span></footer></main>
    </div>
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15}/></button></div>}
    {modal?.type === 'create' && <Modal title="Put your idea forward" subtitle="A clear proposal is the start of a better decision." onClose={closeModal} busy={busy}><form onSubmit={create}><label className="field">Proposal title<input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What should we decide together?" required/><span className={bytes(form.title) > 120 ? 'invalid' : ''}>{bytes(form.title)} / 120 bytes</span></label><label className="field">Description<textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Share the context, the idea, and what a Yes vote means." required/><span className={bytes(form.description) > 2000 ? 'invalid' : ''}>{bytes(form.description)} / 2,000 bytes</span></label><label className="field">Voting duration<select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}><option value="1">1 minute · quick local test</option><option value="60">1 hour</option><option value="1440">1 day</option><option value="4320">3 days</option><option value="10080">7 days</option><option value="43200">30 days</option></select></label><div className="info-note"><ShieldCheck size={16}/>{mode === 'demo' ? 'This proposal will be saved in this browser only.' : 'Proposal contents are public and permanent. Your wallet will request approval and a gas fee in local test ETH.'}</div>{formError && <p className="form-error" role="alert">{formError}</p>}{tx && <div className="transaction-status" role="status"><LoaderCircle className="spin" size={18}/><div>{tx.stage}{tx.hash && <code>{tx.hash}</code>}</div></div>}<button className="primary-button full" type="submit" disabled={busy || connecting}>{busy ? 'Processing…' : connected ? 'Create proposal' : 'Connect wallet to continue'}<ArrowRight size={16}/></button></form></Modal>}
    {selected && <Modal title={selected.title} subtitle={`Proposal #${String(selected.id + 1).padStart(3, '0')}`} onClose={closeModal} busy={busy}><div className="detail-meta"><span className={`badge ${selected.deadline > now ? 'active' : 'closed'}`}><i/>{selected.deadline > now ? 'Active' : 'Closed'}</span><span><Clock3 size={14}/>{remaining(selected.deadline, now)}</span></div><p className="proposal-body">{selected.description}</p><dl className="detail-facts"><div><dt>Proposed by</dt><dd title={selected.creator}>{short(selected.creator)}<button aria-label="Copy creator address" onClick={() => copy(selected.creator)}><Copy size={13}/></button></dd></div><div><dt>Voting deadline</dt><dd>{date(selected.deadline)}</dd></div><div><dt>Total votes</dt><dd>{number(selected.yesVotes + selected.noVotes)}</dd></div></dl><ResultBars p={selected}/>{canVote ? <><h3 className="vote-heading">Where do you stand?</h3><div className="vote-options"><button className={choice === true ? 'chosen' : ''} onClick={() => setChoice(true)} disabled={busy}><CheckCircle2 size={19}/><span>Yes, I support this</span>{choice === true && <Check size={15}/>}</button><button className={choice === false ? 'chosen no-choice' : ''} onClick={() => setChoice(false)} disabled={busy}><X size={19}/><span>No, I don’t support this</span>{choice === false && <Check size={15}/>}</button></div><p className="vote-note">One vote per wallet. Your choice cannot be changed after submission.</p></> : <div className="outcome"><CheckCheck size={19}/><span>{selected.voted && selected.deadline > now ? 'Your wallet has already voted. Thanks for participating.' : selected.yesVotes + selected.noVotes === 0 ? 'Voting closed with no votes.' : selected.yesVotes === selected.noVotes ? 'Voting closed with a tie.' : `Voting closed. ${selected.yesVotes > selected.noVotes ? 'Yes' : 'No'} received the most votes.`}</span></div>}{formError && <p className="form-error" role="alert">{formError}</p>}{tx && <div className="transaction-status" role="status"><LoaderCircle className="spin" size={18}/><div>{tx.stage}{tx.hash && <code>{tx.hash}</code>}</div></div>}{canVote && <button className="primary-button full" disabled={busy || (connected && choice === null)} onClick={() => { if (!connected) { connect(); return; } transact('vote', [selected.id, choice], current => current.map(p => { if (p.id !== selected.id) return p; if (p.voted) throw new Error('This demo wallet has already voted.'); if (p.deadline <= Date.now() / 1000) throw new Error('Voting is closed.'); return { ...p, voted: true, yesVotes: p.yesVotes + (choice ? 1 : 0), noVotes: p.noVotes + (choice ? 0 : 1) }; })); }}>{busy ? 'Processing…' : connected ? 'Submit your vote' : 'Connect wallet to vote'}<ArrowRight size={16}/></button>}</Modal>}
    {modal?.type === 'network' && <Modal title="Choose your workspace" subtitle="Explore the demo or interact with the local blockchain." onClose={closeModal}><button className={`mode-option ${mode === 'demo' ? 'chosen' : ''}`} onClick={() => changeMode('demo')}><Sparkles size={23}/><div><strong>Interactive demo</strong><p>Sample proposals. Browser storage. No wallet extension needed.</p></div>{mode === 'demo' && <Check size={18}/>}</button><button className={`mode-option ${mode === 'blockchain' ? 'chosen' : ''}`} onClick={() => changeMode('blockchain')}><Link2 size={23}/><div><strong>Local blockchain</strong><p>Real contract calls and wallet-approved transactions.</p></div>{mode === 'blockchain' && <Check size={18}/>}</button><div className="network-details"><h3>Local network details</h3><p>Chain ID <strong>{chainId}</strong></p><p>RPC <code>{rpcUrl}</code></p><p>Contract <code>{contractAddress || 'Not deployed yet'}</code></p><p>Start the node, run deploy, and reload the app. See the README for wallet setup.</p></div>{mode === 'demo' && <button className="text-button" onClick={() => setModal({ type: 'reset' })}><RefreshCw size={14}/>Reset demo data</button>}</Modal>}
    {modal?.type === 'wallet' && <Modal title={mode === 'demo' ? 'Demo wallet' : 'Your wallet'} subtitle={mode === 'demo' ? 'A simulated account for exploring this application.' : 'Your keys remain in your wallet extension.'} onClose={closeModal}><div className="wallet-address"><Wallet size={24}/><code>{connected}</code><button className="icon-button" aria-label="Copy wallet address" onClick={() => copy(connected)}><Copy size={17}/></button></div><p className="wallet-note">{mode === 'demo' ? 'Demo actions are stored on this device. The sample community vote counts are fictional.' : `Selected wallet chain: ${network}. Required chain: ${chainId}. Local test ETH has no monetary value.`}</p>{lastHash && <div className="network-details"><h3>Last confirmed transaction</h3><code>{lastHash}</code><button className="text-button" onClick={() => copy(lastHash)}>Copy transaction hash<Copy size={14}/></button></div>}<button className="secondary-button full" onClick={() => { if (mode === 'demo') setDemoConnected(false); else setAccount(''); closeModal(); }}><LogOut size={16}/>Disconnect from app</button><p className="vote-note">Disconnecting hides the account here. Manage site permissions in your wallet extension.</p></Modal>}
    {modal?.type === 'reset' && <Modal title="Reset the demo?" subtitle="This clears your browser’s demo proposals and votes, then restores the sample data." onClose={closeModal}><button className="primary-button full" onClick={() => { try { const initial = resetDemo(); saveDemo(initial); setDemo(initial); closeModal(); setNotice('Demo data reset.'); } catch { setError('Browser storage is unavailable.'); } }}>Reset demo data<RefreshCw size={16}/></button></Modal>}
  </div>;
}
