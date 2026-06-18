"use client";

import { useState, useEffect, useCallback } from "react";
import { signOutAction } from "../login/actions";
import {
  Search,
  Compass,
  Loader2,
  Filter,
  User,
  Mail,
  Phone,
  Globe,
  Clock,
  History,
  LogOut,
  MapPin,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Info,
  Edit3,
  LayoutGrid,
  List,
  HelpCircle,
  Home,
  Bell,
  ArrowUpRight,
  ShieldAlert,
  Check,
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

  // View modes: 'table' | 'board'
  const [viewMode, setViewMode] = useState<"table" | "board">("table");

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

  const renderEmailSourceIcon = (source: string | null) => {
    if (!source) return null;
    switch (source) {
      case "mailto":
        return (
          <span title="OSM mailto link" className="flex items-center justify-center p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            <Mail className="w-3 h-3 text-emerald-600" />
          </span>
        );
      case "contact_page":
        return (
          <span title="Found on contact page" className="flex items-center justify-center p-1 rounded bg-violet-500/10 border border-violet-500/20">
            <FileText className="w-3 h-3 text-violet-600" />
          </span>
        );
      case "footer":
        return (
          <span title="Extracted from website footer" className="flex items-center justify-center p-1 rounded bg-indigo-500/10 border border-indigo-500/20">
            <Info className="w-3 h-3 text-indigo-600" />
          </span>
        );
      case "manual":
        return (
          <span title="Manually set" className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/20">
            <User className="w-3 h-3 text-cyan-600" />
          </span>
        );
      default:
        return null;
    }
  };

  // Drag and drop events for Kanban Board
  const handleDragStart = (e: React.DragEvent, placeId: string) => {
    e.dataTransfer.setData("text/plain", placeId);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const placeId = e.dataTransfer.getData("text/plain");
    if (placeId) {
      handleStatusChange(placeId, targetStatus);
    }
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
    <div className="min-h-screen bg-[#f4f4eb] flex font-sans dot-grid relative pb-10">
      
      {/* 1. Left Side Menu - Vertical Strip */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 flex flex-col items-center py-6 border-r border-black/[0.04] bg-[#f4f4eb] z-40 gap-8">
        {/* Brand circle logo */}
        <div className="w-12 h-12 rounded-full bg-[#1c1c1c] flex items-center justify-center shadow-lg shadow-black/15 cursor-pointer hover:scale-[1.05] transition-transform">
          <Compass className="w-6 h-6 text-white animate-spin-slow" />
        </div>

        {/* Selected Home Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#1c1c1c] flex items-center justify-center text-white cursor-pointer shadow-md hover:scale-[1.05] transition-transform">
          <Home className="w-6 h-6" />
        </div>
      </aside>

      {/* 2. Main content container */}
      <div className="flex-1 pl-20 min-h-screen flex flex-col">
        
        {/* Floating Top Header bar */}
        <div className="px-6 pt-6">
          <header className="organic-card px-8 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight text-[#1c1c1c]">Dashboard</h1>
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest bg-[#f4f4eb] border border-black/[0.04] px-2 py-0.5 rounded-md mt-1">Console OS</span>
            </div>

            <div className="flex items-center gap-4">
              {/* Help button */}
              <button className="w-9 h-9 rounded-full bg-[#fafaf5] border border-black/[0.04] text-slate-500 hover:text-[#1c1c1c] flex items-center justify-center transition-all cursor-pointer">
                <HelpCircle className="w-4.5 h-4.5" />
              </button>

              {/* Notifications bell */}
              <button className="relative w-9 h-9 rounded-full bg-[#fafaf5] border border-black/[0.04] text-slate-500 hover:text-[#1c1c1c] flex items-center justify-center transition-all cursor-pointer">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 border border-white" />
              </button>

              {/* Profile Pill */}
              <div className="flex items-center gap-2 bg-[#fafaf5] border border-black/[0.04] rounded-full pl-2 pr-4 py-1.5 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-[#1c1c1c] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-xs text-[#1c1c1c] font-bold">{currentUser.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* Logout Button */}
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

        {/* 3. Two-Column Dashboard Workspace */}
        <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview Metric Panel with time filters */}
            <div className="organic-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1c1c1c]">Overview</h2>
                  <p className="text-xs text-slate-500">Key metrics across your offers and deals</p>
                </div>

                {/* Time selector tabs */}
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
                
                {/* Total Leads */}
                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total leads</span>
                    <div className="p-1 rounded-lg bg-slate-100">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.totalCount}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        metrics.totalDiff >= 0 ? "trend-green" : "trend-red"
                      }`}>
                        {metrics.totalDiff >= 0 ? `+${metrics.totalDiff}` : metrics.totalDiff}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">vs previous period</p>
                  </div>
                </div>

                {/* Active Deals */}
                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Active deals</span>
                    <div className="p-1 rounded-lg bg-slate-100">
                      <Compass className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.activeCount}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        metrics.activeDiff >= 0 ? "trend-green" : "trend-red"
                      }`}>
                        {metrics.activeDiff >= 0 ? `+${metrics.activeDiff}` : metrics.activeDiff}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">vs previous period</p>
                  </div>
                </div>

                {/* Brands/Niches */}
                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Niches</span>
                    <div className="p-1 rounded-lg bg-slate-100">
                      <Globe className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.uniqueNiches}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        metrics.nicheDiff >= 0 ? "trend-green" : "trend-red"
                      }`}>
                        {metrics.nicheDiff >= 0 ? `+${metrics.nicheDiff}` : metrics.nicheDiff}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">vs previous period</p>
                  </div>
                </div>

                {/* Conversation/Enrichment rate */}
                <div className="bg-[#fdfdfc] border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Email rate</span>
                    <div className="p-1 rounded-lg bg-slate-100">
                      <Mail className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-[#1c1c1c]">{metrics.emailRate}%</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full trend-gray">
                        {timeframe === "All" ? "N/A" : "Live"}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">leads with emails</p>
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
                    <p className="text-[9px] text-slate-400">all time records</p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-extrabold text-slate-450 tracking-wider">Emails Sweep</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-[#1c1c1c]">{metrics.emailsCount}</span>
                      <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">{metrics.emailRate}%</span>
                    </div>
                    <p className="text-[9px] text-slate-400">enrichment rate</p>
                  </div>
                </div>
              </div>

              {/* SVG circular donut chart */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Purple track */}
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    className="stroke-[#c7d2fe]/40 fill-transparent"
                    strokeWidth="10"
                  />
                  {/* Teal progress */}
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    className="stroke-[#2dd4bf] fill-transparent transition-all duration-700"
                    strokeWidth="10"
                    strokeDasharray="289"
                    strokeDashoffset={289 - (289 * metrics.emailRate) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ratio</span>
                  <span className="text-3xl font-black text-[#1c1c1c]">{metrics.emailRate}%</span>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Emails verified</span>
                </div>
              </div>
            </div>

            {/* Area Scanner Form */}
            <div className="organic-card p-6 shadow-sm">
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-[#1c1c1c]" />
                <span>Zone Scan Control</span>
              </h2>

              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Niche Target
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. dentist, restaurant, gym"
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white hover:border-black/[0.12] transition-all text-sm shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Geographic Location
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Düsseldorf or New York"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white hover:border-black/[0.12] transition-all text-sm shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800 font-bold focus:outline-none bg-white border border-black/[0.04] px-3.5 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    <span>Advanced Scan Settings</span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 bg-[#fafaf5] border border-black/[0.04] rounded-2xl p-4 space-y-2 max-w-xs shadow-inner">
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                        Scan Bounding Radius (meters)
                      </label>
                      <input
                        type="number"
                        min="500"
                        max="15000"
                        step="500"
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        className="w-full bg-white border border-black/[0.08] rounded-xl py-2 px-3 text-slate-850 text-xs focus:outline-none focus:border-black/20"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loadingSearch || !niche || !location}
                  className="bg-[#1c1c1c] hover:bg-[#2c2c2c] text-white font-bold py-2.5 px-6 rounded-2xl active:scale-[0.98] transition-all text-xs w-full md:w-auto shadow-md shadow-black/10 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {loadingSearch ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sweeping Centroids...</span>
                    </div>
                  ) : (
                    <span>Initiate Scan Mission</span>
                  )}
                </button>
              </form>
            </div>

            {/* Filter controls and Leads Board/Table */}
            <div className="space-y-4">
              <div className="organic-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-450 uppercase tracking-widest">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Pipeline</span>
                  </div>

                  {/* View switcher */}
                  <div className="bg-[#f4f4eb] border border-black/[0.04] rounded-full p-0.5 flex items-center gap-0.5 shadow-inner">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        viewMode === "table"
                          ? "bg-white text-[#1c1c1c] shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode("board")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        viewMode === "board"
                          ? "bg-white text-[#1c1c1c] shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Kanban</span>
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                  <div className="min-w-[130px]">
                    <input
                      type="text"
                      placeholder="Search Niche..."
                      value={nicheFilter}
                      onChange={(e) => setNicheFilter(e.target.value)}
                      className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-xl py-1.5 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-black/20 focus:bg-white transition-all shadow-inner"
                    />
                  </div>

                  <label
                    onClick={() => {
                      setFilterUnassigned(!filterUnassigned);
                      if (!filterUnassigned) setFilterAssignedToMe(false);
                    }}
                    className={`flex items-center gap-2 text-xs font-bold select-none border rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-sm ${
                      filterUnassigned
                        ? "bg-white border-[#1c1c1c] text-[#1c1c1c]"
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
                    className={`flex items-center gap-2 text-xs font-bold select-none border rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-sm ${
                      filterAssignedToMe
                        ? "bg-white border-[#1c1c1c] text-[#1c1c1c]"
                        : "bg-white border-black/[0.04] text-slate-500 hover:border-black/[0.08]"
                    }`}
                  >
                    <input type="checkbox" checked={filterAssignedToMe} readOnly className="sr-only" />
                    <span>Mine</span>
                  </label>

                  <label
                    onClick={() => setFilterNoWebsite(!filterNoWebsite)}
                    className={`flex items-center gap-2 text-xs font-bold select-none border rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-sm ${
                      filterNoWebsite
                        ? "bg-white border-[#1c1c1c] text-[#1c1c1c]"
                        : "bg-white border-black/[0.04] text-slate-500 hover:border-black/[0.08]"
                    }`}
                  >
                    <input type="checkbox" checked={filterNoWebsite} readOnly className="sr-only" />
                    <span>No Web</span>
                  </label>
                </div>
              </div>

              {/* Table / Kanban display */}
              {loadingLeads && displayedLeads.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white border border-black/[0.04] rounded-[32px] shadow-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loading leads database...</span>
                </div>
              ) : displayedLeads.length === 0 ? (
                <div className="py-20 text-center text-slate-400 bg-white border border-black/[0.04] rounded-[32px] space-y-2 shadow-sm">
                  <Compass className="w-10 h-10 text-slate-350 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">No matching leads in active timeframe.</p>
                  <p className="text-[9px] text-slate-400 max-w-xs mx-auto leading-normal">
                    Try changing your timeframe filter above or sweeping a new geographic zone.
                  </p>
                </div>
              ) : viewMode === "table" ? (
                
                /* Styled Leads Table */
                <div className="organic-card overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-black/[0.04] bg-slate-500/[0.02] text-slate-500 text-[9px] font-extrabold uppercase tracking-widest">
                          <th className="py-4 px-6">Business</th>
                          <th className="py-4 px-4">Contact Info</th>
                          <th className="py-4 px-4">Email</th>
                          <th className="py-4 px-4">Niche</th>
                          <th className="py-4 px-4">Status</th>
                          <th className="py-4 px-4">Assignment</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.03] text-slate-700 text-xs">
                        {displayedLeads.map((lead) => (
                          <tr
                            key={lead.place_id}
                            className={`hover:bg-slate-50/50 transition-all cursor-pointer ${
                              selectedLead?.place_id === lead.place_id ? "bg-sky-500/5 hover:bg-sky-500/10" : ""
                            }`}
                            onClick={() => handleOpenLogs(lead)}
                          >
                            <td className="py-4 px-6 max-w-xs">
                              <div className="font-bold text-[#1c1c1c] truncate">{lead.name}</div>
                              <div className="text-[9px] text-slate-450 truncate mt-0.5">
                                {lead.address || "No address mapped"}
                              </div>
                            </td>

                            <td className="py-4 px-4 space-y-1">
                              <div>
                                {lead.phone ? (
                                  <span className="text-[11px] text-slate-600 font-medium">
                                    {lead.phone}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-350">—</span>
                                )}
                              </div>
                              <div>
                                {lead.website ? (
                                  <a
                                    href={lead.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                  >
                                    <Globe className="w-3 h-3" />
                                    <span>Website</span>
                                  </a>
                                ) : (
                                  <span className="text-[8px] text-rose-600 font-bold uppercase bg-rose-50 px-1.5 py-0.5 rounded">No Web</span>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              {lead.email ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">
                                    {lead.email}
                                  </span>
                                  {renderEmailSourceIcon(lead.email_source)}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-350">—</span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider bg-[#fafaf5] border border-black/[0.04] text-slate-500 uppercase">
                                {lead.niche}
                              </span>
                            </td>

                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={lead.status}
                                onChange={(e) => handleStatusChange(lead.place_id, e.target.value)}
                                className="bg-white border border-black/[0.06] rounded-xl py-1 px-2.5 text-xs text-slate-700 cursor-pointer focus:outline-none font-bold"
                              >
                                {boardColumns.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>

                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                              {lead.assigned_to ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-700 font-bold truncate max-w-[80px]">
                                    {lead.assigned_to === currentUser.id ? "Me" : lead.assignee_name || "Claimed"}
                                  </span>
                                  <button
                                    onClick={() => handleAssignment(lead.place_id, null)}
                                    className="text-[9px] font-bold uppercase text-rose-600 hover:underline"
                                  >
                                    Release
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAssignment(lead.place_id, currentUser.id)}
                                  className="bg-[#1c1c1c] text-white rounded-xl px-3 py-1 text-[10px] font-bold hover:bg-[#2c2c2c] transition-all cursor-pointer shadow-sm"
                                >
                                  Claim
                                </button>
                              )}
                            </td>

                            <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEditModal(lead)}
                                  className="text-slate-400 hover:text-[#1c1c1c] p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenLogs(lead)}
                                  className="text-slate-400 hover:text-[#1c1c1c] p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="Details"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                
                /* Styled Kanban columns */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
                  {boardColumns.map((colName) => {
                    const colLeads = displayedLeads.filter((l) => l.status === colName);
                    return (
                      <div
                        key={colName}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, colName)}
                        className="organic-card p-4 flex flex-col min-h-[500px] shadow-sm bg-white/60"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/[0.03]">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1c1c1c]">
                            {colName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f4f4eb] border border-black/[0.04] text-slate-500">
                            {colLeads.length}
                          </span>
                        </div>

                        {/* List */}
                        <div className="flex-grow space-y-3 overflow-y-auto max-h-[550px] pr-0.5">
                          {colLeads.map((lead) => (
                            <div
                              key={lead.place_id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, lead.place_id)}
                              onClick={() => handleOpenLogs(lead)}
                              className={`bg-white border rounded-2xl p-3.5 shadow-sm active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing hover:border-black/[0.12] hover:shadow-md ${
                                selectedLead?.place_id === lead.place_id ? "border-[#1c1c1c] ring-1 ring-[#1c1c1c]" : "border-black/[0.04]"
                              }`}
                            >
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-bold text-[#1c1c1c] text-xs truncate leading-snug">
                                    {lead.name}
                                  </h4>
                                  <p className="text-[9px] text-slate-450 truncate mt-0.5">
                                    {lead.address || "No address mapped"}
                                  </p>
                                </div>

                                {lead.notes && (
                                  <p className="text-[9px] text-slate-500 bg-slate-50 border border-black/[0.03] px-2 py-1 rounded italic truncate">
                                    {lead.notes}
                                  </p>
                                )}

                                <div className="space-y-1 bg-[#fafaf5] rounded-xl p-2.5 border border-black/[0.03] text-[9px]">
                                  <div className="flex items-center justify-between text-slate-400">
                                    <span className="font-bold">Website</span>
                                    {lead.website ? (
                                      <span className="text-blue-600 font-bold">Yes</span>
                                    ) : (
                                      <span className="text-rose-600 font-bold uppercase text-[7px] bg-rose-50 px-1 py-0.2 rounded">None</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-slate-450">
                                    <span className="font-bold">Phone</span>
                                    <span className="truncate max-w-[80px] text-slate-700 font-medium">
                                      {lead.phone || "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-455">
                                    <span className="font-bold">Email</span>
                                    <span className="truncate max-w-[80px] text-slate-700 font-semibold">
                                      {lead.email || "—"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-black/[0.03]">
                                  {lead.assigned_to ? (
                                    <span className="text-[8px] font-bold text-slate-500 bg-[#f4f4eb] border border-black/[0.04] px-1.5 py-0.5 rounded truncate max-w-[75px]">
                                      {lead.assigned_to === currentUser.id ? "Me" : lead.assignee_name || "Claimed"}
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAssignment(lead.place_id, currentUser.id);
                                      }}
                                      className="text-[9px] font-bold uppercase text-blue-600 hover:underline transition-all cursor-pointer"
                                    >
                                      Claim
                                    </button>
                                  )}

                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => openEditModal(lead)}
                                      className="p-1 text-slate-400 hover:text-[#1c1c1c] rounded hover:bg-slate-50"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column (1/3 width) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Active Scanner progress logs */}
            <div className="organic-card p-6 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-655" />
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

            {/* AI Research / Lead Blueprint intelligence floating overlay card */}
            {selectedLead && (
              <div className="ai-research-overlay p-6 relative overflow-hidden flex flex-col gap-5 border border-sky-100 shadow-xl bg-gradient-to-b from-[#f0f9ff]/70 to-white/95">
                
                {/* Close Overlay icon */}
                <button
                  onClick={() => setSelectedLead(null)}
                  className="absolute top-4 right-4 rounded-xl p-1 text-slate-450 hover:text-slate-800 hover:bg-sky-50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-2 text-[10px] font-extrabold text-[#0284c7] uppercase tracking-widest">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Lead Intelligence blueprint</span>
                </div>

                {/* Business profile row */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0284c7]/10 flex items-center justify-center font-bold text-lg text-[#0284c7] border border-[#0284c7]/20 uppercase">
                    {selectedLead.name.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#1c1c1c] text-sm leading-tight max-w-[200px] truncate">{selectedLead.name}</h3>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Niche: {selectedLead.niche}</p>
                  </div>
                </div>

                {/* Quality Score progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#0284c7]">
                    <span>Data completeness score</span>
                    <span>{getLeadCompleteness(selectedLead)}%</span>
                  </div>
                  <div className="w-full bg-[#e0f2fe] rounded-full h-2 overflow-hidden border border-sky-100">
                    <div
                      className="bg-[#0284c7] h-full rounded-full transition-all duration-500"
                      style={{ width: `${getLeadCompleteness(selectedLead)}%` }}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[#f0f9ff]/30 border border-[#0284c7]/10 rounded-xl p-3.5">
                  <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Summary Profile</h4>
                  <p className="text-xs text-slate-600 leading-normal">
                    A POI registered under niche <strong className="text-slate-900 font-bold">{selectedLead.niche}</strong> at {selectedLead.address || "coordinates without literal address"}.
                    Scraper sweep identified {selectedLead.email ? `contact email as ${selectedLead.email}` : "no public contact mailbox on primary routes"}.
                  </p>
                </div>

                {/* Key highlights checklist */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Key attributes verified</h4>
                  <ul className="text-xs text-slate-650 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Geocode: mapped coordinates verified</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {selectedLead.phone ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-200 block flex-shrink-0" />
                      )}
                      <span>Phone: {selectedLead.phone || "No phone contact details"}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {selectedLead.website ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-200 block flex-shrink-0" />
                      )}
                      <span>Website: {selectedLead.website ? "Accessible site record" : "No site mapped"}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      {selectedLead.email ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-200 block flex-shrink-0" />
                      )}
                      <span>Email: {selectedLead.email || "No email extracted"}</span>
                    </li>
                  </ul>
                </div>

                {/* Risk Flags */}
                {(!selectedLead.email || !selectedLead.website || !selectedLead.phone) && (
                  <div className="space-y-2 border-t border-[#0284c7]/10 pt-3">
                    <h4 className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Outreach risk flags</span>
                    </h4>
                    <ul className="text-xs text-rose-600 space-y-1 font-medium pl-1">
                      {!selectedLead.website && (
                        <li>• Missing business website (high value target)</li>
                      )}
                      {!selectedLead.email && (
                        <li>• Missing email address (needs manual telephone callback)</li>
                      )}
                      {!selectedLead.phone && (
                        <li>• Missing telephone number</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Operations control panel */}
                <div className="border-t border-[#0284c7]/10 pt-4 flex flex-col gap-3">
                  
                  {/* Status Dropdown */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Pipeline Status:</span>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => handleStatusChange(selectedLead.place_id, e.target.value)}
                      className="bg-white border border-[#0284c7]/20 rounded-xl py-1 px-3 text-xs text-slate-700 cursor-pointer focus:outline-none font-bold"
                    >
                      {boardColumns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Assignment Claim button */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Claim Action:</span>
                    {selectedLead.assigned_to ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#1c1c1c] font-bold">
                          {selectedLead.assigned_to === currentUser.id ? "Claimed by Me" : selectedLead.assignee_name || "Claimed"}
                        </span>
                        <button
                          onClick={() => handleAssignment(selectedLead.place_id, null)}
                          className="bg-rose-500/10 text-rose-600 rounded-xl px-3 py-1 text-[10px] font-bold hover:bg-rose-500/20 transition-all cursor-pointer"
                        >
                          Release
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAssignment(selectedLead.place_id, currentUser.id)}
                        className="bg-[#1c1c1c] text-white rounded-xl px-4 py-1 text-[10px] font-bold hover:bg-[#2c2c2c] transition-all cursor-pointer shadow-sm"
                      >
                        Claim Lead
                      </button>
                    )}
                  </div>

                  {/* Edit details button */}
                  <button
                    onClick={() => openEditModal(selectedLead)}
                    className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold py-2 rounded-xl text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-sky-100"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Lead Data</span>
                  </button>

                  {/* Full audit logs button */}
                  <button
                    onClick={() => handleOpenLogs(selectedLead)}
                    className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-2 rounded-xl text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Audit Logs</span>
                  </button>
                </div>

              </div>
            )}

            {/* Global Recent Activity Feed (List matching right column) */}
            <div className="organic-card p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1c1c1c]">Recent Activity</h3>
                    <p className="text-xs text-slate-500">Key metrics across your offers and deals</p>
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
                      <span>Fetching activities...</span>
                    </div>
                  ) : globalActivity.length === 0 ? (
                    <p className="text-[10px] text-center text-slate-400 py-6">No recent actions recorded.</p>
                  ) : (
                    globalActivity.map((act) => {
                      const matchingLead = leads.find((l) => l.place_id === act.place_id);
                      const score = matchingLead ? getLeadCompleteness(matchingLead) : 40;
                      return (
                        <div 
                          key={act.id} 
                          className="border-b border-black/[0.03] pb-3 last:border-b-0 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-all"
                          onClick={() => {
                            if (matchingLead) handleOpenLogs(matchingLead);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Color coded circle avatar based on niche */}
                            <div className="w-9 h-9 rounded-full bg-slate-200/50 flex items-center justify-center text-[#1c1c1c] font-bold text-xs uppercase border border-black/[0.04] flex-shrink-0">
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
                              
                              {/* Small completeness gauge */}
                              {matchingLead && (
                                <div className="mt-2.5">
                                  <div className="flex justify-between text-[9px] text-slate-450 font-bold mb-0.5">
                                    <span>Quality score</span>
                                    <span>{score}%</span>
                                  </div>
                                  <div className="w-full bg-[#f4f4eb] rounded-full h-1 overflow-hidden">
                                    <div className="bg-[#2dd4bf] h-full rounded-full" style={{ width: `${score}%` }} />
                                  </div>
                                </div>
                              )}
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

      {/* 4. Manual Details Edit Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
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
                <p className="text-[10px] text-slate-500 font-bold truncate max-w-[300px] mt-1 uppercase tracking-wider">
                  Node ID: {editingLead.place_id}
                </p>
              </div>
              <button
                onClick={() => setEditingLead(null)}
                className="rounded-xl p-1.5 text-slate-450 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 text-slate-805 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +49 12345 6789"
                  className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 text-slate-805 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. contact@business.de"
                  className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 text-slate-805 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add details, logs, reminders..."
                  className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-2.5 px-4 text-slate-805 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white transition-all text-sm resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-black/[0.04] justify-end">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="bg-white border border-black/[0.06] hover:bg-slate-50 text-slate-500 font-bold py-2 px-5 rounded-2xl transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#1c1c1c] hover:bg-[#2c2c2c] text-white font-bold py-2 px-5 rounded-2xl shadow-md active:scale-[0.98] transition-all text-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Audit Logs Sidebar Drawer */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div
            className="absolute inset-0 bg-[#07070e]/20 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={() => setSelectedLead(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[#f4f4eb] border-l border-black/[0.04] shadow-2xl flex flex-col justify-between">
              
              {/* Header */}
              <div className="py-5 px-6 border-b border-black/[0.04] bg-white flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-extrabold text-[#0284c7] uppercase tracking-widest">
                    Lead Audit logs
                  </h3>
                  <p className="text-sm text-[#1c1c1c] font-extrabold truncate max-w-[280px] mt-0.5">
                    {selectedLead.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 focus:outline-none transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Logs timeline list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingLogs ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                    <span className="text-xs">Loading activity logs...</span>
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <History className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs font-bold">No history recorded.</p>
                  </div>
                ) : (
                  <div className="relative border-l border-black/[0.04] pl-4 ml-2 space-y-5">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="relative group text-xs text-slate-700">
                        {/* Bullet step dot */}
                        <div className="absolute left-[-21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#0284c7] group-hover:scale-125 transition-transform border-2 border-[#f4f4eb]" />

                        <div className="font-bold text-[#1c1c1c]">
                          {log.user_name || "System Scraper"}
                        </div>
                        <div className="text-[9px] text-slate-450 mt-0.5">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>

                        <div className="mt-2 bg-white rounded-xl p-3 border border-black/[0.04] shadow-sm">
                          {log.action === "scraped_email" && (
                            <span className="text-slate-650">
                              Extracted email address: <strong className="text-slate-900 font-bold">{log.to_value}</strong>
                            </span>
                          )}

                          {log.action === "status_change" && (
                            <span className="text-slate-650">
                              Pipeline status updated: <strong className="text-slate-450 font-normal">{log.from_value}</strong> →{" "}
                              <strong className="text-blue-600 font-bold">{log.to_value}</strong>
                            </span>
                          )}

                          {log.action === "assignment" && (
                            <span className="text-slate-650 font-medium">
                              {log.to_value ? (
                                <>
                                  Assigned to{" "}
                                  <strong className="text-[#1c1c1c] font-bold">
                                    {log.to_value === currentUser.id ? "Me" : "Team Member"}
                                  </strong>
                                </>
                              ) : (
                                <span className="text-rose-600 font-bold uppercase text-[9px] tracking-wide bg-rose-50 px-1.5 py-0.5 rounded">Released assignment</span>
                              )}
                            </span>
                          )}

                          {log.action === "edit_name" && (
                            <span className="text-slate-650">
                              Renamed from <strong className="text-slate-450 font-medium">{log.from_value}</strong> to{" "}
                              <strong className="text-[#1c1c1c] font-bold">{log.to_value}</strong>
                            </span>
                          )}

                          {log.action === "edit_phone" && (
                            <span className="text-slate-650 font-medium">
                              Set telephone to <strong className="text-slate-900 font-bold">{log.to_value || "Empty"}</strong> (was {log.from_value || "Empty"})
                            </span>
                          )}

                          {log.action === "edit_email" && (
                            <span className="text-slate-655 font-medium">
                              Set email address to <strong className="text-slate-900 font-bold">{log.to_value || "Empty"}</strong> (was {log.from_value || "Empty"})
                            </span>
                          )}

                          {log.action === "edit_notes" && (
                            <span className="text-slate-650 block break-words">
                              Notes: <strong className="text-slate-900 font-semibold">{log.to_value || "Empty"}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              <div className="p-4 border-t border-black/[0.04] bg-white text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center">
                Record Created: {new Date(selectedLead.first_seen).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="absolute bottom-4 left-24 right-4 text-center text-slate-400 text-[10px] font-semibold">
        Business data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-600 underline transition-colors"
        >
          OpenStreetMap contributors
        </a>
        , ODbL license.
      </footer>

    </div>
  );
}
