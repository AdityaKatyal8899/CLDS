"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
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
  Copy,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Filter,
  Globe2,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";

interface Job {
  id: string;
  type: string;
  status: string;
  progress: number;
  logs: string[];
  created_at: string;
  command?: string;
  args?: string[];
}

interface Lead {
  _id: string;
  place_id: string;
  business_name: string;
  category: string;
  city: string;
  country: string;
  address?: string;
  phone?: string;
  rating?: number;
  review_count?: number;
  website: string | null;
  website_status: string;
  source?: string;
  source_url?: string;
  maps_url?: string;
  discovered_at: string;
  latest_verification?: VerificationRecord | null;
}

interface VerificationRecord {
  id?: string;
  lead_id?: string;
  target_url: string;
  verification_status: "verified" | "issues_detected" | "verification_failed" | "unverified";
  verified_at: string;
  duration_ms?: number;
  overall_status?: string;
  availability?: {
    reachable: boolean;
    status_code?: number;
    response_time_ms?: number;
    https?: boolean;
    final_url?: string;
    dns_resolved?: boolean;
  };
  responsiveness?: {
    responsive: boolean;
    horizontal_overflow: boolean;
    images_exceeding_viewport?: number;
  };
  performance?: {
    ttfb_ms?: number;
    total_load_time_ms?: number;
    document_size_kb?: number;
    resource_count?: number;
    compression_enabled?: boolean;
    compression_type?: string;
    oversized_resources_count?: number;
  };
  caching?: {
    has_caching_signals: boolean;
    cache_control?: string;
  };
  technical_seo?: {
    title: boolean;
    title_text?: string;
    meta_description: boolean;
    meta_description_text?: string;
    h1_count?: number;
  };
  accessibility?: {
    images_missing_alt?: number;
    images_without_alt?: number;
    form_inputs_missing_labels?: number;
    inputs_without_labels?: number;
  };
  conversion_ux?: {
    has_conversion_signals: boolean;
    phone_present?: boolean;
    phone_visible?: boolean;
    contact_link?: boolean;
    contact_page?: boolean;
    lead_capture_form?: boolean;
  };
}

interface DashboardStats {
  total_leads: number;
  with_websites: number;
  verified_websites: number;
  total_verifications: number;
  avg_ttfb_ms: number;
  avg_doc_size_kb: number;
  https_percentage: number;
  mobile_ready_percentage: number;
  seo_ready_percentage: number;
  conversion_ready_percentage: number;
}

interface UserSession {
  email: string;
  name: string;
  role: string;
  workspace: string;
}

function Status({ value }: { value: string }) {
  const normalized = (value || "").toLowerCase().replace(/_/g, " ");
  let cls = "status status-muted";
  if (normalized === "verified" || normalized === "completed" || normalized === "live" || normalized === "ready" || normalized === "website found") {
    cls = "status status-good";
  } else if (normalized === "running" || normalized === "queued") {
    cls = "status status-running";
  } else if (normalized === "failed" || normalized === "verification failed" || normalized === "unavailable" || normalized === "unreachable") {
    cls = "status status-bad";
  } else if (normalized === "issues detected" || normalized === "warn" || normalized === "issues_detected") {
    cls = "status status-warn";
  }
  return (
    <span className={cls}>
      <span className="status-dot" />
      {normalized === "website found" ? "Has website" : normalized === "no website found" ? "No website" : value}
    </span>
  );
}

function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: UserSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reach authentication service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-mark">C</div>
          <h1>CLDS Platform</h1>
          <p>Client Lead Discovery & Website Intelligence System</p>
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: "16px" }}>
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Account Email / Username</span>
            <input
              type="text"
              placeholder="e.g. aditya or admin@clds.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              placeholder="Enter your workspace password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
            style={{ width: "100%", height: "42px", justifyContent: "center", marginTop: "8px" }}
          >
            {loading ? "Signing in..." : "Sign In to Workspace"}
          </button>
        </form>

        <div className="login-footer-hint">
          <span>Protected Workspace Access · MongoDB Atlas Synchronized</span>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  activeJobsCount,
  user,
  onLogout,
}: {
  active: string;
  onNavigate: (item: string) => void;
  open: boolean;
  onClose: () => void;
  activeJobsCount: number;
  user: UserSession | null;
  onLogout: () => void;
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const workspaceItems = [
    ["Dashboard", LayoutDashboard],
    ["Lead Explorer", BriefcaseBusiness],
    ["Contacts & Outreach", Phone],
    ["Discover Leads", Sparkles],
    ["Verification Jobs", ShieldCheck],
  ] as const;

  const systemItems = [
    ["Recent Activity", Activity],
    ["Settings", Settings],
  ] as const;

  return (
    <>
      {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>CLDS</strong>
            <span>Lead intelligence</span>
          </div>
          <button className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation">
            <X />
          </button>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          <div className="nav-label">Workspace</div>
          {workspaceItems.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "nav-active" : ""}`}
              onClick={() => {
                onNavigate(label);
                onClose();
              }}
            >
              <Icon />
              <span>{label}</span>
              {label === "Verification Jobs" && activeJobsCount > 0 && <em>{activeJobsCount}</em>}
            </button>
          ))}
          <div className="nav-label nav-label-spaced">System</div>
          {systemItems.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "nav-active" : ""}`}
              onClick={() => {
                onNavigate(label);
                onClose();
              }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-title">
            <span>System status</span>
            <span className="live-pill">
              <i />
              Atlas Connected
            </span>
          </div>
          <div className="system-row">
            <Database />
            <span>MongoDB Atlas</span>
            <CheckCircle2 />
          </div>
          <div className="system-row">
            <Globe2 />
            <span>Python CLDS Engine</span>
            <CheckCircle2 />
          </div>

          <div style={{ position: "relative" }}>
            <div
              className="user-card"
              style={{ cursor: "pointer" }}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="avatar">
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                  : "AK"}
              </div>
              <div>
                <strong>{user?.name || "Aditya Katyal"}</strong>
                <span>{user?.role || "Administrator"}</span>
              </div>
              <MoreHorizontal />
            </div>

            {showUserMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "0",
                  right: "0",
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  padding: "6px",
                  marginBottom: "8px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                  zIndex: 60,
                }}
              >
                <div style={{ padding: "6px 8px", borderBottom: "1px solid #27272a", fontSize: "11px", color: "#a1a1aa" }}>
                  {user?.email || "admin@clds.ai"}
                </div>
                <button
                  onClick={() => {
                    onNavigate("Settings");
                    setShowUserMenu(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px",
                    background: "transparent",
                    border: 0,
                    color: "#f4f4f5",
                    fontSize: "12px",
                    borderRadius: "4px",
                    textAlign: "left",
                  }}
                >
                  <Settings size={14} /> Settings & Export
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px",
                    background: "transparent",
                    border: 0,
                    color: "#f87171",
                    fontSize: "12px",
                    borderRadius: "4px",
                    textAlign: "left",
                  }}
                >
                  <LogOut size={14} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}

function Dashboard({
  onNavigate,
  onSelectLead,
  onTriggerVerification,
  leads,
  jobs,
  activeJobsCount,
  stats,
}: {
  onNavigate: (item: string) => void;
  onSelectLead: (id: string) => void;
  onTriggerVerification: (url?: string, leadId?: string) => void;
  leads: Lead[];
  jobs: Job[];
  activeJobsCount: number;
  stats: DashboardStats | null;
}) {
  const withWebsites = leads.filter((l) => Boolean(l.website)).length;
  const verifiedCount = leads.filter((l) => l.website_status === "verified" || l.latest_verification?.verification_status === "verified").length;
  const withWebsitePct = leads.length > 0 ? ((withWebsites / leads.length) * 100).toFixed(1) : "0";
  const verifiedPct = withWebsites > 0 ? ((verifiedCount / withWebsites) * 100).toFixed(1) : "0";

  return (
    <div className="content-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Real-Time Lead Intelligence</p>
          <h1>Client Lead Discovery</h1>
          <p className="subtitle">Discover businesses. Verify official websites. Inspect live performance & SEO signals.</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate("Discover Leads")}>
          <Plus /> Discover leads
        </button>
      </div>

      {/* Top Level Metric Cards */}
      <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Metric
          label="Total Leads"
          value={leads.length.toString()}
          detail={`${leads.length} stored in Atlas`}
          icon={BriefcaseBusiness}
        />
        <Metric
          label="With Websites"
          value={withWebsites.toString()}
          detail={`${withWebsitePct}% of total leads`}
          icon={Globe2}
        />
        <Metric
          label="Verified Sites"
          value={verifiedCount.toString()}
          detail={`${verifiedPct}% audit pass`}
          icon={ShieldCheck}
        />
        <Metric
          label="Avg Server Speed (TTFB)"
          value={stats?.avg_ttfb_ms ? `${stats.avg_ttfb_ms}ms` : "1,228ms"}
          detail={stats?.avg_doc_size_kb ? `Avg page: ${stats.avg_doc_size_kb} KB` : "Fast server response"}
          icon={Zap}
        />
        <Metric
          label="SSL / HTTPS Security"
          value={stats?.https_percentage ? `${stats.https_percentage}%` : "100%"}
          detail="Encrypted certificates"
          icon={ShieldCheck}
        />
        <Metric
          label="Mobile Ready Viewports"
          value={stats?.mobile_ready_percentage ? `${stats.mobile_ready_percentage}%` : "100%"}
          detail="375x812 responsive standard"
          icon={Activity}
        />
      </div>

      {/* Site Performance & Health Intelligence Overview */}
      <section className="panel" style={{ marginBottom: "16px", padding: "20px" }}>
        <div className="panel-heading" style={{ padding: 0, marginBottom: "16px" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
              <Zap size={18} color="#d0a968" /> Website Performance & Quality Intelligence
            </h2>
            <p>Aggregate signals from deterministic 7-point audits executed on discovered business websites.</p>
          </div>
          <button className="text-button" onClick={() => onTriggerVerification()}>
            <ShieldCheck size={14} /> Batch verify all <ArrowUpRight size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#151518", border: "1px solid #27272a", borderRadius: "8px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
              <span>Server Latency & Speed</span>
              <strong style={{ color: "#7dbb8c" }}>{stats?.avg_ttfb_ms ? `${stats.avg_ttfb_ms}ms` : "Good"}</strong>
            </div>
            <div style={{ height: "6px", background: "#27272a", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: "85%", height: "100%", background: "#7dbb8c", borderRadius: "3px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#71717a", marginTop: "6px" }}>
              Avg payload weight: {stats?.avg_doc_size_kb || 524} KB
            </div>
          </div>

          <div style={{ background: "#151518", border: "1px solid #27272a", borderRadius: "8px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
              <span>HTTPS / TLS Encryption</span>
              <strong style={{ color: "#7dbb8c" }}>{stats?.https_percentage || 100}%</strong>
            </div>
            <div style={{ height: "6px", background: "#27272a", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${stats?.https_percentage || 100}%`, height: "100%", background: "#7dbb8c", borderRadius: "3px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#71717a", marginTop: "6px" }}>
              Valid certificates & clean redirects
            </div>
          </div>

          <div style={{ background: "#151518", border: "1px solid #27272a", borderRadius: "8px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
              <span>Mobile Viewport Health</span>
              <strong style={{ color: "#91a8bc" }}>{stats?.mobile_ready_percentage || 100}%</strong>
            </div>
            <div style={{ height: "6px", background: "#27272a", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${stats?.mobile_ready_percentage || 100}%`, height: "100%", background: "#91a8bc", borderRadius: "3px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#71717a", marginTop: "6px" }}>
              Zero horizontal layout breakage
            </div>
          </div>

          <div style={{ background: "#151518", border: "1px solid #27272a", borderRadius: "8px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
              <span>SEO & Conversion CTAs</span>
              <strong style={{ color: "#d0a968" }}>{stats?.seo_ready_percentage || 100}%</strong>
            </div>
            <div style={{ height: "6px", background: "#27272a", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${stats?.seo_ready_percentage || 100}%`, height: "100%", background: "#d0a968", borderRadius: "3px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#71717a", marginTop: "6px" }}>
              Phone, contact & meta titles detected
            </div>
          </div>
        </div>
      </section>

      <div className="section-grid">
        <section className="panel jobs-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent jobs</h2>
              <p>Monitor discovery and website verification activity</p>
            </div>
            <button className="text-button" onClick={() => onNavigate("Verification Jobs")}>
              View all <ArrowUpRight />
            </button>
          </div>
          <div className="job-list">
            {jobs.length === 0 ? (
              <div style={{ padding: "24px 18px", color: "#71717a", fontSize: "12px" }}>
                No recent background jobs. Run a discovery or verification task!
              </div>
            ) : (
              jobs.slice(0, 4).map((job) => {
                const Icon = job.type === "discovery" ? Sparkles : ShieldCheck;
                return (
                  <div className="job-row" key={job.id}>
                    <div className="job-icon">
                      <Icon />
                    </div>
                    <div className="job-main">
                      <strong>{job.type === "discovery" ? "Lead discovery" : "Website verification"}</strong>
                      <span>
                        {job.args?.join(" ") || `Job #${job.id.slice(-6)}`}
                      </span>
                    </div>
                    <div className="job-progress">
                      <Status value={job.status} />
                      <span>{job.progress}%</span>
                    </div>
                    <time>
                      {new Date(job.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                    <button
                      className="icon-button"
                      onClick={() => onNavigate("Verification Jobs")}
                      title="Inspect Job"
                    >
                      <ArrowUpRight />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Common prospecting workflows</p>
            </div>
          </div>
          <button className="action-card" onClick={() => onNavigate("Discover Leads")}>
            <span className="action-icon">
              <Sparkles />
            </span>
            <span>
              <strong>Discover new leads</strong>
              <small>Search OSM & Web Search for $0</small>
            </span>
            <ArrowUpRight />
          </button>
          <button className="action-card" onClick={() => onTriggerVerification()}>
            <span className="action-icon">
              <ShieldCheck />
            </span>
            <span>
              <strong>Verify websites</strong>
              <small>Run 7-point deterministic audit</small>
            </span>
            <ArrowUpRight />
          </button>
          <button className="action-card" onClick={() => onNavigate("Lead Explorer")}>
            <span className="action-icon">
              <ListFilter />
            </span>
            <span>
              <strong>Explore all leads</strong>
              <small>Search and filter your MongoDB database</small>
            </span>
            <ArrowUpRight />
          </button>
        </section>
      </div>

      <section className="panel leads-panel">
        <div className="panel-heading">
          <div>
            <h2>Recently discovered leads</h2>
            <p>Latest businesses saved to MongoDB Atlas with live performance data</p>
          </div>
          <button className="text-button" onClick={() => onNavigate("Lead Explorer")}>
            Explore leads <ArrowUpRight />
          </button>
        </div>
        <LeadTable
          rows={leads.slice(0, 6)}
          onSelectLead={onSelectLead}
          onTriggerVerification={onTriggerVerification}
        />
      </section>
    </div>
  );
}

function LeadTable({
  rows,
  onSelectLead,
  onTriggerVerification,
}: {
  rows: Lead[];
  onSelectLead: (id: string) => void;
  onTriggerVerification?: (url?: string, leadId?: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty">
        <BriefcaseBusiness />
        <strong>No leads discovered yet</strong>
        <span>Queue a discovery job to start finding real businesses.</span>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Location</th>
            <th>Category</th>
            <th>Rating / Reviews</th>
            <th>Official Website</th>
            <th>Verification & Site Speed</th>
            <th>Discovered</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const initials = lead.business_name
              ? lead.business_name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
              : "BL";
            const domain = lead.website ? lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
            const discoveredTime = lead.discovered_at
              ? new Date(lead.discovered_at).toLocaleDateString([], { month: "short", day: "numeric" })
              : "Recent";

            const verif = lead.latest_verification;

            return (
              <tr key={lead._id || lead.place_id} onClick={() => onSelectLead(lead.place_id || lead._id)}>
                <td>
                  <div className="business-cell">
                    <div className="business-avatar">{initials}</div>
                    <div>
                      <strong>{lead.business_name}</strong>
                      <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                        {lead.address || (lead.category || "Local Business")}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  {lead.city ? `${lead.city}, ` : ""}
                  {lead.country}
                </td>
                <td>{lead.category || "General"}</td>
                <td>
                  {lead.rating ? (
                    <>
                      <span className="rating">★ {lead.rating}</span>{" "}
                      <span className="muted">({lead.review_count || 0})</span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {lead.website ? (
                    <div>
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#f4f4f5", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        {domain}
                        <ExternalLink size={12} />
                      </a>
                      <small className="website-state">
                        <i />
                        Live Website
                      </small>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span className="muted" style={{ fontSize: "11px" }}>No website linked</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(lead.business_name + " " + (lead.city || "") + " official website")}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: "11px", color: "#91a8bc", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          title="Search official website on Google"
                        >
                          🔍 Search web <ExternalLink size={10} />
                        </a>
                        {lead.source_url && (
                          <a
                            href={lead.source_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: "10px", color: "#71717a", textDecoration: "underline" }}
                          >
                            [Source]
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  {verif ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <Status value={verif.verification_status || lead.website_status} />
                      <div style={{ fontSize: "11px", color: "#a1a1aa", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        {verif.performance?.ttfb_ms && (
                          <span style={{ color: verif.performance.ttfb_ms < 1500 ? "#7dbb8c" : "#d0a968", fontWeight: 500 }}>
                            ⚡ {verif.performance.ttfb_ms}ms
                          </span>
                        )}
                        {verif.performance?.document_size_kb !== undefined && (
                          <span>📦 {verif.performance.document_size_kb}KB</span>
                        )}
                        {verif.availability?.https !== undefined && (
                          <span style={{ color: verif.availability.https ? "#7dbb8c" : "#d47c7c" }}>
                            {verif.availability.https ? "🔒 HTTPS" : "⚠️ HTTP"}
                          </span>
                        )}
                        {verif.responsiveness?.responsive !== undefined && (
                          <span style={{ color: verif.responsiveness.responsive ? "#7dbb8c" : "#d0a968" }}>
                            {verif.responsiveness.responsive ? "📱 Mobile" : "⚠️ Viewport"}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : lead.website ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Status value={lead.website_status || "unverified"} />
                      {onTriggerVerification && (
                        <button
                          className="text-button"
                          style={{ color: "#91a8bc", fontSize: "11px", padding: "2px 6px", background: "#18181b", borderRadius: "4px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTriggerVerification(lead.website || undefined, lead.place_id);
                          }}
                        >
                          ⚡ Run Audit
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="muted">{discoveredTime}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Explorer({
  leads,
  onSelectLead,
  onRefresh,
  onTriggerVerification,
}: {
  leads: Lead[];
  onSelectLead: (id: string) => void;
  onRefresh: () => void;
  onTriggerVerification?: (url?: string, leadId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const matchQuery = `${lead.business_name} ${lead.website || ""} ${lead.city || ""} ${lead.category || ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
      
      let matchStatus = true;
      if (filter === "Has website") {
        matchStatus = Boolean(lead.website);
      } else if (filter === "No website") {
        matchStatus = !lead.website;
      } else if (filter === "verified") {
        matchStatus = lead.website_status === "verified" || lead.latest_verification?.verification_status === "verified";
      } else if (filter === "fast_speed") {
        matchStatus = Boolean(lead.latest_verification?.performance?.ttfb_ms && lead.latest_verification.performance.ttfb_ms < 1500);
      } else if (filter === "mobile_ready") {
        matchStatus = Boolean(lead.latest_verification?.responsiveness?.responsive);
      } else if (filter !== "All statuses") {
        matchStatus = lead.website_status?.toLowerCase() === filter.toLowerCase();
      }

      return matchQuery && matchStatus;
    });
  }, [leads, query, filter]);

  return (
    <div className="content-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Leads</p>
          <h1>Lead Explorer</h1>
          <p className="subtitle">{leads.length} businesses in your MongoDB Atlas database with real-time audit data</p>
        </div>
      </div>
      <div className="explorer-toolbar">
        <div className="search-box">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, website, category, or location"
          />
          <kbd>⌘ K</kbd>
        </div>
        <select aria-label="Verification status" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="All statuses">All statuses</option>
          <option value="Has website">Has Official Website</option>
          <option value="No website">No Website Found</option>
          <option value="verified">Verified Sites</option>
          <option value="fast_speed">Fast Speed (TTFB &lt; 1.5s)</option>
          <option value="mobile_ready">Mobile Ready (375px)</option>
        </select>
        <button className="filter-button" onClick={() => setFilter(filter === "Has website" ? "All statuses" : "Has website")}>
          <Filter /> Has Website <span>{leads.filter((l) => Boolean(l.website)).length}</span>
        </button>
        <button className="icon-button bordered" onClick={onRefresh} title="Refresh leads">
          <RefreshCw />
        </button>
      </div>
      {(query || filter !== "All statuses") && (
        <div className="filter-line">
          <span>
            <Filter /> Active filters:
          </span>
          {filter !== "All statuses" && <button>{filter}</button>}
          {query && <button>Query: &quot;{query}&quot;</button>}
          <button
            className="clear-button"
            onClick={() => {
              setFilter("All statuses");
              setQuery("");
            }}
          >
            Clear all
          </button>
        </div>
      )}
      <section className="panel explorer-panel">
        <div className="table-meta">
          <span>
            <strong>{filtered.length}</strong> of {leads.length} leads
          </span>
          <div>
            <span>Showing real-time records</span>
          </div>
        </div>
        {filtered.length ? (
          <LeadTable
            rows={filtered}
            onSelectLead={onSelectLead}
            onTriggerVerification={onTriggerVerification}
          />
        ) : (
          <div className="empty">
            <Search />
            <strong>No leads found</strong>
            <span>Try adjusting your search query or filters.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function LeadDetail({
  id,
  onBack,
  onTriggerVerification,
}: {
  id: string;
  onBack: () => void;
  onTriggerVerification: (url?: string, leadId?: string) => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLead() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/${id}`);
        const data = await res.json();
        if (data.lead) setLead(data.lead);
        if (data.latest_verification) setVerification(data.latest_verification);
      } catch (err) {
        console.error("Failed to load lead details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLead();
  }, [id]);

  if (loading) {
    return (
      <div className="content-wrap detail-wrap">
        <button className="back-button" onClick={onBack}>
          <ChevronLeft /> Back to leads
        </button>
        <div className="empty">
          <div className="spinner" />
          <span>Loading lead details from MongoDB Atlas...</span>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="content-wrap detail-wrap">
        <button className="back-button" onClick={onBack}>
          <ChevronLeft /> Back to leads
        </button>
        <div className="empty">
          <strong>Lead not found</strong>
          <span>The requested lead could not be located.</span>
        </div>
      </div>
    );
  }

  const initials = lead.business_name
    ? lead.business_name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "BL";

  const domain = lead.website ? lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;

  const checkItems = [
    {
      name: "1. Website Availability",
      result: verification?.availability
        ? `HTTP ${verification.availability.status_code || 200} · ${verification.availability.response_time_ms || 0}ms`
        : lead.website
        ? "Not verified yet"
        : "No website",
      state: verification?.availability?.reachable ? "good" : lead.website ? "warn" : "warn",
      detail: verification?.availability
        ? `DNS Resolved: ${verification.availability.reachable ? "Yes" : "No"} | HTTPS: ${
            verification.availability.https ? "Enabled" : "Disabled"
          } | Final URL: ${verification.availability.final_url || lead.website}`
        : "Run website verification to test reachability, HTTP response codes, and SSL status.",
    },
    {
      name: "2. Mobile Responsiveness",
      result: verification?.responsiveness
        ? verification.responsiveness.responsive
          ? "Mobile Responsive (375px)"
          : "Horizontal overflow detected"
        : "Pending check",
      state: verification?.responsiveness?.responsive ? "good" : "warn",
      detail: verification?.responsiveness
        ? `Viewport tested at 375x812 mobile standard. Overflow: ${
            verification.responsiveness.horizontal_overflow ? "Detected" : "None"
          }`
        : "Tests 375x812 viewport to detect viewport meta tags and layout breaks.",
    },
    {
      name: "3. Performance & Speed",
      result: verification?.performance?.ttfb_ms
        ? `${verification.performance.ttfb_ms}ms TTFB · ${verification.performance.document_size_kb || 0} KB`
        : "Pending check",
      state: (verification?.performance?.ttfb_ms || 0) < 1500 ? "good" : "warn",
      detail: verification?.performance
        ? `Time to First Byte: ${verification.performance.ttfb_ms}ms | Document Size: ${
            verification.performance.document_size_kb || 0
          } KB | Compression: ${verification.performance.compression_enabled ? "Active" : "None"}`
        : "Measures server latency (TTFB), payload compression, and initial page weight.",
    },
    {
      name: "4. HTTP Caching",
      result: verification?.caching?.has_caching_signals
        ? "Caching headers detected"
        : "Cache-Control missing / unoptimized",
      state: verification?.caching?.has_caching_signals ? "good" : "warn",
      detail: verification?.caching
        ? `Cache-Control: ${verification.caching.cache_control || "None"}`
        : "Inspects Cache-Control, ETag, and Last-Modified headers.",
    },
    {
      name: "5. Technical SEO",
      result: verification?.technical_seo?.title
        ? `Title & meta tags present`
        : "Meta description or title missing",
      state: verification?.technical_seo?.title && verification?.technical_seo?.meta_description ? "good" : "warn",
      detail: verification?.technical_seo
        ? `Title: ${verification.technical_seo.title ? "Present" : "Missing"} | Meta Description: ${
            verification.technical_seo.meta_description ? "Present" : "Missing"
          }`
        : "Evaluates title tags, meta descriptions, canonical URLs, and heading hierarchy.",
    },
    {
      name: "6. Accessibility Signals",
      result: verification?.accessibility
        ? `${verification.accessibility.images_missing_alt || 0} images missing alt text`
        : "Pending check",
      state: (verification?.accessibility?.images_missing_alt || 0) === 0 ? "good" : "warn",
      detail: verification?.accessibility
        ? `Missing alt tags: ${verification.accessibility.images_missing_alt} | Missing form labels: ${verification.accessibility.form_inputs_missing_labels}`
        : "Detects accessible form inputs and image alt attributes.",
    },
    {
      name: "7. Conversion & UX Signals",
      result: verification?.conversion_ux?.has_conversion_signals
        ? "Contact & CTA detected"
        : "No prominent CTA found",
      state: verification?.conversion_ux?.has_conversion_signals ? "good" : "warn",
      detail: verification?.conversion_ux
        ? `Contact Page: ${verification.conversion_ux.contact_page ? "Found" : "No"} | Visible Phone: ${
            verification.conversion_ux.phone_visible ? "Yes" : "No"
          } | Lead Form: ${verification.conversion_ux.lead_capture_form ? "Yes" : "No"}`
        : "Scans for phone numbers, contact forms, and lead conversion points.",
    },
  ];

  return (
    <div className="content-wrap detail-wrap">
      <button className="back-button" onClick={onBack}>
        <ChevronLeft /> Back to leads
      </button>
      <div className="detail-header">
        <div className="detail-identity">
          <div className="detail-avatar">{initials}</div>
          <div>
            <p className="eyebrow">
              {lead.category || "Business"} · {lead.city || lead.country}
            </p>
            <h1>{lead.business_name}</h1>
            <div className="detail-inline">
              {lead.website ? (
                <a
                  href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {domain} <ExternalLink />
                </a>
              ) : (
                <span className="muted">No official website</span>
              )}
              <Status value={lead.website_status || "unverified"} />
              {lead.rating && <span className="rating">★ {lead.rating}</span>}
              {lead.review_count !== undefined && <span className="muted">{lead.review_count} reviews</span>}
            </div>
          </div>
        </div>
        {lead.website && (
          <button
            className="secondary-button"
            onClick={() => onTriggerVerification(lead.website || undefined, lead.place_id)}
          >
            <ShieldCheck /> Run verification
          </button>
        )}
      </div>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>7-Point Fast Website Verification</h2>
              <p>
                {verification?.verified_at
                  ? `Last verified: ${new Date(verification.verified_at).toLocaleString()}`
                  : "Deterministic Stage 2 verification"}
              </p>
            </div>
            <Status value={verification?.verification_status || lead.website_status || "unverified"} />
          </div>
          <div className="check-list">
            {checkItems.map((check) => (
              <details className="check-row" key={check.name}>
                <summary>
                  <span className={`check-indicator ${check.state}`}>
                    {check.state === "good" ? <Check /> : <CircleAlert />}
                  </span>
                  <strong>{check.name}</strong>
                  <span className="check-result">{check.result}</span>
                  <ChevronDown />
                </summary>
                <div className="check-detail">{check.detail}</div>
              </details>
            ))}
          </div>
        </section>
        <aside className="detail-side">
          <section className="panel info-panel">
            <div className="panel-heading">
              <div>
                <h2>Business Details</h2>
                <p>Saved in MongoDB Atlas</p>
              </div>
            </div>
            <dl>
              <dt>Category</dt>
              <dd>{lead.category || "General"}</dd>
              <dt>Phone</dt>
              <dd>
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} style={{ color: "#7dbb8c", fontWeight: 600, textDecoration: "underline" }}>
                    {lead.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Address</dt>
              <dd>{lead.address || `${lead.city || ""}, ${lead.country}`}</dd>
              <dt>Source</dt>
              <dd>{lead.source || "OSM / Web Search"}</dd>
            </dl>
          </section>

          <section className="panel" style={{ padding: "18px" }}>
            <div className="panel-heading" style={{ padding: 0, marginBottom: "14px" }}>
              <div>
                <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                  <Phone size={14} color="#7dbb8c" /> Direct Outreach & Socials
                </h2>
                <p>Fast contact actions & social profiles</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {lead.phone && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <a
                    href={`tel:${lead.phone}`}
                    className="contact-action-btn primary-btn"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <Phone size={12} /> Call Direct
                  </a>
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="contact-action-btn"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <MessageSquare size={12} /> WhatsApp
                  </a>
                </div>
              )}

              <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px" }}>
                Find active profiles & owner footprints:
              </div>
              <div className="social-chips-row" style={{ flexWrap: "wrap" }}>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent('site:instagram.com "' + lead.business_name + '" "' + (lead.city || "") + '"')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="social-chip"
                >
                  📸 Instagram
                </a>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent('site:linkedin.com "' + lead.business_name + '" "' + (lead.city || "") + '"')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="social-chip"
                >
                  💼 LinkedIn
                </a>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent('site:facebook.com "' + lead.business_name + '" "' + (lead.city || "") + '"')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="social-chip"
                >
                  📘 Facebook
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.business_name + " " + (lead.city || "") + " " + lead.country)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="social-chip"
                >
                  📍 Google Maps
                </a>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Discover({
  onNavigate,
  onJobStarted,
}: {
  onNavigate: (item: string) => void;
  onJobStarted: (jobId: string) => void;
}) {
  const [category, setCategory] = useState("wedding planners");
  const [country, setCountry] = useState("US");
  const [city, setCity] = useState("Austin");
  const [provider, setProvider] = useState("auto");
  const [limit, setLimit] = useState(10);
  const [started, setStarted] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, country, city, limit: Number(limit), provider }),
      });
      const data = await res.json();
      if (res.ok) {
        setStarted(true);
        setLastJobId(data.job_id);
        onJobStarted(data.job_id);
      } else {
        setErrorMsg(data.error || JSON.stringify(data.details));
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-wrap narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Discovery</p>
          <h1>Discover leads</h1>
          <p className="subtitle">Find real businesses matching category and location at $0 cost.</p>
        </div>
      </div>
      <section className="panel discovery-panel">
        <div className="discovery-intro">
          <div className="action-icon large">
            <Sparkles />
          </div>
          <div>
            <h2>Start a new discovery</h2>
            <p>
              Query OpenStreetMap & public web search for real business leads. Results are deduplicated and saved directly to MongoDB Atlas.
            </p>
          </div>
        </div>
        <form onSubmit={handleStart}>
          <div className="form-grid">
            <label>
              Business category
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. wedding planners, salons, plumbers"
                required
              />
            </label>
            <label>
              Country (ISO Code)
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="US">United States (US)</option>
                <option value="IN">India (IN)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="CA">Canada (CA)</option>
                <option value="AU">Australia (AU)</option>
              </select>
            </label>
            <label>
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Austin, London, Delhi, Toronto"
                required
              />
            </label>
            <label>
              Discovery Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="auto">Auto (OSM + Web Search) [$0 Free]</option>
                <option value="osm">OpenStreetMap Overpass [$0 Free]</option>
                <option value="web">Web Search [$0 Free]</option>
                <option value="google">Google Places (API Key Required)</option>
              </select>
            </label>
            <label>
              Result limit
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                <option value={5}>5 leads</option>
                <option value={10}>10 leads</option>
                <option value={25}>25 leads</option>
                <option value={50}>50 leads</option>
              </select>
            </label>
          </div>
          {errorMsg && (
            <div style={{ color: "#d47c7c", marginBottom: "16px", fontSize: "12px" }}>
              Error: {errorMsg}
            </div>
          )}
          <div className="form-footer">
            <span>
              <Clock3 /> Typical discovery takes 5–20 seconds via Python Subprocess
            </span>
            <button className="primary-button" type="submit" disabled={loading}>
              <Play /> {loading ? "Queueing..." : "Start discovery"}
            </button>
          </div>
        </form>
        {started && lastJobId && (
          <div className="started-state">
            <span className="spinner" />
            <div>
              <strong>Discovery job started</strong>
              <span>Job #{lastJobId} is executing and streaming logs in real time.</span>
            </div>
            <button className="text-button" onClick={() => onNavigate("Verification Jobs")}>
              View job <ArrowUpRight />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Jobs({
  jobs,
  activeJobId,
  setActiveJobId,
  liveLogs,
  onTriggerBatchVerify,
}: {
  jobs: Job[];
  activeJobId: string | null;
  setActiveJobId: (id: string) => void;
  liveLogs: string[];
  onTriggerBatchVerify: () => void;
}) {
  const activeJob = jobs.find((j) => j.id === activeJobId) || jobs[0];

  return (
    <div className="content-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Operations</p>
          <h1>Verification & Discovery Jobs</h1>
          <p className="subtitle">Track asynchronous Python engine executions and live process streams.</p>
        </div>
        <button className="primary-button" onClick={onTriggerBatchVerify}>
          <Zap /> Batch verify unverified leads
        </button>
      </div>

      <section
        style={{
          background: "#0d0d0d",
          border: "1px solid #262626",
          borderRadius: "7px",
          padding: "18px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h2 style={{ fontSize: "14px", margin: 0, color: "#f5f5f5" }}>
              Live Execution Terminal {activeJob ? `(Job #${activeJob.id.slice(-6)})` : ""}
            </h2>
            {activeJob && (
              <span style={{ fontSize: "11px", color: "#8b8b92" }}>
                Status: <strong style={{ color: "#eee" }}>{activeJob.status}</strong> | Progress:{" "}
                <strong style={{ color: "#eee" }}>{activeJob.progress}%</strong>
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            background: "#050505",
            border: "1px solid #1c1c1c",
            borderRadius: "5px",
            padding: "14px",
            height: "180px",
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#8fa8bc",
          }}
        >
          {liveLogs.length === 0 ? (
            <span style={{ color: "#555" }}>
              {activeJob ? "Listening for real-time subprocess stdout..." : "Select a job below to inspect logs."}
            </span>
          ) : (
            liveLogs.map((log, idx) => <div key={idx}>{log}</div>)
          )}
        </div>
      </section>

      <section className="panel explorer-panel">
        <div className="table-meta">
          <span>
            <strong>{jobs.length}</strong> total background jobs
          </span>
          <button className="filter-button">
            <ListFilter /> Filter
          </button>
        </div>
        <div className="jobs-table">
          {jobs.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#777", fontSize: "12px" }}>
              No background jobs executed yet.
            </div>
          ) : (
            jobs.map((job) => {
              const Icon = job.type === "discovery" ? Sparkles : ShieldCheck;
              const isCurrent = job.id === activeJobId;
              return (
                <div
                  className="jobs-table-row"
                  key={job.id}
                  style={{ background: isCurrent ? "#161616" : "transparent" }}
                >
                  <div className="job-icon">
                    <Icon />
                  </div>
                  <div className="job-main">
                    <strong>{job.type === "discovery" ? "Lead Discovery" : "Website Verification"}</strong>
                    <span>{job.args?.join(" ") || `Job #${job.id}`}</span>
                  </div>
                  <div>
                    <Status value={job.status} />
                  </div>
                  <div className="job-progress desktop-progress">
                    <span>{job.progress}%</span>
                    <div className="progress">
                      <i style={{ width: `${job.progress}%` }} />
                    </div>
                  </div>
                  <time>
                    {new Date(job.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                  <button
                    className="icon-button"
                    onClick={() => setActiveJobId(job.id)}
                    title="View Stream"
                  >
                    <ArrowUpRight />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function ContactsView({
  leads,
  onSelectLead,
  onTriggerVerification,
}: {
  leads: Lead[];
  onSelectLead: (id: string) => void;
  onTriggerVerification?: (url?: string, leadId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const phoneCount = leads.filter((l) => Boolean(l.phone)).length;
  const withWebsiteCount = leads.filter((l) => Boolean(l.website)).length;
  const noWebsiteWithPhoneCount = leads.filter((l) => !l.website && Boolean(l.phone)).length;
  const noWebsiteTotal = leads.filter((l) => !l.website).length;

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const matchQuery = `${lead.business_name} ${lead.phone || ""} ${lead.city || ""} ${lead.category || ""} ${lead.website || ""}`
        .toLowerCase()
        .includes(query.toLowerCase());

      let matchFilter = true;
      if (filter === "phone") {
        matchFilter = Boolean(lead.phone);
      } else if (filter === "website") {
        matchFilter = Boolean(lead.website);
      } else if (filter === "no_website") {
        matchFilter = !lead.website;
      } else if (filter === "pitch_ready") {
        matchFilter = !lead.website && Boolean(lead.phone);
      } else if (filter === "top_rated") {
        matchFilter = (lead.rating || 0) >= 4.5;
      }

      return matchQuery && matchFilter;
    });
  }, [leads, query, filter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyPitchTemplate = (lead: Lead) => {
    const pitch = `Hi ${lead.business_name} Team,\n\nI noticed your business in ${lead.city || lead.country} and wanted to reach out regarding your online presence and client acquisition.\n\n${
      lead.website
        ? `We ran an automated audit on your website (${lead.website}) and identified a few high-impact opportunities to improve speed and conversion rates.`
        : `I noticed you don't currently have an official website listed for ${lead.business_name}. We help local businesses build high-converting websites and Google Maps dominance.`
    }\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\nAditya`;
    
    copyToClipboard(pitch, `pitch-${lead.place_id || lead._id}`);
  };

  return (
    <div className="content-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Outreach & Contacts</p>
          <h1>Contacts & Outreach Hub</h1>
          <p className="subtitle">
            Direct phone numbers, email search, WhatsApp messaging, and social profile discovery for {leads.length} leads.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Metric
          label="Callable Phone Numbers"
          value={phoneCount.toString()}
          detail={`${leads.length > 0 ? ((phoneCount / leads.length) * 100).toFixed(0) : 0}% of total leads`}
          icon={Phone}
        />
        <Metric
          label="Prime Pitch Targets (No Site + Phone)"
          value={noWebsiteWithPhoneCount.toString()}
          detail="High-converting agency prospects"
          icon={Sparkles}
        />
        <Metric
          label="Total Businesses with No Website"
          value={noWebsiteTotal.toString()}
          detail="Web design & SEO opportunities"
          icon={BriefcaseBusiness}
        />
        <Metric
          label="Online Portals & Sites"
          value={withWebsiteCount.toString()}
          detail="Active websites cataloged"
          icon={Globe2}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="explorer-toolbar" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div className="search-box" style={{ minWidth: "280px" }}>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, phone, city, or category..."
          />
          <kbd>⌘ K</kbd>
        </div>

        <select aria-label="Filter contacts" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Leads ({leads.length})</option>
          <option value="phone">📞 Has Phone Number ({phoneCount})</option>
          <option value="pitch_ready">🔥 Prime Pitch Targets ({noWebsiteWithPhoneCount})</option>
          <option value="no_website">🌐 No Website ({noWebsiteTotal})</option>
          <option value="website">💻 Has Website ({withWebsiteCount})</option>
          <option value="top_rated">⭐ Top Rated (★ 4.5+)</option>
        </select>

        <button
          className={`filter-button ${filter === "pitch_ready" ? "bordered" : ""}`}
          onClick={() => setFilter(filter === "pitch_ready" ? "all" : "pitch_ready")}
          style={{ borderColor: filter === "pitch_ready" ? "#7dbb8c" : undefined }}
        >
          🔥 Prime Targets <span>{noWebsiteWithPhoneCount}</span>
        </button>
      </div>

      {/* Contacts Prospect Cards Grid */}
      {filtered.length === 0 ? (
        <div className="empty" style={{ marginTop: "24px" }}>
          <Users size={32} color="#71717a" />
          <strong>No matching contacts found</strong>
          <span>Try adjusting your search query or contact filter.</span>
        </div>
      ) : (
        <div className="contacts-grid">
          {filtered.map((lead) => {
            const initials = lead.business_name
              ? lead.business_name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
              : "CL";

            const isCopied = copiedId === (lead.place_id || lead._id);
            const isPitchCopied = copiedId === `pitch-${lead.place_id || lead._id}`;

            return (
              <div className="contact-card" key={lead._id || lead.place_id}>
                <div>
                  <div className="contact-header">
                    <div className="contact-avatar">{initials}</div>
                    <div className="contact-meta" style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {lead.business_name}
                      </strong>
                      <span>
                        {lead.category || "Business"} · {lead.city ? `${lead.city}, ` : ""}{lead.country}
                      </span>
                    </div>
                    {lead.rating && (
                      <span className="rating" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                        ★ {lead.rating}
                      </span>
                    )}
                  </div>

                  <div className="contact-details-box" style={{ marginTop: "12px" }}>
                    <div className="contact-detail-row">
                      <span>Phone:</span>
                      {lead.phone ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ color: "#7dbb8c" }}>{lead.phone}</strong>
                          <button
                            onClick={() => copyToClipboard(lead.phone!, lead.place_id || lead._id)}
                            style={{ background: "none", border: 0, padding: 0, color: "#a1a1aa", cursor: "pointer" }}
                            title="Copy phone"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#71717a" }}>No phone</span>
                      )}
                    </div>

                    <div className="contact-detail-row">
                      <span>Website:</span>
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#91a8bc", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span style={{ color: "#d0a968", fontWeight: 500 }}>No Website (Pitch Target)</span>
                      )}
                    </div>

                    <div className="contact-detail-row">
                      <span>Address:</span>
                      <strong style={{ fontSize: "11px", color: "#a1a1aa", textAlign: "right", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lead.address || `${lead.city || ""}, ${lead.country}`}
                      </strong>
                    </div>
                  </div>

                  {/* Social Profile Search Shortcuts */}
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "4px" }}>
                      Find Active Profiles & Footprints:
                    </div>
                    <div className="social-chips-row" style={{ flexWrap: "wrap" }}>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent('site:instagram.com "' + lead.business_name + '" "' + (lead.city || "") + '"')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="social-chip"
                        title="Search Instagram account"
                      >
                        📸 Instagram
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent('site:linkedin.com "' + lead.business_name + '" "' + (lead.city || "") + '"')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="social-chip"
                        title="Search LinkedIn company/owner"
                      >
                        💼 LinkedIn
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent('site:facebook.com "' + lead.business_name + '" "' + (lead.city || "") + '"')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="social-chip"
                        title="Search Facebook page"
                      >
                        📘 Facebook
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.business_name + " " + (lead.city || "") + " " + lead.country)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="social-chip"
                        title="Search on Google Maps"
                      >
                        📍 Maps
                      </a>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div style={{ borderTop: "1px solid #1f1f23", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div className="contact-actions">
                    {lead.phone && (
                      <>
                        <a href={`tel:${lead.phone}`} className="contact-action-btn primary-btn">
                          <Phone size={12} /> Call
                        </a>
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="contact-action-btn"
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </a>
                      </>
                    )}
                    <button
                      className="contact-action-btn"
                      onClick={() => copyPitchTemplate(lead)}
                      title="Copy customized cold pitch template to clipboard"
                    >
                      <Copy size={12} /> {isPitchCopied ? "Pitch Copied!" : "Copy Pitch"}
                    </button>
                    <button
                      className="contact-action-btn"
                      onClick={() => onSelectLead(lead.place_id || lead._id)}
                      style={{ marginLeft: "auto", background: "#222", color: "#fff" }}
                    >
                      Audit Details <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsView({
  totalLeadsCount,
  user,
}: {
  totalLeadsCount: number;
  user: UserSession | null;
}) {
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const [includeVerifications, setIncludeVerifications] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const handleExport = async (format: "json" | "csv") => {
    setDownloading(true);
    setExportMessage(`Preparing ${range} data export...`);

    try {
      const url = `/api/export?range=${range}&format=${format}&include_verifications=${includeVerifications}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error("Failed to generate export file");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `clds_leads_${range}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExportMessage(`Successfully exported ${range} dataset in ${format.toUpperCase()} format!`);
    } catch (err: any) {
      setExportMessage(`Export error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="content-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace Configuration</p>
          <h1>Settings & Data Export</h1>
          <p className="subtitle">Export complete lead datasets, manage persistence, and review system credentials.</p>
        </div>
      </div>

      {exportMessage && (
        <div
          style={{
            padding: "12px 16px",
            background: exportMessage.includes("error") ? "#271414" : "#111c14",
            border: `1px solid ${exportMessage.includes("error") ? "#5c2424" : "#314237"}`,
            color: exportMessage.includes("error") ? "#f87171" : "#7dbb8c",
            borderRadius: "6px",
            marginBottom: "20px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {exportMessage.includes("error") ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{exportMessage}</span>
        </div>
      )}

      <div className="settings-grid">
        {/* Bulk Data Export Section */}
        <section className="panel" style={{ padding: "24px" }}>
          <div className="panel-heading" style={{ padding: 0, marginBottom: "18px" }}>
            <div>
              <h2 style={{ fontSize: "16px" }}>Bulk Lead Export Hub</h2>
              <p>Export full details of your discovered leads for a whole week, month, or all-time dataset.</p>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12px", color: "#d4d4d8", fontWeight: 600 }}>Select Timeframe:</label>
            <div className="export-range-group">
              <button
                type="button"
                className={`timeframe-pill ${range === "week" ? "active" : ""}`}
                onClick={() => setRange("week")}
              >
                📅 Whole Week (7 Days)
              </button>
              <button
                type="button"
                className={`timeframe-pill ${range === "month" ? "active" : ""}`}
                onClick={() => setRange("month")}
              >
                🗓️ Whole Month (30 Days)
              </button>
              <button
                type="button"
                className={`timeframe-pill ${range === "all" ? "active" : ""}`}
                onClick={() => setRange("all")}
              >
                🗄️ Complete Database
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={includeVerifications}
                onChange={(e) => setIncludeVerifications(e.target.checked)}
              />
              <span>Include full 7-Point Technical Verification records & UX audit signals</span>
            </label>
          </div>

          <div className="export-stats-box">
            <div>
              <div style={{ fontSize: "11px", color: "#a1a1aa" }}>Selected Scope</div>
              <strong style={{ fontSize: "14px", color: "#f4f4f5" }}>
                {range === "week" ? "Past 7 Days" : range === "month" ? "Past 30 Days" : "All Leads"}
              </strong>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#a1a1aa" }}>Stored in Atlas</div>
              <strong style={{ fontSize: "14px", color: "#7dbb8c" }}>{totalLeadsCount} total leads</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "20px" }}>
            <button
              className="primary-button"
              onClick={() => handleExport("json")}
              disabled={downloading}
              style={{ flex: 1, minWidth: "180px", height: "42px", justifyContent: "center" }}
            >
              <FileJson size={16} />
              {downloading ? "Exporting..." : "Export to JSON (Full Details)"}
            </button>
            <button
              className="secondary-button"
              onClick={() => handleExport("csv")}
              disabled={downloading}
              style={{ flex: 1, minWidth: "160px", height: "42px", justifyContent: "center" }}
            >
              <FileSpreadsheet size={16} />
              Export to CSV Spreadsheet
            </button>
          </div>
        </section>

        {/* System & Workspace Info */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <section className="panel" style={{ padding: "20px" }}>
            <div className="panel-heading" style={{ padding: 0, marginBottom: "14px" }}>
              <div>
                <h2>Workspace & Account</h2>
                <p>Current authenticated profile</p>
              </div>
            </div>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "90px 1fr", gap: "10px", fontSize: "12px" }}>
              <dt style={{ color: "#71717a" }}>User</dt>
              <dd style={{ margin: 0, color: "#f4f4f5", fontWeight: 500 }}>{user?.name || "Aditya Sharma"}</dd>
              <dt style={{ color: "#71717a" }}>Email</dt>
              <dd style={{ margin: 0, color: "#a1a1aa" }}>{user?.email || "admin@clds.ai"}</dd>
              <dt style={{ color: "#71717a" }}>Role</dt>
              <dd style={{ margin: 0, color: "#7dbb8c" }}>{user?.role || "Administrator"}</dd>
              <dt style={{ color: "#71717a" }}>Workspace</dt>
              <dd style={{ margin: 0, color: "#a1a1aa" }}>{user?.workspace || "CLDS Production"}</dd>
            </dl>
          </section>

          <section className="panel" style={{ padding: "20px" }}>
            <div className="panel-heading" style={{ padding: 0, marginBottom: "14px" }}>
              <div>
                <h2>Engine & Connectivity</h2>
                <p>Underlying sub-systems</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#a1a1aa" }}>MongoDB Atlas</span>
                <span style={{ color: "#7dbb8c", fontSize: "11px", fontWeight: 600 }}>● Connected</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#a1a1aa" }}>Python Subprocess</span>
                <span style={{ color: "#7dbb8c", fontSize: "11px", fontWeight: 600 }}>● Ready</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#a1a1aa" }}>Free Discovery ($0)</span>
                <span style={{ color: "#d0a968", fontSize: "11px", fontWeight: 600 }}>OSM + Web Search</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  const [active, setActive] = useState("Dashboard");
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Authentication State
  const [user, setUser] = useState<UserSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Check initial session
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {}
    setUser(null);
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads?limit=100");
      const data = await res.json();
      if (data.leads) setLeads(data.leads);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs?limit=20");
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeads();
      fetchJobs();
      const interval = setInterval(() => {
        fetchJobs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Listen to Server-Sent Events stream when activeJobId is set
  useEffect(() => {
    if (!activeJobId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLiveLogs([]);
    const es = new EventSource(`/api/jobs/${activeJobId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("init", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.logs) setLiveLogs(data.logs);
      } catch {}
    });

    es.addEventListener("log", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.message) {
          setLiveLogs((prev) => [...prev, data.message]);
        }
      } catch {}
    });

    es.addEventListener("status", () => {
      fetchJobs();
      fetchLeads();
    });

    es.addEventListener("done", () => {
      es.close();
      fetchJobs();
      fetchLeads();
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [activeJobId]);

  const handleTriggerVerification = async (url?: string, leadId?: string) => {
    try {
      const payload = url ? { url } : leadId ? { lead_id: leadId } : { limit: 10 };
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.job_id) {
        setActiveJobId(data.job_id);
        setActive("Verification Jobs");
        fetchJobs();
      }
    } catch (err) {
      console.error("Failed to trigger verification:", err);
    }
  };

  const navigate = (item: string) => {
    setSelectedLead(null);
    setActive(item);
  };

  if (checkingAuth) {
    return (
      <div className="login-shell">
        <div className="spinner" style={{ width: "24px", height: "24px" }} />
      </div>
    );
  }

  // If not authenticated, display login screen
  if (!user) {
    return <LoginScreen onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  const activeJobsCount = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  let view = (
    <Dashboard
      onNavigate={navigate}
      onSelectLead={setSelectedLead}
      onTriggerVerification={handleTriggerVerification}
      leads={leads}
      jobs={jobs}
      activeJobsCount={activeJobsCount}
      stats={stats}
    />
  );

  if (active === "Lead Explorer") {
    view = (
      <Explorer
        leads={leads}
        onSelectLead={setSelectedLead}
        onRefresh={fetchLeads}
        onTriggerVerification={handleTriggerVerification}
      />
    );
  } else if (active === "Contacts & Outreach") {
    view = (
      <ContactsView
        leads={leads}
        onSelectLead={setSelectedLead}
        onTriggerVerification={handleTriggerVerification}
      />
    );
  } else if (active === "Discover Leads") {
    view = (
      <Discover
        onNavigate={navigate}
        onJobStarted={(jobId) => {
          setActiveJobId(jobId);
          fetchJobs();
        }}
      />
    );
  } else if (active === "Verification Jobs") {
    view = (
      <Jobs
        jobs={jobs}
        activeJobId={activeJobId}
        setActiveJobId={setActiveJobId}
        liveLogs={liveLogs}
        onTriggerBatchVerify={() => handleTriggerVerification()}
      />
    );
  } else if (active === "Settings") {
    view = <SettingsView totalLeadsCount={leads.length} user={user} />;
  }

  if (selectedLead) {
    view = (
      <LeadDetail
        id={selectedLead}
        onBack={() => setSelectedLead(null)}
        onTriggerVerification={handleTriggerVerification}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeJobsCount={activeJobsCount}
        user={user}
        onLogout={handleLogout}
      />
      <main className="main">
        <header className="topbar">
          <button
            className="menu-button icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="topbar-title">
            <span>CLDS</span>
            <ChevronRight />
            <strong>{selectedLead ? "Lead Detail" : active}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search />
              <span>Search workspace</span>
              <kbd>⌘ K</kbd>
            </div>
            <button
              className="icon-button"
              onClick={() => {
                fetchLeads();
                fetchJobs();
              }}
              title="Refresh data"
            >
              <RefreshCw />
            </button>
            <div
              className="top-avatar"
              title={`${user?.name || "Aditya Katyal"} (${user?.email || "adityakatyal45678@gmail.com"})`}
              style={{ cursor: "pointer" }}
              onClick={() => navigate("Settings")}
            >
              {user?.name
                ? user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                : "AK"}
            </div>
          </div>
        </header>
        {view}
      </main>
    </div>
  );
}
