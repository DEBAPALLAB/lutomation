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
  PlusCircle,
  HelpCircle,
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
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  }, [nicheFilter, filterUnassigned, filterAssignedToMe, filterNoWebsite]);

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

        if (selectedLead && selectedLead.place_id === placeId) {
          fetchLogs(placeId);
        }
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
        setLeads((prev) =>
          prev.map((lead) =>
            lead.place_id === placeId
              ? {
                  ...lead,
                  assigned_to: assignToId,
                  assignee_name: assignToId ? (assignToId === currentUser.id ? currentUser.name : "Team Member") : null,
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                }
              : lead
          )
        );

        if (selectedLead && selectedLead.place_id === placeId) {
          fetchLogs(placeId);
        }
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
        setLeads((prev) =>
          prev.map((l) =>
            l.place_id === editingLead.place_id
              ? {
                  ...l,
                  name: editName,
                  phone: editPhone,
                  email: editEmail,
                  notes: editNotes,
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                }
              : l
          )
        );
        setEditingLead(null);
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
            <Mail className="w-3 h-3 text-emerald-400" />
          </span>
        );
      case "contact_page":
        return (
          <span title="Found on contact page" className="flex items-center justify-center p-1 rounded bg-violet-500/10 border border-violet-500/20">
            <FileText className="w-3 h-3 text-violet-400" />
          </span>
        );
      case "footer":
        return (
          <span title="Extracted from website footer" className="flex items-center justify-center p-1 rounded bg-indigo-500/10 border border-indigo-500/20">
            <Info className="w-3 h-3 text-indigo-400" />
          </span>
        );
      case "manual":
        return (
          <span title="Manually set" className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/20">
            <User className="w-3 h-3 text-cyan-400" />
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

  const boardColumns = ["New", "Contacted", "Replied", "Won", "Dead"];

  return (
    <div className="relative min-h-screen bg-[#07070e] text-slate-100 font-sans overflow-x-hidden flex flex-col justify-between bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]">
      {/* Background neon ambient glows */}
      <div className="absolute top-[-30%] right-[-10%] w-[70%] h-[70%] rounded-full bg-violet-600/5 blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-cyan-600/5 blur-[180px] pointer-events-none" />
      <div className="absolute top-[35%] left-[25%] w-[50%] h-[50%] rounded-full bg-indigo-600/3 blur-[180px] pointer-events-none" />

      <div>
        {/* Navigation Header */}
        <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                <Compass className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  LeadFinder
                </span>
                <span className="text-[10px] text-cyan-400 block font-black uppercase tracking-widest leading-none mt-1">
                  Console OS
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-xs text-slate-300 font-semibold backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span>{currentUser.name}</span>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl px-4 py-2 text-xs font-bold text-rose-400 active:scale-[0.98] transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Core Dashboard Workspace */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
          
          {/* Top Panel: Form Scan & Job Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Scan Setup Panel */}
            <div className="lg:col-span-2 bg-[#0d0d18]/50 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.4)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-2xl group-hover:bg-violet-600/10 transition-all pointer-events-none" />
              
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2.5">
                <Search className="w-4 h-4 text-violet-400" />
                <span>Zone Scan Control</span>
              </h2>

              <form onSubmit={handleSearchSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                      Niche Target
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. dentist, restaurant, gym"
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm backdrop-blur-md"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                      Geographic Location
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                        <MapPin className="w-4 h-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Düsseldorf or New York"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm backdrop-blur-md"
                      />
                    </div>
                  </div>
                </div>

                {/* Radius toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2.5 text-xs text-slate-450 hover:text-slate-300 font-bold focus:outline-none bg-white/5 border border-white/5 hover:border-white/10 px-4 py-2 rounded-xl transition-all"
                  >
                    <span>Advanced Scan Settings</span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 bg-black/30 border border-white/5 rounded-2xl p-5 space-y-3">
                      <div className="max-w-xs">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                          Scan Bounding Radius (meters)
                        </label>
                        <input
                          type="number"
                          min="500"
                          max="15000"
                          step="500"
                          value={radius}
                          onChange={(e) => setRadius(parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[10px] text-slate-500 mt-2 block font-medium leading-relaxed">
                          Note: OSM sweeps are split into 7 zones automatically for distances above 1500m to enforce caching safety.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loadingSearch || !niche || !location}
                  className="bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 text-slate-100 font-bold py-3.5 px-8 rounded-2xl shadow-xl shadow-indigo-600/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm w-full md:w-auto"
                >
                  {loadingSearch ? (
                    <div className="flex items-center justify-center gap-2.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning Area Centroids...</span>
                    </div>
                  ) : (
                    <span>Initiate Scan Mission</span>
                  )}
                </button>
              </form>
            </div>

            {/* Console progress tracker */}
            <div className="bg-[#0d0d18]/50 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.4)] h-[250px] flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
              
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Job Console Logs</span>
                </h3>

                {activeJob ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold truncate max-w-[150px]">
                        Scanning: {activeJob.niche} in {activeJob.location}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full font-bold uppercase text-[9px] border tracking-wider ${
                          activeJob.status === "running"
                            ? "bg-indigo-950/50 text-indigo-400 border-indigo-850"
                            : activeJob.status === "done"
                            ? "bg-emerald-950/50 text-emerald-400 border-emerald-850"
                            : activeJob.status === "failed"
                            ? "bg-rose-950/50 text-rose-400 border-rose-850"
                            : activeJob.status === "partial"
                            ? "bg-amber-950/50 text-amber-400 border-amber-850"
                            : "bg-slate-900/50 text-slate-400 border-slate-800"
                        }`}
                      >
                        {activeJob.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-350">
                        <span>
                          Zones Parsed: {activeJob.cells_done} / {activeJob.cells_total}
                        </span>
                        <span>{activeJob.leads_found} leads</span>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
                        <div
                          className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 h-full rounded-full transition-all duration-500"
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

                    {activeJob.cells_failed > 0 && (
                      <div className="text-[10px] text-amber-400 flex items-start gap-1.5 font-bold bg-amber-950/30 border border-amber-900/30 rounded-xl p-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Some grids timed out. Click scan again later to sweep cached fallbacks.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 space-y-2">
                    <Compass className="w-8 h-8 text-slate-700 mx-auto" />
                    <p className="text-xs font-bold">No active scanner running.</p>
                    <p className="text-[10px] text-slate-600 max-w-xs mx-auto leading-normal">
                      Launch a zone scan to sweep area grids sequentially. Cache windows skip already searched zones.
                    </p>
                  </div>
                )}
              </div>

              {activeJob && (activeJob.status === "done" || activeJob.status === "partial") && (
                <div className="text-[10px] text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/30 rounded-2xl py-2 px-4 flex items-center justify-center gap-2 shadow-inner">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Scan job completed successfully!</span>
                </div>
              )}
            </div>
          </div>

          {/* Leads control panel: Filters & View Switcher */}
          <div className="space-y-6">
            
            {/* Control Bar */}
            <div className="bg-[#0d0d18]/40 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row gap-5 items-center justify-between shadow-xl">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <span>Grid Filters</span>
                </div>

                {/* View switcher */}
                <div className="bg-black/50 border border-white/5 rounded-xl p-1 flex items-center gap-1">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === "table"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                        : "text-slate-500 hover:text-slate-350"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Table View</span>
                  </button>
                  <button
                    onClick={() => setViewMode("board")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === "board"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                        : "text-slate-500 hover:text-slate-350"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Kanban Pipeline</span>
                  </button>
                </div>
              </div>

              {/* Form filters */}
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
                <div className="min-w-[160px]">
                  <input
                    type="text"
                    placeholder="Search Niche..."
                    value={nicheFilter}
                    onChange={(e) => setNicheFilter(e.target.value)}
                    className="w-full bg-black/45 border border-white/5 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer select-none bg-white/3 border border-white/5 hover:border-white/10 px-3.5 py-2 rounded-xl transition-all">
                  <input
                    type="checkbox"
                    checked={filterUnassigned}
                    onChange={(e) => {
                      setFilterUnassigned(e.target.checked);
                      if (e.target.checked) setFilterAssignedToMe(false);
                    }}
                    className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Unassigned</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer select-none bg-white/3 border border-white/5 hover:border-white/10 px-3.5 py-2 rounded-xl transition-all">
                  <input
                    type="checkbox"
                    checked={filterAssignedToMe}
                    onChange={(e) => {
                      setFilterAssignedToMe(e.target.checked);
                      if (e.target.checked) setFilterUnassigned(false);
                    }}
                    className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Mine only</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer select-none bg-white/3 border border-white/5 hover:border-white/10 px-3.5 py-2 rounded-xl transition-all">
                  <input
                    type="checkbox"
                    checked={filterNoWebsite}
                    onChange={(e) => setFilterNoWebsite(e.target.checked)}
                    className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>No Website</span>
                </label>
              </div>
            </div>

            {/* List / Board Workspace */}
            {loadingLeads && leads.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-500 bg-[#0d0d18]/20 border border-white/5 rounded-[32px]">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading lead records...</span>
              </div>
            ) : leads.length === 0 ? (
              <div className="py-24 text-center text-slate-500 bg-[#0d0d18]/20 border border-white/5 rounded-[32px] space-y-3">
                <Compass className="w-12 h-12 text-slate-755 mx-auto" />
                <p className="text-xs font-bold text-slate-400">No matching leads in active database.</p>
                <p className="text-[10px] text-slate-600 max-w-xs mx-auto leading-normal">
                  Try sweeping a wider radius or check for spelling errors in your search filters.
                </p>
              </div>
            ) : viewMode === "table" ? (
              
              /* Awwwards Table View Layout */
              <div className="bg-[#0d0d18]/30 backdrop-blur-xl border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/3 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <th className="py-5 px-6">Business Node</th>
                        <th className="py-5 px-4">Contact Info</th>
                        <th className="py-5 px-4">Email</th>
                        <th className="py-5 px-4">Niche</th>
                        <th className="py-5 px-4">Pipeline Status</th>
                        <th className="py-5 px-4">Assignment</th>
                        <th className="py-5 px-6 text-center">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-350 text-xs">
                      {leads.map((lead) => (
                        <tr
                          key={lead.place_id}
                          className="hover:bg-white/3 transition-all duration-200 group"
                        >
                          {/* Business Info */}
                          <td className="py-5 px-6 max-w-xs">
                            <div className="font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                              {lead.name}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-1">
                              {lead.address || "No address mapped in OSM"}
                            </div>
                            {lead.notes && (
                              <div className="text-[10px] text-indigo-400/80 mt-1 italic max-w-xs truncate">
                                Notes: {lead.notes}
                              </div>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="py-5 px-4 space-y-1.5">
                            <div>
                              {lead.phone ? (
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-400 hover:underline transition-all"
                                >
                                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{lead.phone}</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-600">—</span>
                              )}
                            </div>
                            <div>
                              {lead.website ? (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-400 hover:underline truncate max-w-[150px] transition-all"
                                >
                                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Visit Site</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-rose-500/70 font-semibold bg-rose-500/5 border border-rose-500/10 px-2 py-0.5 rounded">No Website</span>
                              )}
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-5 px-4">
                            {lead.email ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="text-[11px] font-semibold text-slate-300 hover:text-indigo-400 hover:underline truncate max-w-[160px] transition-all"
                                >
                                  {lead.email}
                                </a>
                                {renderEmailSourceIcon(lead.email_source)}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-600">—</span>
                            )}
                          </td>

                          {/* Niche */}
                          <td className="py-5 px-4">
                            <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black tracking-widest bg-slate-900 border border-white/5 text-slate-400 uppercase">
                              {lead.niche}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-5 px-4">
                            <select
                              value={lead.status}
                              onChange={(e) => handleStatusChange(lead.place_id, e.target.value)}
                              className="bg-black/60 border border-white/5 hover:border-white/10 rounded-xl py-1.5 px-3 text-xs text-slate-300 focus:outline-none cursor-pointer focus:border-indigo-500 transition-all font-semibold"
                            >
                              <option value="New">New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Replied">Replied</option>
                              <option value="Won">Won</option>
                              <option value="Dead">Dead</option>
                            </select>
                          </td>

                          {/* Assignment */}
                          <td className="py-5 px-4">
                            {lead.assigned_to ? (
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-slate-350 font-bold truncate max-w-[80px]">
                                  {lead.assigned_to === currentUser.id ? "Me" : lead.assignee_name || "Claimed"}
                                </span>
                                <button
                                  onClick={() => handleAssignment(lead.place_id, null)}
                                  className="text-[10px] font-black uppercase tracking-wider text-rose-400/80 hover:text-rose-400 hover:underline transition-all"
                                >
                                  Release
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAssignment(lead.place_id, currentUser.id)}
                                className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-gradient-to-r hover:from-violet-600 hover:to-indigo-600 hover:text-white rounded-xl px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98]"
                              >
                                Claim
                              </button>
                            )}
                          </td>

                          {/* Controls */}
                          <td className="py-5 px-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditModal(lead)}
                                className="text-slate-500 hover:text-cyan-400 p-2 rounded-xl hover:bg-slate-950/60 border border-transparent hover:border-white/5 transition-all"
                                title="Edit Lead Details"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenLogs(lead)}
                                className="text-slate-500 hover:text-indigo-400 p-2 rounded-xl hover:bg-slate-950/60 border border-transparent hover:border-white/5 transition-all"
                                title="View History Logs"
                              >
                                <History className="w-4 h-4" />
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
              
              /* Awwwards Kanban Board View Layout */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
                {boardColumns.map((colName) => {
                  const colLeads = leads.filter((l) => l.status === colName);
                  return (
                    <div
                      key={colName}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, colName)}
                      className="bg-[#0d0d18]/25 border border-white/5 rounded-3xl p-4 flex flex-col min-h-[550px] shadow-lg"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                          {colName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/50 border border-white/5 text-slate-400">
                          {colLeads.length}
                        </span>
                      </div>

                      {/* Column Cards */}
                      <div className="flex-1 space-y-4 overflow-y-auto">
                        {colLeads.map((lead) => (
                          <div
                            key={lead.place_id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead.place_id)}
                            className="bg-[#0f0f1d]/60 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-4 shadow-md hover:shadow-2xl hover:shadow-indigo-500/5 active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden"
                          >
                            {/* Card Content */}
                            <div className="space-y-3.5">
                              <div>
                                <h4 className="font-bold text-slate-200 text-xs truncate max-w-[180px] group-hover:text-white transition-colors">
                                  {lead.name}
                                </h4>
                                <p className="text-[9px] text-slate-500 truncate mt-0.5">
                                  {lead.address || "No address"}
                                </p>
                              </div>

                              {lead.notes && (
                                <p className="text-[9px] text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-1 rounded italic truncate">
                                  Notes: {lead.notes}
                                </p>
                              )}

                              {/* Details Summary */}
                              <div className="space-y-1 bg-black/30 rounded-xl p-2 border border-white/5 text-[10px]">
                                <div className="flex items-center justify-between text-slate-400">
                                  <span className="font-medium">Website:</span>
                                  {lead.website ? (
                                    <a
                                      href={lead.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-violet-400 hover:underline truncate max-w-[90px]"
                                    >
                                      Visit
                                    </a>
                                  ) : (
                                    <span className="text-rose-500 font-bold uppercase text-[8px] bg-rose-500/5 px-1.5 py-0.5 rounded">None</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-slate-400">
                                  <span className="font-medium">Phone:</span>
                                  <span className="truncate max-w-[90px] text-slate-300">
                                    {lead.phone || "—"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-slate-400">
                                  <span className="font-medium">Email:</span>
                                  <span className="truncate max-w-[90px] text-slate-300">
                                    {lead.email || "—"}
                                  </span>
                                </div>
                              </div>

                              {/* Bottom row */}
                              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                {/* Claim toggle */}
                                {lead.assigned_to ? (
                                  <span className="text-[9px] font-bold text-slate-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg truncate max-w-[75px]">
                                    {lead.assigned_to === currentUser.id ? "Me" : lead.assignee_name || "Claimed"}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAssignment(lead.place_id, currentUser.id)}
                                    className="text-[9px] font-black uppercase text-indigo-400 hover:text-white transition-colors"
                                  >
                                    Claim
                                  </button>
                                )}

                                {/* Row Controls */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openEditModal(lead)}
                                    className="p-1.5 text-slate-500 hover:text-cyan-400 rounded-lg hover:bg-black/50 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenLogs(lead)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-black/50 transition-colors"
                                    title="History"
                                  >
                                    <History className="w-3.5 h-3.5" />
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
        </main>
      </div>

      {/* Manual Details Edit Modal ( frosted overlay ) */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl transition-all"
            onClick={() => setEditingLead(null)}
          />

          <div className="relative z-10 w-full max-w-lg bg-[#0d0d18] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-200 uppercase tracking-widest">
                  Edit Lead Information
                </h3>
                <p className="text-xs text-slate-500 font-medium truncate max-w-[300px] mt-1">
                  ID: {editingLead.place_id}
                </p>
              </div>
              <button
                onClick={() => setEditingLead(null)}
                className="rounded-xl p-1.5 text-slate-500 hover:text-slate-350 hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="space-y-4">
              {/* Name field */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
                />
              </div>

              {/* Phone field */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
                />
              </div>

              {/* Email field */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. info@business.com"
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
                />
              </div>

              {/* Notes field */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Internal Notes / Audit Comments
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add details, call notes, or follow up reminders..."
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 px-6 rounded-2xl transition-all text-xs border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-slate-100 font-bold py-2.5 px-6 rounded-2xl shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Sidebar */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedLead(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[#0a0a13] border-l border-white/5 shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="py-6 px-6 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Lead Audit History
                  </h3>
                  <p className="text-sm text-cyan-400 font-bold truncate max-w-[280px] mt-1">
                    {selectedLead.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="rounded-xl p-1.5 text-slate-500 hover:text-slate-350 hover:bg-white/5 focus:outline-none transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Logs Content List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingLogs ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs">Loading activity logs...</span>
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 space-y-2">
                    <History className="w-8 h-8 mx-auto opacity-40 mb-2 text-slate-500" />
                    <p className="text-xs font-bold">No audit logs recorded.</p>
                    <p className="text-[10px] max-w-xs leading-normal mx-auto">
                      Activity logs are generated when statuses are edited, team members claimed, or lead attributes updated.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l border-white/5 pl-4 ml-2 space-y-5">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="relative group text-xs">
                        {/* Bullet point on timeline */}
                        <div className="absolute left-[-21px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-500 group-hover:scale-125 transition-transform border border-[#0a0a13]" />

                        <div className="font-bold text-slate-300">
                          {log.user_name || "System Scraper"}
                        </div>
                        <div className="text-[10px] text-slate-550 mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>

                        <div className="mt-2.5 bg-black/40 rounded-xl p-3 border border-white/5">
                          {log.action === "scraped_email" && (
                            <span className="text-slate-400">
                              Scraped email <strong className="text-indigo-300 font-bold">{log.to_value}</strong>
                            </span>
                          )}

                          {log.action === "status_change" && (
                            <span className="text-slate-400">
                              Status changed from <strong className="text-slate-500 font-medium">{log.from_value}</strong> to{" "}
                              <strong className="text-cyan-400 font-bold">{log.to_value}</strong>
                            </span>
                          )}

                          {log.action === "assignment" && (
                            <span className="text-slate-400 font-medium">
                              {log.to_value ? (
                                <>
                                  Assigned to{" "}
                                  <strong className="text-violet-400 font-bold">
                                    {log.to_value === currentUser.id ? "Me" : "Team Member"}
                                  </strong>
                                </>
                              ) : (
                                <span className="text-rose-400/90 font-bold uppercase text-[9px] tracking-wide bg-rose-500/5 px-2 py-0.5 rounded">Released assignment</span>
                              )}
                            </span>
                          )}

                          {log.action === "edit_name" && (
                            <span className="text-slate-400">
                              Business Name renamed from <strong className="text-slate-500 font-medium">{log.from_value}</strong> to{" "}
                              <strong className="text-cyan-400 font-bold">{log.to_value}</strong>
                            </span>
                          )}

                          {log.action === "edit_phone" && (
                            <span className="text-slate-400 font-medium">
                              Set phone to <strong className="text-indigo-400 font-bold">{log.to_value || "Empty"}</strong> (was {log.from_value || "Empty"})
                            </span>
                          )}

                          {log.action === "edit_email" && (
                            <span className="text-slate-400 font-medium">
                              Set email to <strong className="text-indigo-400 font-bold">{log.to_value || "Empty"}</strong> (was {log.from_value || "Empty"})
                            </span>
                          )}

                          {log.action === "edit_notes" && (
                            <span className="text-slate-400 block break-words">
                              Notes updated: <strong className="text-indigo-300 font-semibold">{log.to_value || "Empty"}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              <div className="p-6 border-t border-white/5 bg-slate-950/40 text-[9px] text-slate-550 font-bold uppercase tracking-wider text-center">
                First seen: {new Date(selectedLead.first_seen).toLocaleDateString()} at {new Date(selectedLead.first_seen).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer License */}
      <footer className="border-t border-white/5 bg-slate-950 py-6 text-center text-slate-600 text-xs mt-auto font-medium">
        Business data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-400 underline transition-colors"
        >
          OpenStreetMap contributors
        </a>
        , ODbL license.
      </footer>
    </div>
  );
}
