'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  ExternalLink,
  Filter,
  Globe2,
  LayoutDashboard,
  ListFilter,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'

const leads = [
  { id: '1', name: 'Northstar Architecture', domain: 'northstararch.com', city: 'Austin', country: 'US', category: 'Architecture', rating: '4.8', reviews: '126', website: 'Live', verify: 'Verified', discovered: 'Today, 09:42', initials: 'NA' },
  { id: '2', name: 'Morrow & Finch Studio', domain: 'morrowfinch.co', city: 'Portland', country: 'US', category: 'Interior Design', rating: '4.6', reviews: '84', website: 'Live', verify: 'Issues detected', discovered: 'Today, 09:38', initials: 'MF' },
  { id: '3', name: 'Fieldwork Landscapes', domain: 'fieldworklandscapes.com', city: 'Denver', country: 'US', category: 'Landscaping', rating: '4.9', reviews: '203', website: 'Live', verify: 'Not verified', discovered: 'Yesterday, 16:21', initials: 'FL' },
  { id: '4', name: 'Cedar & Stone Builders', domain: 'cedarstonebuild.com', city: 'Nashville', country: 'US', category: 'Construction', rating: '4.7', reviews: '67', website: 'Live', verify: 'Verified', discovered: 'Yesterday, 14:08', initials: 'CS' },
  { id: '5', name: 'Atelier Forty Two', domain: 'atelier42.design', city: 'Chicago', country: 'US', category: 'Design Studio', rating: '4.5', reviews: '41', website: 'Unavailable', verify: 'Verification failed', discovered: 'Oct 07, 11:03', initials: 'AF' },
  { id: '6', name: 'Greenline Dental Care', domain: 'greenlinedental.com', city: 'Seattle', country: 'US', category: 'Healthcare', rating: '4.8', reviews: '318', website: 'Live', verify: 'Issues detected', discovered: 'Oct 06, 08:54', initials: 'GD' },
]

const jobs = [
  { type: 'Website verification', target: 'Morrow & Finch Studio', status: 'Running', progress: '64%', time: '2m ago', icon: ShieldCheck },
  { type: 'Lead discovery', target: 'Architecture · Austin, US', status: 'Completed', progress: '248 leads', time: 'Today, 09:42', icon: Sparkles },
  { type: 'Batch verification', target: '42 selected leads', status: 'Completed', progress: '42 / 42', time: 'Yesterday, 16:24', icon: Zap },
  { type: 'Lead discovery', target: 'Interior design · Portland, US', status: 'Failed', progress: 'API timeout', time: 'Oct 07, 14:20', icon: Sparkles },
]

const checks = [
  ['Availability', 'HTTP 200 · 842ms', 'good'],
  ['Mobile Responsiveness', 'Horizontal overflow detected', 'warn'],
  ['Performance', '1.8s TTFB · 2.4MB', 'warn'],
  ['HTTP Caching', 'Cache-Control not detected', 'warn'],
  ['Technical SEO', 'Meta description missing', 'warn'],
  ['Accessibility', '3 images missing alt text', 'warn'],
  ['Conversion / UX Signals', 'Contact link detected', 'good'],
]

function Status({ value }: { value: string }) {
  const cls = value === 'Verified' || value === 'Completed' || value === 'Live' ? 'status status-good' : value === 'Running' ? 'status status-running' : value === 'Failed' || value === 'Verification failed' ? 'status status-bad' : value === 'Issues detected' ? 'status status-warn' : 'status status-muted'
  return <span className={cls}><span className="status-dot" />{value}</span>
}

function Sidebar({ active, onNavigate, open, onClose }: { active: string; onNavigate: (item: string) => void; open: boolean; onClose: () => void }) {
  const items = [
    ['Dashboard', LayoutDashboard], ['Lead Explorer', BriefcaseBusiness], ['Discover Leads', Sparkles], ['Verification Jobs', ShieldCheck], ['Recent Activity', Activity], ['Settings', Settings],
  ] as const
  return <>
    {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark">C</div><div><strong>CLDS</strong><span>Lead intelligence</span></div><button className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation"><X /></button></div>
      <nav className="nav-list" aria-label="Main navigation">
        <div className="nav-label">Workspace</div>
        {items.slice(0, 4).map(([label, Icon]) => <button key={label} className={`nav-item ${active === label ? 'nav-active' : ''}`} onClick={() => { onNavigate(label); onClose() }}><Icon /><span>{label}</span>{label === 'Verification Jobs' && <em>3</em>}</button>)}
        <div className="nav-label nav-label-spaced">System</div>
        {items.slice(4).map(([label, Icon]) => <button key={label} className={`nav-item ${active === label ? 'nav-active' : ''}`} onClick={() => { onNavigate(label); onClose() }}><Icon /><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="system-title"><span>System status</span><span className="live-pill"><i />Operational</span></div><div className="system-row"><Database /><span>Database</span><CheckCircle2 /></div><div className="system-row"><Globe2 /><span>Application</span><CheckCircle2 /></div><div className="user-card"><div className="avatar">AD</div><div><strong>Aditya Sharma</strong><span>Personal workspace</span></div><MoreHorizontal /></div></div>
    </aside>
  </>
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Database }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><Icon /></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>
}

function Dashboard({ onNavigate, onSelectLead }: { onNavigate: (item: string) => void; onSelectLead: (id: string) => void }) {
  return <div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">Wednesday, October 9, 2026</p><h1>Lead Intelligence</h1><p className="subtitle">Discover businesses. Identify opportunities.</p></div><button className="primary-button" onClick={() => onNavigate('Discover Leads')}><Plus /> Discover leads</button></div>
    <div className="metrics"><Metric label="Total leads" value="1,284" detail="+86 this month" icon={BriefcaseBusiness} /><Metric label="With websites" value="1,046" detail="81.5% of leads" icon={Globe2} /><Metric label="Verified websites" value="762" detail="72.8% of websites" icon={ShieldCheck} /><Metric label="Active jobs" value="3" detail="2 verification · 1 discovery" icon={Activity} /></div>
    <div className="section-grid"><section className="panel jobs-panel"><div className="panel-heading"><div><h2>Recent jobs</h2><p>Monitor discovery and verification activity</p></div><button className="text-button" onClick={() => onNavigate('Verification Jobs')}>View all <ArrowUpRight /></button></div><div className="job-list">{jobs.map((job) => { const Icon = job.icon; return <div className="job-row" key={job.target}><div className="job-icon"><Icon /></div><div className="job-main"><strong>{job.type}</strong><span>{job.target}</span></div><div className="job-progress"><Status value={job.status} /><span>{job.progress}</span></div><time>{job.time}</time><button className="icon-button"><MoreHorizontal /></button></div> })}</div></section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common prospecting workflows</p></div></div><button className="action-card" onClick={() => onNavigate('Discover Leads')}><span className="action-icon"><Sparkles /></span><span><strong>Discover new leads</strong><small>Search Google Maps for businesses</small></span><ArrowUpRight /></button><button className="action-card"><span className="action-icon"><ShieldCheck /></span><span><strong>Verify websites</strong><small>Run checks on selected leads</small></span><ArrowUpRight /></button><button className="action-card" onClick={() => onNavigate('Lead Explorer')}><span className="action-icon"><ListFilter /></span><span><strong>Explore all leads</strong><small>Search and filter your database</small></span><ArrowUpRight /></button></section></div>
    <section className="panel leads-panel"><div className="panel-heading"><div><h2>Recently discovered leads</h2><p>Latest businesses added to your workspace</p></div><button className="text-button" onClick={() => onNavigate('Lead Explorer')}>Explore leads <ArrowUpRight /></button></div><LeadTable rows={leads.slice(0, 4)} onSelectLead={onSelectLead} /></section>
  </div>
}

function LeadTable({ rows, onSelectLead }: { rows: typeof leads; onSelectLead: (id: string) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Business</th><th>Location</th><th>Category</th><th>Rating / reviews</th><th>Website</th><th>Verification</th><th>Discovered</th></tr></thead><tbody>{rows.map((lead) => <tr key={lead.id} onClick={() => onSelectLead(lead.id)}><td><div className="business-cell"><div className="business-avatar">{lead.initials}</div><div><strong>{lead.name}</strong><span>{lead.domain}</span></div></div></td><td>{lead.city}, {lead.country}</td><td>{lead.category}</td><td><span className="rating">★ {lead.rating}</span> <span className="muted">({lead.reviews})</span></td><td><a href={`https://${lead.domain}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{lead.domain}<ExternalLink /></a><small className="website-state"><i />{lead.website}</small></td><td><Status value={lead.verify} /></td><td className="muted">{lead.discovered}</td></tr>)}</tbody></table></div>
}

function Explorer({ onSelectLead }: { onSelectLead: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All statuses')
  const filtered = useMemo(() => leads.filter((lead) => `${lead.name} ${lead.domain} ${lead.city}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All statuses' || lead.verify === filter)), [query, filter])
  return <div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">Workspace / Leads</p><h1>Lead Explorer</h1><p className="subtitle">1,284 businesses in your database</p></div><button className="primary-button"><ShieldCheck /> Verify selected</button></div><div className="explorer-toolbar"><div className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search business, website, or location" /><kbd>⌘ K</kbd></div><select aria-label="Verification status" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All statuses</option><option>Verified</option><option>Issues detected</option><option>Not verified</option><option>Verification failed</option></select><button className="filter-button"><Filter /> Filters <span>2</span></button><button className="icon-button bordered"><RefreshCw /></button></div><div className="filter-line"><span><Filter /> Active filters:</span><button>Country: United States <X /></button><button>Has website <X /></button><button className="clear-button" onClick={() => { setFilter('All statuses'); setQuery('') }}>Clear all</button></div><section className="panel explorer-panel"><div className="table-meta"><span><strong>{filtered.length}</strong> of 1,284 leads</span><div><span>Rows per page</span><select aria-label="Rows per page"><option>25</option></select></div></div>{filtered.length ? <LeadTable rows={filtered} onSelectLead={onSelectLead} /> : <div className="empty"><Search /><strong>No leads found</strong><span>Try adjusting your search or filters.</span></div>}<div className="pagination"><span>Showing 1–{filtered.length} of 1,284</span><div><button className="icon-button bordered" aria-label="Previous page"><ChevronLeft /></button><button className="page-current">1</button><button>2</button><button>3</button><span>…</span><button>52</button><button className="icon-button bordered" aria-label="Next page"><ChevronRight /></button></div></div></section></div>
}

function LeadDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const lead = leads.find((item) => item.id === id) ?? leads[0]
  return <div className="content-wrap detail-wrap"><button className="back-button" onClick={onBack}><ChevronLeft /> Back to leads</button><div className="detail-header"><div className="detail-identity"><div className="detail-avatar">{lead.initials}</div><div><p className="eyebrow">Architecture · Austin, US</p><h1>{lead.name}</h1><div className="detail-inline"><a href={`https://${lead.domain}`} target="_blank" rel="noreferrer">{lead.domain} <ExternalLink /></a><Status value="Live" /><span className="rating">★ {lead.rating}</span><span className="muted">{lead.reviews} reviews</span></div></div></div><button className="secondary-button"><ShieldCheck /> Run verification</button></div><div className="detail-grid"><section className="panel"><div className="panel-heading"><div><h2>Verification overview</h2><p>Latest run · Today at 09:45 · 1.2s duration</p></div><Status value="Issues detected" /></div><div className="check-list">{checks.map(([name, result, state]) => <details className="check-row" key={name}><summary><span className={`check-indicator ${state}`}>{state === 'good' ? <Check /> : <CircleAlert />}</span><strong>{name}</strong><span className="check-result">{result}</span><ChevronDown /></summary><div className="check-detail">Recorded evidence from the latest verification run. Expandable technical findings are preserved from the API response.</div></details>)}</div></section><aside className="detail-side"><section className="panel info-panel"><div className="panel-heading"><div><h2>Business details</h2><p>Discovered from Google Maps</p></div></div><dl><dt>Category</dt><dd>{lead.category}</dd><dt>Phone</dt><dd>+1 (512) 555-0184</dd><dt>Address</dt><dd>1401 E 6th St, Austin, TX</dd><dt>Discovery source</dt><dd>Google Maps</dd></dl></section><section className="panel info-panel"><div className="panel-heading"><div><h2>Verification history</h2><p>3 recorded runs</p></div></div><div className="history"><div><i className="history-good" /><span><strong>Issues detected</strong><small>Today, 09:45 · 1.2s</small></span><ChevronRight /></div><div><i className="history-muted" /><span><strong>Completed</strong><small>Oct 03, 14:22 · 1.0s</small></span><ChevronRight /></div><div><i className="history-muted" /><span><strong>Completed</strong><small>Sep 21, 10:08 · 1.4s</small></span><ChevronRight /></div></div></section></aside></div></div>
}

function Discover({ onNavigate }: { onNavigate: (item: string) => void }) {
  const [started, setStarted] = useState(false)
  return <div className="content-wrap narrow"><div className="page-heading"><div><p className="eyebrow">Workspace / Discovery</p><h1>Discover leads</h1><p className="subtitle">Find real businesses with search criteria that matter.</p></div></div><section className="panel discovery-panel"><div className="discovery-intro"><div className="action-icon large"><Sparkles /></div><div><h2>Start a new discovery</h2><p>Search Google Maps for businesses in a specific category and location. Results will be added to your lead database.</p></div></div><div className="form-grid"><label>Business category<input placeholder="e.g. Architecture, dental clinics" /></label><label>Country<select><option>United States</option><option>Canada</option><option>United Kingdom</option></select></label><label>City<input placeholder="e.g. Austin" /></label><label>Result limit<select><option>100 results</option><option>250 results</option><option>500 results</option></select></label></div><div className="form-footer"><span><Clock3 /> Typical discovery takes 2–5 minutes</span><button className="primary-button" onClick={() => setStarted(true)}><Play /> Start discovery</button></div>{started && <div className="started-state"><span className="spinner" /><div><strong>Discovery job started</strong><span>Job #CLDS-2841 is queued and will appear in Verification Jobs.</span></div><button className="text-button" onClick={() => onNavigate('Verification Jobs')}>View job <ArrowUpRight /></button></div>}</section></div>
}

function Jobs() { return <div className="content-wrap"><div className="page-heading"><div><p className="eyebrow">Workspace / Operations</p><h1>Verification jobs</h1><p className="subtitle">Track discovery and website analysis across your workspace.</p></div><button className="primary-button"><Plus /> New verification</button></div><section className="panel explorer-panel"><div className="table-meta"><span><strong>3 active</strong> · 26 total jobs</span><button className="filter-button"><ListFilter /> Filter</button></div><div className="jobs-table">{jobs.map((job) => { const Icon = job.icon; return <div className="jobs-table-row" key={job.target}><div className="job-icon"><Icon /></div><div className="job-main"><strong>{job.type}</strong><span>{job.target}</span></div><div><Status value={job.status} /></div><div className="job-progress desktop-progress"><span>{job.progress}</span>{job.status === 'Running' && <div className="progress"><i style={{ width: job.progress }} /></div>}</div><time>{job.time}</time><button className="icon-button"><MoreHorizontal /></button></div> })}</div></section></div> }

export default function Page() {
  const [active, setActive] = useState('Dashboard')
  const [selectedLead, setSelectedLead] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = (item: string) => { setSelectedLead(null); setActive(item) }
  let view = active === 'Dashboard' ? <Dashboard onNavigate={navigate} onSelectLead={setSelectedLead} /> : active === 'Lead Explorer' ? <Explorer onSelectLead={setSelectedLead} /> : active === 'Discover Leads' ? <Discover onNavigate={navigate} /> : active === 'Verification Jobs' ? <Jobs /> : <Dashboard onNavigate={navigate} onSelectLead={setSelectedLead} />
  if (selectedLead) view = <LeadDetail id={selectedLead} onBack={() => setSelectedLead(null)} />
  return <div className="app-shell"><Sidebar active={active} onNavigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main"><header className="topbar"><button className="menu-button icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu /></button><div className="topbar-title"><span>CLDS</span><ChevronRight /><strong>{selectedLead ? 'Lead detail' : active}</strong></div><div className="topbar-actions"><div className="global-search"><Search /><span>Search workspace</span><kbd>⌘ K</kbd></div><button className="icon-button"><RefreshCw /></button><div className="top-avatar">AD</div></div></header>{view}</main></div>
}
