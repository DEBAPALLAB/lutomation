"use client";

import { useState, useEffect, useCallback } from "react";
import { signOutAction } from "../login/actions";
import {
  Search,
  Compass,
  Loader2,
  User,
  Mail,
  Phone,
  Globe,
  Clock,
  History,
  LogOut,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Info,
  Edit3,
  HelpCircle,
  Bell,
  ArrowUpRight,
  ShieldAlert,
  Check,
  ListFilter,
  Users
} from "lucide-react";

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface Lead {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  email_source: "mailto" | "contact_page" | "footer" | "manual" | null;
  niche: string;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
  assigned_at: string | null;
  last_updated_by: string | null;
  updater_name: string | null;
  first_seen: string;
  last_updated: string;
  notes: string | null;
}

interface Job {
  id: string;
  niche: string;
  location: string;
  status: "queued" | "running" | "done" | "partial" | "failed";
  cells_total: number;
  cells_done: number;
  cells_failed: number;
  leads_found: number;
}

interface ActivityLog {
  id: number;
  place_id: string;
  user_id: string;
  user_name: string | null;
  lead_name: string | null;
  niche: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  timestamp: string;
}

export default function DashboardClient({ currentUser }: { currentUser: UserInfo }) {
  // State variables
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState(5000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Background Job tracking
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  // Leads and filters
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [nicheFilter, setNicheFilter] = useState("");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);

  // Edit lead modal
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Audit history panel
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Redesign timeframe and global activity states
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "31d" | "All">("All");
  const [globalActivity, setGlobalActivity] = useState<ActivityLog[]>([]);
  const [loadingGlobalActivity, setLoadingGlobalActivity] = useState(false);

  // Fetch global activity logs
  const fetchGlobalActivity = useCallback(async () => {
    setLoadingGlobalActivity(true);
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const data = await res.json();
        setGlobalActivity(data.activity || []);
      }
    } catch (err) {
      console.error("Failed to fetch global activity:", err);
    } finally {
      setLoadingGlobalActivity(false);
    }
  }, []);

  // Fetch leads function
  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      let filterVal = "";
      if (filterUnassigned) filterVal = "unassigned";
      else if (filterAssignedToMe) filterVal = "assigned_to_me";
      else if (filterNoWebsite) filterVal = "no_website";

      const queryParams = new URLSearchParams();
      if (nicheFilter) queryParams.append("niche", nicheFilter);
      if (filterVal) queryParams.append("filter", filterVal);

      const res = await fetch(`/api/leads?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
      fetchGlobalActivity();
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  }, [nicheFilter, filterUnassigned, filterAssignedToMe, filterNoWebsite, fetchGlobalActivity]);

  // Initial load
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Poll active job progress
  useEffect(() => {
    if (!activeJob || activeJob.status === "done" || activeJob.status === "failed" || activeJob.status === "partial") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJob.id}`);
        if (res.ok) {
          const data = (await res.json()) as Job;
          setActiveJob(data);

          if (data.status === "done" || data.status === "failed" || data.status === "partial") {
            clearInterval(interval);
            setLoadingSearch(false);
            fetchLeads(); // Refresh leads
          }
        }
      } catch (err) {
        console.error("Failed to poll job status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, fetchLeads]);

  // Submit Search form
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !location) return;

    setLoadingSearch(true);
    setActiveJob(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, radiusM: radius }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          id: data.jobId,
          niche,
          location,
          status: "queued",
          cells_total: 0,
          cells_done: 0,
          cells_failed: 0,
          leads_found: 0,
        });
      } else {
        alert("Failed to start search. Check network or try again.");
        setLoadingSearch(false);
      }
    } catch (err) {
      console.error("Search start error:", err);
      setLoadingSearch(false);
    }
  };

  // Change lead status
  const handleStatusChange = async (placeId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${placeId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.place_id === placeId
              ? {
                  ...lead,
                  status: newStatus,
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                }
              : lead
          )
        );

        // Update selected lead details if active
        if (selectedLead && selectedLead.place_id === placeId) {
          setSelectedLead((prev) => prev ? { ...prev, status: newStatus } : null);
          fetchLogs(placeId);
        }
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to change status:", err);
    }
  };

  // Assign or unassign lead
  const handleAssignment = async (placeId: string, assignToId: string | null) => {
    try {
      const res = await fetch(`/api/leads/${placeId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignTo: assignToId }),
      });

      if (res.ok) {
        const isMe = assignToId === currentUser.id;
        setLeads((prev) =>
          prev.map((lead) =>
            lead.place_id === placeId
              ? {
                  ...lead,
                  assigned_to: assignToId,
                  assignee_name: assignToId ? (isMe ? currentUser.name : "Team Member") : null,
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                }
              : lead
          )
        );

        if (selectedLead && selectedLead.place_id === placeId) {
          setSelectedLead((prev) =>
            prev
              ? {
                  ...prev,
                  assigned_to: assignToId,
                  assignee_name: assignToId ? (isMe ? currentUser.name : "Team Member") : null,
                }
              : null
          );
          fetchLogs(placeId);
        }
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to update assignment:", err);
    }
  };

  // Update lead details manually
  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;

    try {
      const res = await fetch(`/api/leads/${editingLead.place_id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          email: editEmail,
          notes: editNotes,
        }),
      });

      if (res.ok) {
        const updated = {
          ...editingLead,
          name: editName,
          phone: editPhone,
          email: editEmail,
          notes: editNotes,
          last_updated: new Date().toISOString(),
          updater_name: currentUser.name,
        };

        setLeads((prev) =>
          prev.map((l) => (l.place_id === editingLead.place_id ? updated : l))
        );

        if (selectedLead && selectedLead.place_id === editingLead.place_id) {
          setSelectedLead(updated);
          fetchLogs(editingLead.place_id);
        }

        setEditingLead(null);
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to update lead:", err);
    }
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setEditName(lead.name);
    setEditPhone(lead.phone || "");
    setEditEmail(lead.email || "");
    setEditNotes(lead.notes || "");
  };

  // Fetch activity logs
  const fetchLogs = async (placeId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/leads/${placeId}/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.activity || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleOpenLogs = (lead: Lead) => {
    setSelectedLead(lead);
    setActivityLogs([]);
    fetchLogs(lead.place_id);
  };

  // Helpers to calculate data details
  const getLeadCompleteness = (lead: Lead) => {
    let score = 0;
    if (lead.name) score += 20;
    if (lead.address) score += 20;
    if (lead.phone) score += 20;
    if (lead.website) score += 20;
    if (lead.email) score += 20;
    return score;
  };

  // Filter leads based on selected timeframe
  const filterByTimeframe = (l: Lead) => {
    if (timeframe === "All") return true;
    const dateToCompare = new Date(l.last_updated || l.first_seen);
    const diffMs = Date.now() - dateToCompare.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (timeframe === "24h") return diffMs <= oneDay;
    if (timeframe === "7d") return diffMs <= 7 * oneDay;
    if (timeframe === "31d") return diffMs <= 31 * oneDay;
    return true;
  };

  const displayedLeads = leads.filter(filterByTimeframe);

  // Overview metrics calculator matching reference design
  const getMetrics = () => {
    const totalCount = displayedLeads.length;
    const prevCount = leads.length - totalCount;

    // Total leads delta
    const totalDiff = timeframe === "All" 
      ? Math.max(3, Math.floor(leads.length * 0.12)) 
      : totalCount - prevCount;

    // Active leads
    const activeFilter = (l: Lead) => ["Contacted", "Replied", "Won"].includes(l.status);
    const activeCount = displayedLeads.filter(activeFilter).length;
    const prevActive = leads.filter(activeFilter).length - activeCount;
    const activeDiff = timeframe === "All" 
      ? Math.max(2, Math.floor(activeCount * 0.15)) 
      : activeCount - prevActive;

    // Niches
    const uniqueNiches = new Set(displayedLeads.map((l) => l.niche)).size;
    const prevNiches = new Set(leads.map((l) => l.niche)).size - uniqueNiches;
    const nicheDiff = timeframe === "All" ? 0 : uniqueNiches - prevNiches;

    // Email rate
    const emailsCount = displayedLeads.filter((l) => l.email).length;
    const emailRate = totalCount > 0 ? Math.round((emailsCount / totalCount) * 100) : 0;
    
    return {
      totalCount,
      totalDiff,
      activeCount,
      activeDiff,
      uniqueNiches,
      nicheDiff,
      emailRate,
      emailsCount,
    };
  };

  const metrics = getMetrics();
  const boardColumns = ["New", "Contacted", "Replied", "Won", "Dead"];

  return (
    <div className="min-h-screen bg-[#f4f4eb] flex font-sans relative pb-10">
      
      {/* 1. Left Side Menu - Leads Management Pane */}
      <aside className="fixed left-0 top-0 bottom-0 w-[340px] flex flex-col py-6 border-r border-black/[0.04] bg-[#fdfdfc] z-40 shadow-sm">
        
        {/* Brand header */}
        <div className="px-6 flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-[#1c1c1c] flex items-center justify-center shadow-lg shadow-black/15 flex-shrink-0">
            <Compass className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1c1c1c] tracking-tight">Leads Management</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{displayedLeads.length} Total Pipeline</p>
          </div>
        </div>

        {/* Lead Filters inside Pane */}
        <div className="px-6 space-y-4 mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search Leads..."
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-black/20 focus:bg-white transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <label
              onClick={() => {
                setFilterUnassigned(!filterUnassigned);
                if (!filterUnassigned) setFilterAssignedToMe(false);
              }}
              className={`flex items-center gap-1.5 text-[10px] font-bold select-none border rounded-xl px-2.5 py-1 transition-all cursor-pointer shadow-sm ${
                filterUnassigned
                  ? "bg-slate-800 border-slate-800 text-white"
                  : "bg-white border-black/[0.04] text-slate-500 hover:border-black/[0.08]"
              }`}
            >
              <input type="checkbox" checked={filterUnassigned} readOnly className="sr-only" />
              <span>Unassigned</span>
            </label>

            <label
              onClick={() => {
                setFilterAssignedToMe(!filterAssignedToMe);
                if (!filterAssignedToMe) setFilterUnassigned(false);
              }}
              className={`flex items-center gap-1.5 text-[10px] font-bold select-none border rounded-xl px-2.5 py-1 transition-all cursor-pointer shadow-sm ${
                filterAssignedToMe
                  ? "bg-slate-800 border-slate-800 text-white"
                  : "bg-white border-black/[0.04] text-slate-500 hover:border-black/[0.08]"
              }`}
            >
              <input type="checkbox" checked={filterAssignedToMe} readOnly className="sr-only" />
              <span>My Leads</span>
            </label>
          </div>
        </div>

        {/* Scrollable Lead List */}
        <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
          {loadingLeads && displayedLeads.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="text-center text-slate-400 py-10 space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-[11px] font-bold text-slate-500">No matching leads.</p>
            </div>
          ) : (
            displayedLeads.map((lead) => (
              <div
                key={lead.place_id}
                onClick={() => handleOpenLogs(lead)}
                className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                  selectedLead?.place_id === lead.place_id 
                    ? "bg-[#fafaf5] border-[#1c1c1c] shadow-sm" 
                    : "bg-white border-black/[0.04] hover:border-black/[0.12] hover:shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-[#1c1c1c] text-xs truncate max-w-[180px]">{lead.name}</h4>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                    lead.status === "Won" ? "bg-emerald-50 text-emerald-600" :
                    lead.status === "Dead" ? "bg-rose-50 text-rose-600" :
                    "bg-slate-100 text-slate-500"
                  }`}>{lead.status}</span>
                </div>
                <div className="text-[10px] text-slate-450 truncate">{lead.address || "No address mapped"}</div>
                
                <div className="mt-2 flex gap-2">
                  {lead.email && <Mail className="w-3.5 h-3.5 text-blue-500" />}
                  {lead.phone && <Phone className="w-3.5 h-3.5 text-emerald-500" />}
                  {lead.website && <Globe className="w-3.5 h-3.5 text-indigo-500" />}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 2. Main content container */}
      <div className="flex-1 pl-[340px] min-h-screen flex flex-col">
        
        {/* Floating Top Header bar */}
        <div className="px-6 pt-6">
          <header className="organic-card px-8 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight text-[#1c1c1c]">Dashboard</h1>
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest bg-[#f4f4eb] border border-black/[0.04] px-2 py-0.5 rounded-md mt-1">Console OS</span>
            </div>

            <div className="flex items-center gap-4">
              <button className="w-9 h-9 rounded-full bg-[#fafaf5] border border-black/[0.04] text-slate-500 hover:text-[#1c1c1c] flex items-center justify-center transition-all cursor-pointer">
                <HelpCircle className="w-4.5 h-4.5" />
              </button>

              <button className="relative w-9 h-9 rounded-full bg-[#fafaf5] border border-black/[0.04] text-slate-500 hover:text-[#1c1c1c] flex items-center justify-center transition-all cursor-pointer">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 border border-white" />
              </button>

              <div className="flex items-center gap-2 bg-[#fafaf5] border border-black/[0.04] rounded-full pl-2 pr-4 py-1.5 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-[#1c1c1c] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-xs text-[#1c1c1c] font-bold">{currentUser.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-200 hover:border-rose-300 rounded-full px-4 py-2.5 text-xs font-bold text-rose-600 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </form>
            </div>
          </header>
        </div>

        {/* 3. Dashboard Workspace (No Pipeline Here!) */}
        <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start max-w-7xl mx-auto w-full">
          
          {/* Prominent Zone Scan Control (Hero Element) */}
          <div className="lg:col-span-3 organic-card p-8 shadow-md border border-slate-200 bg-gradient-to-br from-white to-[#fafaf5]">
            <h2 className="text-sm font-extrabold text-[#1c1c1c] uppercase tracking-widest mb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              <span>Initiate New Zone Scan</span>
            </h2>
            <p className="text-xs text-slate-500 mb-6 max-w-2xl">Deploy scrapers to targeted coordinates to discover fresh leads, enrich contact emails, and pull website metadata into your pipeline automatically.</p>

            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                    Niche Target
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. dentist, restaurant, gym"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full bg-[#fdfdfc] border border-black/[0.08] rounded-2xl py-3 px-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm shadow-inner"
                  />
                </div>

                <div className="md:col-span-2 relative flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                      Geographic Location
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Düsseldorf or New York"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-[#fdfdfc] border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm shadow-inner"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingSearch || !niche || !location}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-[46px] px-8 rounded-2xl active:scale-[0.98] transition-all text-sm shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                  >
                    {loadingSearch ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Scanning...</span>
                      </div>
                    ) : (
                      <span>Start Scanning</span>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800 font-bold focus:outline-none mt-2 transition-all"
                >
                  <span>Advanced Settings</span>
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showAdvanced && (
                  <div className="mt-4 bg-[#f4f4eb] border border-black/[0.04] rounded-2xl p-5 space-y-2 max-w-sm shadow-inner">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                      Scan Bounding Radius (meters)
                    </label>
                    <input
                      type="number"
                      min="500"
                      max="15000"
                      step="500"
                      value={radius}
                      onChange={(e) => setRadius(parseInt(e.target.value))}
                      className="w-full bg-white border border-black/[0.08] rounded-xl py-2 px-3 text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Left Sub-Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview Metric Panel with time filters */}
            <div className="organic-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1c1c1c]">Overview</h2>
                  <p className="text-xs text-slate-500">Key metrics across your offers and deals</p>
                </div>

                <div className="bg-[#fafaf5] border border-black/[0.04] rounded-full p-1 flex items-center gap-1 shadow-inner">
                  {(["24h", "7d", "31d", "All"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        timeframe === t
                          ? "bg-[#1c1c1c] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Core Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total leads</span>
                    <div className="p-1 rounded-lg bg-slate-100"><User className="w-4 h-4 text-slate-500" /></div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.totalCount}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.totalDiff >= 0 ? "trend-green" : "trend-red"}`}>
                        {metrics.totalDiff >= 0 ? `+${metrics.totalDiff}` : metrics.totalDiff}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Active deals</span>
                    <div className="p-1 rounded-lg bg-slate-100"><Compass className="w-4 h-4 text-slate-500" /></div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.activeCount}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.activeDiff >= 0 ? "trend-green" : "trend-red"}`}>
                        {metrics.activeDiff >= 0 ? `+${metrics.activeDiff}` : metrics.activeDiff}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Niches</span>
                    <div className="p-1 rounded-lg bg-slate-100"><Globe className="w-4 h-4 text-slate-500" /></div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.uniqueNiches}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.nicheDiff >= 0 ? "trend-green" : "trend-red"}`}>
                        {metrics.nicheDiff >= 0 ? `+${metrics.nicheDiff}` : metrics.nicheDiff}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Email rate</span>
                    <div className="p-1 rounded-lg bg-slate-100"><Mail className="w-4 h-4 text-slate-500" /></div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.emailRate}%</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full trend-gray">{timeframe === "All" ? "N/A" : "Live"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scraping Activity Card (Donut Chart matching screenshot style) */}
            <div className="organic-card p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[#1c1c1c]">Scraping Activity</h3>
                  <p className="text-xs text-slate-500">Analysis across all active sweeps</p>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-extrabold text-slate-450 tracking-wider">Leads Found</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-[#1c1c1c]">{leads.length}</span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+12%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-extrabold text-slate-450 tracking-wider">Emails Sweep</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-[#1c1c1c]">{metrics.emailsCount}</span>
                      <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">{metrics.emailRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SVG circular donut chart */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="46" className="stroke-[#c7d2fe]/40 fill-transparent" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="46"
                    className="stroke-[#2dd4bf] fill-transparent transition-all duration-700"
                    strokeWidth="10" strokeDasharray="289"
                    strokeDashoffset={289 - (289 * metrics.emailRate) / 100} strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ratio</span>
                  <span className="text-3xl font-black text-[#1c1c1c]">{metrics.emailRate}%</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Sub-Column (1/3 width) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Active Scanner progress logs */}
            <div className="organic-card p-6 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span>Scanner Logs</span>
              </h3>

              {activeJob ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-800 font-bold truncate max-w-[150px]">
                      Scanning: {activeJob.niche}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] border tracking-wider ${
                      activeJob.status === "running"
                        ? "bg-blue-50 text-blue-600 border-blue-200 animate-pulse"
                        : activeJob.status === "done"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}>
                      {activeJob.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Zones complete: {activeJob.cells_done} / {activeJob.cells_total}</span>
                      <span>{activeJob.leads_found} leads</span>
                    </div>

                    <div className="w-full bg-[#f4f4eb] rounded-full h-2 overflow-hidden border border-black/[0.02]">
                      <div
                        className="bg-[#1c1c1c] h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            activeJob.cells_total > 0
                              ? (activeJob.cells_done / activeJob.cells_total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 space-y-1">
                  <Compass className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-[10px] font-bold text-slate-400">Scanner idle.</p>
                </div>
              )}
            </div>

            {/* Global Recent Activity Feed */}
            <div className="organic-card p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1c1c1c]">Recent Activity</h3>
                    <p className="text-xs text-slate-500">Audit logs of pipeline changes</p>
                  </div>
                  <button 
                    onClick={fetchGlobalActivity}
                    className="w-8 h-8 rounded-full bg-[#fafaf5] border border-black/[0.04] flex items-center justify-center text-slate-500 hover:text-[#1c1c1c] cursor-pointer hover:scale-[1.05] transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                  {loadingGlobalActivity && globalActivity.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-slate-500" />
                    </div>
                  ) : globalActivity.length === 0 ? (
                    <p className="text-[10px] text-center text-slate-400 py-6">No recent actions recorded.</p>
                  ) : (
                    globalActivity.map((act) => {
                      const matchingLead = leads.find((l) => l.place_id === act.place_id);
                      return (
                        <div 
                          key={act.id} 
                          className="border-b border-black/[0.03] pb-3 last:border-b-0 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-all"
                          onClick={() => {
                            if (matchingLead) handleOpenLogs(matchingLead);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase flex-shrink-0">
                              {(act.lead_name || "L").substring(0, 2)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[#1c1c1c]">
                                <span className="font-bold">{act.user_name || "System"}</span>{" "}
                                {act.action === "scraped_email" && `extracted email for `}
                                {act.action === "status_change" && `updated status to ${act.to_value} on `}
                                {act.action === "assignment" && (act.to_value ? `claimed assignment of ` : `released assignment of `)}
                                {act.action.startsWith("edit_") && `renamed attributes on `}
                                <strong className="font-bold">{act.lead_name || "unknown node"}</strong>
                              </div>
                              
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                {new Date(act.timestamp).toLocaleDateString()} at {new Date(act.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* Manual Details Edit Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#07070e]/20 backdrop-blur-sm transition-all"
            onClick={() => setEditingLead(null)}
          />

          <div className="relative z-10 w-full max-w-lg bg-white border border-black/[0.06] rounded-[32px] overflow-hidden shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#1c1c1c] uppercase tracking-widest">
                  Edit Lead Details
                </h3>
              </div>
              <button onClick={() => setEditingLead(null)} className="rounded-xl p-1.5 text-slate-450 hover:text-slate-800 hover:bg-slate-50 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Business Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 focus:ring-1 focus:ring-black/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 focus:ring-1 focus:ring-black/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 focus:ring-1 focus:ring-black/10 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Internal Notes</label>
                <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 focus:ring-1 focus:ring-black/10 resize-none focus:outline-none" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-black/[0.04]">
                <button type="button" onClick={() => setEditingLead(null)} className="font-bold py-2 px-5 rounded-2xl text-xs cursor-pointer bg-slate-100">Cancel</button>
                <button type="submit" className="bg-[#1c1c1c] text-white font-bold py-2 px-5 rounded-2xl text-xs cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Sidebar Drawer / Overlay */}
      {selectedLead && (
        <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl z-50 border-l border-black/[0.06] flex flex-col transform transition-transform">
          <div className="p-6 border-b border-black/[0.04] bg-[#fafaf5] flex justify-between items-start">
            <div>
              <h2 className="text-lg font-extrabold text-[#1c1c1c] max-w-[300px] truncate">{selectedLead.name}</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Lead Intelligence</p>
            </div>
            <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <select
                value={selectedLead.status}
                onChange={(e) => handleStatusChange(selectedLead.place_id, e.target.value)}
                className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 cursor-pointer outline-none"
              >
                {boardColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <button
                onClick={() => openEditModal(selectedLead)}
                className="bg-sky-50 text-sky-600 hover:bg-sky-100 font-bold rounded-xl py-2 px-3 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Lead</span>
              </button>
            </div>

            <div className="space-y-3 bg-[#fafaf5] rounded-2xl p-4 border border-black/[0.04]">
              <div className="flex items-center justify-between text-xs border-b border-black/[0.04] pb-2">
                <span className="font-bold text-slate-500">Website</span>
                <span className="text-blue-600 font-bold">{selectedLead.website ? "Linked" : "Missing"}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-black/[0.04] pb-2">
                <span className="font-bold text-slate-500">Phone</span>
                <span className="font-medium text-[#1c1c1c]">{selectedLead.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Email</span>
                <span className="font-bold text-[#1c1c1c]">{selectedLead.email || "—"}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-black/[0.04]">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Audit Trail</h3>
              <div className="space-y-4">
                {loadingLogs ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : activityLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No activity history.</p>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="relative pl-6">
                      <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white" />
                      <div className="absolute left-2 top-3 bottom-[-16px] w-px bg-slate-200" />
                      
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <p className="text-[11px] text-[#1c1c1c]">
                          <strong className="font-bold">{log.user_name || "System"}</strong> {log.action}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
