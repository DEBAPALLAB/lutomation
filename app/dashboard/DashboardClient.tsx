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
  LogOut,
  MapPin,
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
  Users,
  Bell,
  ArrowUpRight,
  Star,
  Trash2,
  MessageSquare,
  Send,
  SlidersHorizontal,
  RotateCcw,
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
  priority?: number;
  checklist?: string | null;
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

interface LeadComment {
  id: number;
  place_id: string;
  user_id: string;
  comment: string;
  timestamp: string;
  user_name: string | null;
}

const DEFAULT_CHECKLIST = [
  { id: "research", text: "Research Contact Person" },
  { id: "outreach", text: "Initial Cold Call / Contact" },
  { id: "pitch", text: "Send Pitch / Proposal" },
  { id: "followup", text: "Follow-up Call/Email" },
  { id: "meeting", text: "Schedule Meeting" },
];

const formatNiche = (niche: string) => {
  if (!niche) return "";
  return niche
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const getStatusStyles = (status: string) => {
  switch (status) {
    case "New":
      return "bg-[#1f1e25] text-slate-400 border-slate-700/60";
    case "Contacted":
      return "bg-blue-500/10 text-blue-400 border-blue-500/35";
    case "Replied":
      return "bg-violet-500/10 text-violet-400 border-violet-500/35";
    case "Won":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/35";
    case "Dead":
      return "bg-rose-500/10 text-rose-400 border-rose-500/35";
    default:
      return "bg-[#1f1e25] text-slate-400 border-slate-700/60";
  }
};

export default function DashboardClient({ currentUser }: { currentUser: UserInfo }) {
  // Navigation State
  const [activeView, setActiveView] = useState<"home" | "leads">("home");

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
  
  // Team users
  const [users, setUsers] = useState<UserInfo[]>([]);
  
  // Filtering options
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all"); // 'all' | 'unassigned' | 'me' | '<userId>'
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);

  // Expanded Filter Engine states
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedStatuses, setCheckedStatuses] = useState<Set<string>>(new Set());
  const [websiteFilter, setWebsiteFilter] = useState<"all" | "has_web" | "no_web">("all");
  const [emailFilter, setEmailFilter] = useState<"all" | "has_email" | "no_email">("all");
  const [sortBy, setSortBy] = useState<"last_updated" | "first_seen" | "name" | "status">("last_updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false);

  // Custom dropdown states
  const [activeDropdown, setActiveDropdown] = useState<{ placeId: string; type: "status" | "assignee" | "drawer_status" | "drawer_assignee" } | null>(null);
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<"assignee" | "sortBy" | "sortDirection" | null>(null);
  const [activeBulkDropdown, setActiveBulkDropdown] = useState<"assignee" | "status" | null>(null);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");

  // Bulk actions selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // View modes: 'table' | 'board'
  const [viewMode, setViewMode] = useState<"table" | "board">("table");

  // Edit lead modal
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Inline editing states for details drawer
  const [inlineEditingField, setInlineEditingField] = useState<"name" | "website" | "phone" | "email" | "address" | "niche" | "notes" | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");

  // Lead drawer details
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState<"info" | "comments" | "audit">("info");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Comments thread state
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Redesign timeframe and global activity states
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "31d" | "All">("All");
  const [globalActivity, setGlobalActivity] = useState<ActivityLog[]>([]);
  const [loadingGlobalActivity, setLoadingGlobalActivity] = useState(false);

  // Fetch users on mount
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Click outside listener to close custom dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".custom-dropdown-container")) {
        setActiveDropdown(null);
        setActiveFilterDropdown(null);
        setActiveBulkDropdown(null);
        setAssigneeSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      if (assigneeFilter === "unassigned") filterVal = "unassigned";
      else if (assigneeFilter === "me") filterVal = "assigned_to_me";
      else if (assigneeFilter && assigneeFilter !== "all") filterVal = `assigned_to:${assigneeFilter}`;

      const queryParams = new URLSearchParams();
      if (nicheFilter) queryParams.append("niche", nicheFilter);
      if (filterVal) queryParams.append("filter", filterVal);
      if (filterStarredOnly) queryParams.append("starred", "true");

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
  }, [nicheFilter, assigneeFilter, filterStarredOnly, fetchGlobalActivity]);

  // Initial load and reload when filters change
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedLeadIds(new Set());
  }, [nicheFilter, assigneeFilter, filterNoWebsite, filterStarredOnly, searchQuery, checkedStatuses, websiteFilter, emailFilter, activeView]);

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
        const matchingUser = users.find((u) => u.id === assignToId);
        const assigneeName = assignToId ? (matchingUser?.name || "Team Member") : null;
        
        setLeads((prev) =>
          prev.map((lead) =>
            lead.place_id === placeId
              ? {
                  ...lead,
                  assigned_to: assignToId,
                  assignee_name: assigneeName,
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
                  assignee_name: assigneeName,
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

  // Toggle priority (star) of lead
  const handlePriorityToggle = async (placeId: string, currentPriority: number) => {
    const newPriority = currentPriority ? 0 : 1;
    try {
      const res = await fetch(`/api/leads/${placeId}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.place_id === placeId
              ? {
                  ...lead,
                  priority: newPriority,
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                }
              : lead
          )
        );

        if (selectedLead && selectedLead.place_id === placeId) {
          setSelectedLead((prev) => prev ? { ...prev, priority: newPriority } : null);
          fetchLogs(placeId);
        }
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to toggle priority:", err);
    }
  };

  // Update lead checklist
  const handleChecklistChange = async (placeId: string, updatedChecklist: any[]) => {
    try {
      const checklistStr = JSON.stringify(updatedChecklist);
      const res = await fetch(`/api/leads/${placeId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: checklistStr }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.place_id === placeId
              ? {
                  ...lead,
                  checklist: checklistStr,
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                }
              : lead
          )
        );

        if (selectedLead && selectedLead.place_id === placeId) {
          setSelectedLead((prev) => prev ? { ...prev, checklist: checklistStr } : null);
          fetchLogs(placeId);
        }
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to update checklist:", err);
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

  const handleInlineSave = async (field: string, value: string) => {
    if (!selectedLead) return;

    try {
      const res = await fetch(`/api/leads/${selectedLead.place_id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: field === "name" ? value : selectedLead.name,
          phone: field === "phone" ? value : selectedLead.phone,
          email: field === "email" ? value : selectedLead.email,
          notes: field === "notes" ? value : selectedLead.notes,
          address: field === "address" ? value : selectedLead.address,
          website: field === "website" ? value : selectedLead.website,
          niche: field === "niche" ? value : selectedLead.niche,
        }),
      });

      if (res.ok) {
        const updated = {
          ...selectedLead,
          [field]: value,
          last_updated: new Date().toISOString(),
          updater_name: currentUser.name,
        };

        setLeads((prev) =>
          prev.map((l) => (l.place_id === selectedLead.place_id ? updated : l))
        );
        setSelectedLead(updated);
        fetchLogs(selectedLead.place_id);
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to save inline edit:", err);
    } finally {
      setInlineEditingField(null);
      setInlineEditValue("");
    }
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setEditName(lead.name);
    setEditPhone(lead.phone || "");
    setEditEmail(lead.email || "");
    setEditNotes(lead.notes || "");
  };

  // Fetch audit history logs for specific lead
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

  // Fetch comments for specific lead
  const fetchComments = async (placeId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/leads/${placeId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit a new comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newComment.trim()) return;

    try {
      const res = await fetch(`/api/leads/${selectedLead.place_id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
        fetchLogs(selectedLead.place_id);
        fetchGlobalActivity();
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleOpenLogs = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerTab("info");
    setActivityLogs([]);
    setComments([]);
    fetchLogs(lead.place_id);
    fetchComments(lead.place_id);
  };

  // Checkbox functions for multi-select
  const toggleSelectLead = (placeId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  };

  const toggleSelectAllLeads = () => {
    setSelectedLeadIds((prev) => {
      if (prev.size === displayedLeads.length) {
        return new Set();
      } else {
        return new Set(displayedLeads.map((l) => l.place_id));
      }
    });
  };

  // Execute bulk actions
  const handleBulkAction = async (action: "status" | "assign" | "priority" | "delete", value: any) => {
    const list = Array.from(selectedLeadIds);
    if (list.length === 0) return;

    if (action === "delete" && !confirm(`Are you sure you want to delete ${list.length} leads? This action is permanent.`)) {
      return;
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, placeIds: list, value }),
      });

      if (res.ok) {
        if (action === "delete") {
          setLeads((prev) => prev.filter((lead) => !selectedLeadIds.has(lead.place_id)));
        } else {
          setLeads((prev) =>
            prev.map((lead) => {
              if (selectedLeadIds.has(lead.place_id)) {
                const updated: Partial<Lead> = {
                  last_updated: new Date().toISOString(),
                  updater_name: currentUser.name,
                };
                if (action === "status") {
                  updated.status = value;
                } else if (action === "assign") {
                  updated.assigned_to = value;
                  const matchingUser = users.find((u) => u.id === value);
                  updated.assignee_name = value ? (matchingUser?.name || "Team Member") : null;
                } else if (action === "priority") {
                  updated.priority = value ? 1 : 0;
                }
                return { ...lead, ...updated };
              }
              return lead;
            })
          );
        }

        setSelectedLeadIds(new Set());
        fetchGlobalActivity();
      } else {
        alert("Bulk action failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderEmailSourceIcon = (source: string | null) => {
    if (!source) return null;
    switch (source) {
      case "mailto":
        return (
          <span title="OSM mailto link" className="flex items-center justify-center p-1 rounded bg-indigo-500/10 border border-indigo-500/20">
            <Mail className="w-3 h-3 text-indigo-400" />
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
          <span title="Extracted from website footer" className="flex items-center justify-center p-1 rounded bg-teal-500/10 border border-teal-500/20">
            <Info className="w-3 h-3 text-teal-400" />
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

  // Helper to parse lead checklist
  const getLeadChecklist = (lead: Lead) => {
    try {
      if (lead.checklist) {
        return JSON.parse(lead.checklist);
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CHECKLIST.map((item) => ({ ...item, completed: false }));
  };

  // Filters count calculator
  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (checkedStatuses.size > 0) count++;
    if (websiteFilter !== "all") count++;
    if (emailFilter !== "all") count++;
    if (assigneeFilter !== "all") count++;
    if (nicheFilter) count++;
    if (filterStarredOnly) count++;
    return count;
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCheckedStatuses(new Set());
    setWebsiteFilter("all");
    setEmailFilter("all");
    setAssigneeFilter("all");
    setNicheFilter("");
    setFilterStarredOnly(false);
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

  // Structured client-side filter engine
  const displayedLeads = leads
    .filter(filterByTimeframe)
    .filter((lead) => {
      // 1. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = lead.name?.toLowerCase().includes(q);
        const addrMatch = lead.address?.toLowerCase().includes(q);
        const phoneMatch = lead.phone?.toLowerCase().includes(q);
        const emailMatch = lead.email?.toLowerCase().includes(q);
        const webMatch = lead.website?.toLowerCase().includes(q);
        if (!nameMatch && !addrMatch && !phoneMatch && !emailMatch && !webMatch) {
          return false;
        }
      }
      // 2. Status checkbox filter
      if (checkedStatuses.size > 0) {
        if (!checkedStatuses.has(lead.status)) {
          return false;
        }
      }
      // 3. Website Presence filter
      if (websiteFilter === "has_web") {
        if (!lead.website || lead.website === "") return false;
      } else if (websiteFilter === "no_web") {
        if (lead.website && lead.website !== "") return false;
      }
      // 4. Email Presence filter
      if (emailFilter === "has_email") {
        if (!lead.email || lead.email === "") return false;
      } else if (emailFilter === "no_email") {
        if (lead.email && lead.email !== "") return false;
      }
      return true;
    })
    .sort((a, b) => {
      // 5. Dynamic Sorting
      let valA: any = "";
      let valB: any = "";

      if (sortBy === "name") {
        valA = a.name || "";
        valB = b.name || "";
      } else if (sortBy === "status") {
        valA = a.status || "";
        valB = b.status || "";
      } else if (sortBy === "first_seen") {
        valA = a.first_seen || "";
        valB = b.first_seen || "";
      } else {
        // default last_updated
        valA = a.last_updated || a.first_seen || "";
        valB = b.last_updated || b.first_seen || "";
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

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

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "?";
  const getAvatarBg = (name: string) => {
    const colors = [
      "bg-slate-700 text-slate-100", 
      "bg-[#8b5cf6] text-white", 
      "bg-emerald-600 text-white", 
      "bg-amber-600 text-white",
      "bg-pink-600 text-white",
      "bg-blue-600 text-white"
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };
  const statusDotColor = (status: string) => {
    switch (status) {
      case "New": return "bg-slate-400";
      case "Contacted": return "bg-blue-400";
      case "Replied": return "bg-violet-400";
      case "Won": return "bg-green-400";
      case "Dead": return "bg-red-400";
      default: return "bg-slate-405";
    }
  };

  return (
    <div className="min-h-screen bg-[#09080d] flex font-sans relative pb-28 text-slate-100 dot-grid overflow-hidden">
      
      {/* Dynamic Flowing Gradient Background Blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none opacity-45">
        <div className="absolute top-[-15%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899] opacity-40 blur-[130px] blob-1" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] opacity-35 blur-[130px] blob-2" />
        <div className="absolute top-[25%] left-[30%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-r from-[#10b981] to-[#3b82f6] opacity-20 blur-[140px] blob-3" />
      </div>

      {/* 1. Left Side Menu - Vertical Navigation Strip */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 flex flex-col items-center py-6 border-r border-[#25242a] bg-[#141318] z-40 gap-6 shadow-xl">
        {/* Brand circle logo */}
        <div className="w-12 h-12 rounded-lg bg-[#8b5cf6] flex items-center justify-center shadow-lg shadow-[#8b5cf6]/20 flex-shrink-0 cursor-pointer transition-transform hover:scale-[1.03]">
          <Compass className="w-6 h-6 text-white" />
        </div>

        <div className="w-full px-3 flex flex-col gap-2 mt-4">
          {/* Home Nav Item */}
          <button
            onClick={() => setActiveView("home")}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === "home"
                ? "bg-[#8b5cf6] text-white shadow-md shadow-[#8b5cf6]/10"
                : "text-slate-500 hover:text-slate-300 hover:bg-[#1c1b22]"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
          </button>

          {/* Leads Nav Item */}
          <button
            onClick={() => setActiveView("leads")}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeView === "leads"
                ? "bg-[#8b5cf6] text-white shadow-md shadow-[#8b5cf6]/10"
                : "text-slate-500 hover:text-slate-300 hover:bg-[#1c1b22]"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Leads</span>
          </button>
        </div>
      </aside>

      {/* 2. Main content container */}
      <div className="flex-1 pl-20 min-h-screen flex flex-col relative z-10">
        
        {/* Floating Top Header bar */}
        <div className="px-6 pt-6">
          <header className="organic-card px-8 py-4 flex items-center justify-between shadow-md bg-[#141318] border-[#25242a]">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                {activeView === "home" ? "Dashboard" : "Leads Management"}
              </h1>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest bg-[#1c1b22] border border-[#25242a] px-2 py-0.5 rounded mt-1">Console OS</span>
            </div>

            <div className="flex items-center gap-4">
              <button className="w-9 h-9 rounded-lg bg-[#1c1b22] border border-[#25242a] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer">
                <HelpCircle className="w-4.5 h-4.5" />
              </button>

              <button className="relative w-9 h-9 rounded-lg bg-[#1c1b22] border border-[#25242a] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 border border-slate-900" />
              </button>

              <div className="flex items-center gap-2 bg-[#1c1b22] border border-[#25242a] rounded-lg pl-2 pr-4 py-1.5 shadow-inner">
                <div className="w-7 h-7 rounded-md bg-[#8b5cf6] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-xs text-slate-200 font-bold">{currentUser.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg px-4 py-2.5 text-xs font-bold text-rose-400 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </form>
            </div>
          </header>
        </div>

        {/* 3. Render View based on activeView */}
        <main className="flex-1 p-6 w-full max-w-[1600px] mx-auto">
          
          {activeView === "home" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Prominent Zone Scan Control (Hero Element) */}
              <div className="lg:col-span-3 organic-card p-8 shadow-md border border-[#25242a] bg-gradient-to-br from-[#141318] to-[#0c0b10]">
                <h2 className="text-sm font-extrabold text-[#c084fc] uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#8b5cf6]" />
                  <span>Initiate New Zone Scan</span>
                </h2>
                <p className="text-xs text-slate-400 mb-6 max-w-2xl">Deploy scrapers to targeted coordinates to discover fresh leads, enrich contact emails, and pull website metadata into your pipeline automatically.</p>

                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                        Niche Target
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. dentist, restaurant, gym"
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#8b5cf6] transition-all text-sm shadow-inner"
                      />
                    </div>

                    <div className="md:col-span-2 relative flex items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                          Geographic Location
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Düsseldorf or New York"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg py-3 pl-11 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#8b5cf6] transition-all text-sm shadow-inner"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loadingSearch || !niche || !location}
                        className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold h-[46px] px-8 rounded-lg active:scale-[0.98] transition-all text-sm shadow-md shadow-[#8b5cf6]/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex-shrink-0"
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
                      className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200 font-bold focus:outline-none mt-2 transition-all cursor-pointer"
                    >
                      <span>Advanced Settings</span>
                      {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 bg-[#0c0b10] border border-[#25242a] rounded-lg p-5 space-y-2 max-w-sm shadow-inner">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                          Scan Bounding Radius (meters)
                        </label>
                        <input
                          type="number"
                          min="500"
                          max="15000"
                          step="500"
                          value={radius}
                          onChange={(e) => setRadius(parseInt(e.target.value))}
                          className="w-full bg-[#141318] border border-[#25242a] rounded-md py-2 px-3 text-slate-200 text-sm focus:outline-none focus:border-[#8b5cf6]"
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
                      <h2 className="text-lg font-bold text-white">Overview</h2>
                      <p className="text-xs text-slate-400">Key metrics across your offers and deals</p>
                    </div>

                    <div className="bg-[#0c0b10] border border-[#25242a] rounded-lg p-1 flex items-center gap-1 shadow-inner">
                      {(["24h", "7d", "31d", "All"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                            timeframe === t
                              ? "bg-[#8b5cf6] text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 Core Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total leads</span>
                        <div className="p-1 rounded bg-[#0c0b10]"><User className="w-4 h-4 text-slate-400" /></div>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-white">{metrics.totalCount}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.totalDiff >= 0 ? "trend-green" : "trend-red"}`}>
                            {metrics.totalDiff >= 0 ? `+${metrics.totalDiff}` : metrics.totalDiff}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Active deals</span>
                        <div className="p-1 rounded bg-[#0c0b10]"><Compass className="w-4 h-4 text-slate-400" /></div>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-white">{metrics.activeCount}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.activeDiff >= 0 ? "trend-green" : "trend-red"}`}>
                            {metrics.activeDiff >= 0 ? `+${metrics.activeDiff}` : metrics.activeDiff}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Niches</span>
                        <div className="p-1 rounded bg-[#0c0b10]"><Globe className="w-4 h-4 text-slate-400" /></div>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-white">{metrics.uniqueNiches}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metrics.nicheDiff >= 0 ? "trend-green" : "trend-red"}`}>
                            {metrics.nicheDiff >= 0 ? `+${metrics.nicheDiff}` : metrics.nicheDiff}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-4 flex flex-col justify-between h-[120px] shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Email rate</span>
                        <div className="p-1 rounded bg-[#0c0b10]"><Mail className="w-4 h-4 text-slate-400" /></div>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-white">{metrics.emailRate}%</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full trend-gray">{timeframe === "All" ? "N/A" : "Live"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scraping Activity Card */}
                <div className="organic-card p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-white">Scraping Activity</h3>
                      <p className="text-xs text-slate-400">Analysis across all active sweeps</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Leads Found</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-white">{leads.length}</span>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">+12%</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Emails Sweep</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-white">{metrics.emailsCount}</span>
                          <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded-full">{metrics.emailRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="46" className="stroke-slate-800/40 fill-transparent" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="46"
                        className="stroke-[#8b5cf6] fill-transparent transition-all duration-700"
                        strokeWidth="10" strokeDasharray="289"
                        strokeDashoffset={289 - (289 * metrics.emailRate) / 100} strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ratio</span>
                      <span className="text-3xl font-black text-white">{metrics.emailRate}%</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Sub-Column (1/3 width) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Active Scanner progress logs */}
                <div className="organic-card p-6 shadow-sm">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Scanner Logs</span>
                  </h3>

                  {activeJob ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-200 font-bold truncate max-w-[150px]">
                          Scanning: {activeJob.niche}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] border tracking-wider ${
                          activeJob.status === "running"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                            : activeJob.status === "done"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          {activeJob.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>Zones complete: {activeJob.cells_done} / {activeJob.cells_total}</span>
                          <span>{activeJob.leads_found} leads</span>
                        </div>

                        <div className="w-full bg-[#0c0b10] rounded-full h-2 overflow-hidden border border-[#25242a]">
                          <div
                            className="bg-[#8b5cf6] h-full rounded-full transition-all duration-500"
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
                    <div className="text-center py-4 text-slate-500 space-y-1">
                      <Compass className="w-6 h-6 text-slate-650 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-500">Scanner idle.</p>
                    </div>
                  )}
                </div>

                {/* Global Recent Activity Feed */}
                <div className="organic-card p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-white">Recent Activity</h3>
                        <p className="text-xs text-slate-400">Audit logs of pipeline changes</p>
                      </div>
                      <button 
                        onClick={fetchGlobalActivity}
                        className="w-8 h-8 rounded-lg bg-[#1c1b22] border border-[#25242a] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer hover:scale-[1.05] transition-all"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                      {loadingGlobalActivity && globalActivity.length === 0 ? (
                        <div className="py-10 text-center text-slate-500 text-xs">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-slate-400" />
                        </div>
                      ) : globalActivity.length === 0 ? (
                        <p className="text-[10px] text-center text-slate-500 py-6">No recent actions recorded.</p>
                      ) : (
                        globalActivity.map((act) => {
                          const matchingLead = leads.find((l) => l.place_id === act.place_id);
                          return (
                            <div 
                              key={act.id} 
                              className="border-b border-[#25242a]/60 pb-3 last:border-b-0 cursor-pointer hover:bg-[#1c1b22]/50 p-2 rounded-lg transition-all"
                              onClick={() => {
                                if (matchingLead) handleOpenLogs(matchingLead);
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-md bg-[#1c1b22] border border-[#25242a] flex items-center justify-center text-[#8b5cf6] font-bold text-xs uppercase flex-shrink-0">
                                  {(act.lead_name || "L").substring(0, 2)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-slate-200">
                                    <span className="font-bold">{act.user_name || "System"}</span>{" "}
                                    {act.action === "scraped_email" && `extracted email for `}
                                    {act.action === "status_change" && `updated status to ${act.to_value} on `}
                                    {act.action === "assignment" && (act.to_value ? `claimed assignment of ` : `released assignment of `)}
                                    {act.action.startsWith("edit_") && `renamed attributes on `}
                                    {act.action === "priority_change" && (Number(act.to_value) ? `starred ` : `unstarred `)}
                                    {act.action === "checklist_change" && `updated workflow checklist on `}
                                    {act.action === "add_comment" && `commented on `}
                                    <strong className="font-bold text-[#c084fc]">{act.lead_name || "unknown node"}</strong>
                                  </div>
                                  
                                  <p className="text-[9px] text-slate-500 mt-0.5">
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
            </div>
          )}

          {activeView === "leads" && (
            <div className="space-y-4">
              
              {/* Collapsible Filter Bar */}
              <div className="organic-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                
                {/* Text query search box */}
                <div className="relative w-full md:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search name, address, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0c0b10] border border-[#25242a] text-slate-200 placeholder-slate-650 rounded-lg py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-[#8b5cf6] transition-all"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                  
                  {/* Expandable filters trigger */}
                  <button
                    onClick={() => setFilterPanelExpanded(!filterPanelExpanded)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
                      filterPanelExpanded || getActiveFiltersCount() > 0
                        ? "bg-[#8b5cf6]/10 border-[#8b5cf6] text-[#c084fc]"
                        : "bg-[#0c0b10] border-[#25242a] text-slate-400 hover:border-[#38373f] hover:text-slate-200"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {getActiveFiltersCount() > 0 && (
                      <span className="bg-[#8b5cf6] text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-extrabold ml-1">
                        {getActiveFiltersCount()}
                      </span>
                    )}
                  </button>

                  <div className="w-px h-6 bg-[#25242a]" />

                  {/* View modes */}
                  <div className="bg-[#0c0b10] border border-[#25242a] rounded-lg p-0.5 flex items-center gap-0.5">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        viewMode === "table"
                          ? "bg-[#8b5cf6] text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode("board")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        viewMode === "board"
                          ? "bg-[#8b5cf6] text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Kanban</span>
                    </button>
                  </div>

                  {/* Reset active filters */}
                  {getActiveFiltersCount() > 0 && (
                    <button
                      onClick={handleResetFilters}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg"
                      title="Reset all filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  )}

                </div>
              </div>

              {/* Expandable Advanced Filters Grid */}
              {filterPanelExpanded && (
                <div className="organic-card p-6 border border-[#25242a] shadow-lg grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in-up bg-[#141318]">
                  
                  {/* Status checkbox group */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Outreach Status</span>
                    <div className="grid grid-cols-2 gap-2">
                      {boardColumns.map((col) => {
                        const isChecked = checkedStatuses.has(col);
                        return (
                          <label
                            key={col}
                            className={`flex items-center gap-2 text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                              isChecked
                                ? "bg-[#8b5cf6]/10 border-[#8b5cf6] text-[#c084fc]"
                                : "bg-[#0c0b10] border-[#25242a] text-slate-400 hover:border-[#38373f] hover:text-slate-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setCheckedStatuses((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(col)) next.delete(col);
                                  else next.add(col);
                                  return next;
                                });
                              }}
                              className="sr-only"
                            />
                            {isChecked && <Check className="w-3.5 h-3.5 text-[#c084fc] flex-shrink-0" />}
                            <span>{col}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Profile presence filters */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest block mb-1">Presence Indicators</span>
                    
                    {/* Website presence */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider">Website:</span>
                      <div className="grid grid-cols-3 gap-1 bg-[#0c0b10] p-0.5 border border-[#25242a] rounded-lg">
                        {(["all", "has_web", "no_web"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setWebsiteFilter(opt)}
                            className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              websiteFilter === opt
                                ? "bg-[#8b5cf6] text-white"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {opt === "all" ? "All" : opt === "has_web" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Email presence */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider">Email:</span>
                      <div className="grid grid-cols-3 gap-1 bg-[#0c0b10] p-0.5 border border-[#25242a] rounded-lg">
                        {(["all", "has_email", "no_email"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setEmailFilter(opt)}
                            className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              emailFilter === opt
                                ? "bg-[#8b5cf6] text-white"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {opt === "all" ? "All" : opt === "has_email" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Starred & Niche filter */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest block mb-1">Priority & Target</span>
                    
                    {/* Priority Starred filter */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider">Priority:</span>
                      <div className="grid grid-cols-2 gap-1 bg-[#0c0b10] p-0.5 border border-[#25242a] rounded-lg">
                        <button
                          onClick={() => setFilterStarredOnly(false)}
                          className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            !filterStarredOnly
                              ? "bg-[#8b5cf6] text-white"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setFilterStarredOnly(true)}
                          className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            filterStarredOnly
                              ? "bg-[#8b5cf6] text-white"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <Star className={`w-3 h-3 ${filterStarredOnly ? "fill-amber-400 text-amber-300" : ""}`} />
                          <span>Starred</span>
                        </button>
                      </div>
                    </div>

                    {/* Niche search inside filter */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider">Niche:</span>
                      <input
                        type="text"
                        placeholder="Search niche (e.g. dentist)..."
                        value={nicheFilter}
                        onChange={(e) => setNicheFilter(e.target.value)}
                        className="bg-[#0c0b10] border border-[#25242a] rounded-lg py-1.5 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#8b5cf6]"
                      />
                    </div>
                  </div>

                  {/* Ownership & Sorting */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest block mb-1">Sorting & Ownership</span>
                    
                    {/* Assignee select */}
                    {(() => {
                      const isFilterAssigneeOpen = activeFilterDropdown === "assignee";
                      const getFilterAssigneeLabel = () => {
                        if (assigneeFilter === "all") return "All Assignees";
                        if (assigneeFilter === "unassigned") return "Unassigned";
                        if (assigneeFilter === "me") return "Assigned to Me";
                        return users.find(u => u.id === assigneeFilter)?.name || assigneeFilter;
                      };
                      return (
                        <div className="relative custom-dropdown-container flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 tracking-wider">Assigned User:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigneeSearchQuery("");
                              setActiveFilterDropdown(isFilterAssigneeOpen ? null : "assignee");
                            }}
                            className="flex items-center justify-between gap-1.5 px-3 py-2 bg-[#0c0b10] border border-[#25242a] hover:border-[#38373f] rounded-lg text-xs font-bold text-slate-350 hover:text-white transition-all cursor-pointer w-full text-left"
                          >
                            <span className="truncate">{getFilterAssigneeLabel()}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          </button>
                          {isFilterAssigneeOpen && (
                            <div className="absolute top-full mt-1.5 left-0 w-full min-w-[200px] bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl p-1.5 flex flex-col gap-1.5 animate-fade-in-up z-50">
                              <input
                                type="text"
                                placeholder="Filter team..."
                                value={assigneeSearchQuery}
                                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                className="w-full bg-[#0c0b10] border border-[#25242a] rounded-md py-1 px-2.5 text-xs text-white placeholder-slate-650 focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigneeFilter("all");
                                    setActiveFilterDropdown(null);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white ${
                                    assigneeFilter === "all" ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                  }`}
                                >
                                  All Assignees
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigneeFilter("unassigned");
                                    setActiveFilterDropdown(null);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white ${
                                    assigneeFilter === "unassigned" ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                  }`}
                                >
                                  Unassigned
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigneeFilter("me");
                                    setActiveFilterDropdown(null);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white ${
                                    assigneeFilter === "me" ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                  }`}
                                >
                                  Assigned to Me
                                </button>
                                {users.filter(u => u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase())).map((u) => (
                                  u.id !== currentUser.id && (
                                    <button
                                      type="button"
                                      key={u.id}
                                      onClick={() => {
                                        setAssigneeFilter(u.id);
                                        setActiveFilterDropdown(null);
                                      }}
                                      className={`px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white ${
                                        assigneeFilter === u.id ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                      }`}
                                    >
                                      Assigned to {u.name}
                                    </button>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  {/* Sorting fields */}
                  <div className="flex gap-2">
                    {(() => {
                      const isFilterSortByOpen = activeFilterDropdown === "sortBy";
                      const getSortByLabel = () => {
                        switch (sortBy) {
                          case "last_updated": return "Last Updated";
                          case "first_seen": return "Date Found";
                          case "name": return "Business Name";
                          case "status": return "Status";
                          default: return sortBy;
                        }
                      };
                      return (
                        <div className="relative custom-dropdown-container flex-1 flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 tracking-wider">Sort By:</span>
                          <button
                            type="button"
                            onClick={() => setActiveFilterDropdown(isFilterSortByOpen ? null : "sortBy")}
                            className="flex items-center justify-between gap-1.5 px-3 py-2 bg-[#0c0b10] border border-[#25242a] hover:border-[#38373f] rounded-lg text-xs font-bold text-slate-350 hover:text-white transition-all cursor-pointer w-full text-left"
                          >
                            <span className="truncate">{getSortByLabel()}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          </button>
                          {isFilterSortByOpen && (
                            <div className="absolute top-full mt-1.5 left-0 w-full min-w-[140px] bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl py-1 flex flex-col gap-0.5 animate-fade-in-up z-50">
                              {[
                                { value: "last_updated", label: "Last Updated" },
                                { value: "first_seen", label: "Date Found" },
                                { value: "name", label: "Business Name" },
                                { value: "status", label: "Status" }
                              ].map((item) => (
                                <button
                                  type="button"
                                  key={item.value}
                                  onClick={() => {
                                    setSortBy(item.value as any);
                                    setActiveFilterDropdown(null);
                                  }}
                                  className={`px-3 py-2 text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                    sortBy === item.value ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {(() => {
                      const isFilterDirectionOpen = activeFilterDropdown === "sortDirection";
                      return (
                        <div className="relative custom-dropdown-container w-20 flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 tracking-wider">Order:</span>
                          <button
                            type="button"
                            onClick={() => setActiveFilterDropdown(isFilterDirectionOpen ? null : "sortDirection")}
                            className="flex items-center justify-between gap-1.5 px-3 py-2 bg-[#0c0b10] border border-[#25242a] hover:border-[#38373f] rounded-lg text-xs font-bold text-slate-350 hover:text-white transition-all cursor-pointer w-full text-left"
                          >
                            <span>{sortDirection === "desc" ? "Desc" : "Asc"}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          </button>
                          {isFilterDirectionOpen && (
                            <div className="absolute top-full mt-1.5 left-0 w-full bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl py-1 flex flex-col gap-0.5 animate-fade-in-up z-50">
                              {[
                                { value: "desc", label: "Desc" },
                                { value: "asc", label: "Asc" }
                              ].map((item) => (
                                <button
                                  type="button"
                                  key={item.value}
                                  onClick={() => {
                                    setSortDirection(item.value as any);
                                    setActiveFilterDropdown(null);
                                  }}
                                  className={`px-3 py-2 text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                    sortDirection === item.value ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    </div>
                  </div>

                </div>
              )}

              {/* Active Filter Tags */}
              {getActiveFiltersCount() > 0 && (
                <div className="flex flex-wrap items-center gap-2 py-1">
                  <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Active Filters:</span>
                  
                  {searchQuery && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Query: "{searchQuery}"</span>
                      <button onClick={() => setSearchQuery("")} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  {checkedStatuses.size > 0 && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Status: {Array.from(checkedStatuses).join(", ")}</span>
                      <button onClick={() => setCheckedStatuses(new Set())} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  {websiteFilter !== "all" && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Website: {websiteFilter === "has_web" ? "Yes" : "No"}</span>
                      <button onClick={() => setWebsiteFilter("all")} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  {emailFilter !== "all" && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Email: {emailFilter === "has_email" ? "Yes" : "No"}</span>
                      <button onClick={() => setEmailFilter("all")} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  {filterStarredOnly && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Starred Only</span>
                      <button onClick={() => setFilterStarredOnly(false)} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  {nicheFilter && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Niche: {nicheFilter}</span>
                      <button onClick={() => setNicheFilter("")} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  {assigneeFilter !== "all" && (
                    <span className="bg-[#1c1b22] border border-[#25242a] text-slate-300 rounded-md py-0.5 px-2.5 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <span>
                        Assignee:{" "}
                        {assigneeFilter === "unassigned"
                          ? "Unassigned"
                          : assigneeFilter === "me"
                          ? "Me"
                          : users.find((u) => u.id === assigneeFilter)?.name || assigneeFilter}
                      </span>
                      <button onClick={() => setAssigneeFilter("all")} className="hover:text-rose-400 font-extrabold text-[10px] cursor-pointer">×</button>
                    </span>
                  )}

                  <button 
                    onClick={handleResetFilters}
                    className="text-[9px] uppercase font-extrabold text-[#8b5cf6] hover:text-[#c084fc] tracking-wider cursor-pointer ml-1"
                  >
                    Clear All
                  </button>
                </div>
              )}
              
              {/* Table / Kanban display */}
              {loadingLeads && displayedLeads.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 bg-[#141318] border border-[#25242a] rounded-lg shadow-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loading leads database...</span>
                </div>
              ) : displayedLeads.length === 0 ? (
                <div className="py-20 text-center text-slate-500 bg-[#141318] border border-[#25242a] rounded-lg space-y-2 shadow-sm">
                  <Compass className="w-10 h-10 text-slate-700 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">No matching leads in active filters.</p>
                  <p className="text-[9px] text-slate-500 max-w-xs mx-auto leading-normal">
                    Try changing your filters, sorting options, or running a new geographic scan.
                  </p>
                </div>
              ) : viewMode === "table" ? (
                
                <div className="organic-card overflow-hidden shadow-sm bg-[#141318] border-[#25242a]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#25242a] bg-[#1c1b22] text-slate-400 text-[9px] font-extrabold uppercase tracking-widest">
                          <th className="py-4 px-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={displayedLeads.length > 0 && selectedLeadIds.size === displayedLeads.length}
                              onChange={toggleSelectAllLeads}
                              className="rounded border-slate-700 bg-[#0c0b10] text-[#8b5cf6] focus:ring-[#8b5cf6] focus:ring-offset-0 cursor-pointer w-4 h-4"
                            />
                          </th>
                          <th className="py-4 px-6">Business</th>
                          <th className="py-4 px-4">Contact Info</th>
                          <th className="py-4 px-4">Email</th>
                          <th className="py-4 px-4">Niche</th>
                          <th className="py-4 px-4">Status</th>
                          <th className="py-4 px-4">Assignment</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#25242a]/60 text-slate-350 text-xs">
                        {displayedLeads.map((lead) => (
                          <tr
                            key={lead.place_id}
                            className={`hover:bg-[#1c1b22]/55 transition-all cursor-pointer ${
                              selectedLead?.place_id === lead.place_id ? "bg-[#8b5cf6]/5 hover:bg-[#8b5cf6]/10" : ""
                            } ${selectedLeadIds.has(lead.place_id) ? "bg-[#8b5cf6]/10" : ""}`}
                            onClick={() => handleOpenLogs(lead)}
                          >
                            <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedLeadIds.has(lead.place_id)}
                                onChange={() => toggleSelectLead(lead.place_id)}
                                className="rounded border-slate-700 bg-[#0c0b10] text-[#8b5cf6] focus:ring-[#8b5cf6] focus:ring-offset-0 cursor-pointer w-4 h-4"
                              />
                            </td>
                            <td className="py-4 px-6 max-w-[220px]">
                              <div className="flex items-center gap-2.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePriorityToggle(lead.place_id, lead.priority || 0);
                                  }}
                                  className="focus:outline-none transition-transform hover:scale-110 flex-shrink-0"
                                  title={lead.priority ? "Starred Lead" : "Click to Star"}
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      lead.priority
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-slate-600 hover:text-slate-400"
                                    }`}
                                  />
                                </button>
                                <div className="truncate">
                                  <div className="font-bold text-white truncate">{lead.name}</div>
                                  <div className="text-[9px] text-slate-500 truncate mt-0.5">{lead.address || "No address mapped"}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 space-y-1">
                              <div>
                                {lead.phone ? <span className="text-[11px] text-slate-300 font-semibold">{lead.phone}</span> : <span className="text-[10px] text-slate-600">—</span>}
                              </div>
                              <div>
                                {lead.website ? (
                                  <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline">
                                    <Globe className="w-3 h-3" />
                                    <span>Website</span>
                                  </a>
                                ) : (
                                  <span className="inline-block text-[8px] font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded px-1.5 py-0.5">No Website</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {lead.email ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-300 truncate max-w-[130px]">{lead.email}</span>
                                  {renderEmailSourceIcon(lead.email_source)}
                                </div>
                              ) : <span className="text-[10px] text-slate-600">—</span>}
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider bg-[#1c1b22] border border-[#25242a] text-[#c084fc]">{formatNiche(lead.niche)}</span>
                            </td>
                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const leadIdx = displayedLeads.indexOf(lead);
                                const isDropdownOpen = activeDropdown?.placeId === lead.place_id && activeDropdown?.type === "status";
                                return (
                                  <div className="relative custom-dropdown-container">
                                    <button
                                      onClick={() => {
                                        setActiveDropdown(isDropdownOpen ? null : { placeId: lead.place_id, type: "status" });
                                      }}
                                      className={`flex items-center justify-between gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${getStatusStyles(lead.status)}`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(lead.status)}`} />
                                        <span>{lead.status}</span>
                                      </div>
                                      <ChevronDown className="w-3 h-3 opacity-60" />
                                    </button>
                                    
                                    {isDropdownOpen && (
                                      <div className={`absolute z-50 left-0 w-36 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl py-1 flex flex-col gap-0.5 animate-slide-up ${
                                        leadIdx >= displayedLeads.length - 2 ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                      }`}>
                                        {boardColumns.map((col) => (
                                          <button
                                            key={col}
                                            onClick={() => {
                                              handleStatusChange(lead.place_id, col);
                                              setActiveDropdown(null);
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                              lead.status === col ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                            }`}
                                          >
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(col)}`} />
                                            <span>{col}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const leadIdx = displayedLeads.indexOf(lead);
                                const isAssigneeOpen = activeDropdown?.placeId === lead.place_id && activeDropdown?.type === "assignee";
                                const currentAssigneeUser = users.find((u) => u.id === lead.assigned_to);
                                const filteredUsers = users.filter((u) => 
                                  u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) || 
                                  u.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
                                );
                                return (
                                  <div className="relative custom-dropdown-container">
                                    <button
                                      onClick={() => {
                                        setAssigneeSearchQuery("");
                                        setActiveDropdown(isAssigneeOpen ? null : { placeId: lead.place_id, type: "assignee" });
                                      }}
                                      className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-[#1c1b22] border border-[#25242a] hover:border-[#38373f] rounded-lg text-xs font-bold text-slate-350 hover:text-white transition-all cursor-pointer min-w-[120px] max-w-[150px]"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        {currentAssigneeUser ? (
                                          <>
                                            <span className={`w-4 h-4 rounded-md flex items-center justify-center font-extrabold text-[9px] uppercase ${getAvatarBg(currentAssigneeUser.name)}`}>
                                              {getInitials(currentAssigneeUser.name)}
                                            </span>
                                            <span className="truncate">{currentAssigneeUser.id === currentUser.id ? "Me" : currentAssigneeUser.name}</span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="w-4 h-4 rounded-md bg-[#25242a] flex items-center justify-center font-bold text-[9px] text-slate-505">—</span>
                                            <span className="text-slate-505 font-semibold">Unassigned</span>
                                          </>
                                        )}
                                      </div>
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    </button>

                                    {isAssigneeOpen && (
                                      <div className={`absolute z-50 left-0 w-52 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl p-1.5 flex flex-col gap-1.5 animate-slide-up ${
                                        leadIdx >= displayedLeads.length - 3 ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                      }`}>
                                        <input
                                          type="text"
                                          placeholder="Filter team..."
                                          value={assigneeSearchQuery}
                                          onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                          className="w-full bg-[#0c0b10] border border-[#25242a] rounded-md py-1 px-2.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-[#8b5cf6] transition-all"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        
                                        <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                                          <button
                                            onClick={() => {
                                              handleAssignment(lead.place_id, null);
                                              setActiveDropdown(null);
                                            }}
                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                              !lead.assigned_to ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                            }`}
                                          >
                                            <span className="w-4.5 h-4.5 rounded-md bg-[#25242a] flex items-center justify-center font-bold text-[9px] text-slate-500">—</span>
                                            <span>Unassigned</span>
                                          </button>

                                          {filteredUsers.map((u) => (
                                            <button
                                              key={u.id}
                                              onClick={() => {
                                                handleAssignment(lead.place_id, u.id);
                                                setActiveDropdown(null);
                                              }}
                                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                                lead.assigned_to === u.id ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                              }`}
                                            >
                                              <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center font-extrabold text-[9px] uppercase ${getAvatarBg(u.name)}`}>
                                                {getInitials(u.name)}
                                              </span>
                                              <span className="truncate">{u.id === currentUser.id ? "Me" : u.name}</span>
                                            </button>
                                          ))}
                                          {filteredUsers.length === 0 && (
                                            <div className="text-[10px] text-slate-650 text-center py-2">No team members found</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEditModal(lead)} className="text-slate-500 hover:text-white p-1.5 rounded hover:bg-[#1c1b22] transition-colors" title="Edit">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleOpenLogs(lead)} className="text-slate-500 hover:text-white p-1.5 rounded hover:bg-[#1c1b22] transition-colors" title="Details">
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
                  {boardColumns.map((colName) => {
                    const colLeads = displayedLeads.filter((l) => l.status === colName);
                    return (
                      <div
                        key={colName}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, colName)}
                        className="organic-card p-4 flex flex-col min-h-[500px] bg-[#141318] border-[#25242a]"
                      >
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#25242a]">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-white">{colName}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[#1c1b22] border border-[#25242a] text-[#c084fc]">{colLeads.length}</span>
                        </div>
                        <div className="flex-grow space-y-3 overflow-y-auto max-h-[550px] pr-0.5">
                          {colLeads.map((lead) => (
                            <div
                              key={lead.place_id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, lead.place_id)}
                              onClick={() => handleOpenLogs(lead)}
                              className={`bg-[#1c1b22] border rounded-lg p-3.5 shadow-sm active:cursor-grabbing hover:border-[#38373f] hover:shadow-md transition-all ${
                                selectedLead?.place_id === lead.place_id ? "border-[#8b5cf6] ring-1 ring-[#8b5cf6]" : "border-[#25242a]"
                              }`}
                            >
                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-white text-xs truncate leading-snug">{lead.name}</h4>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePriorityToggle(lead.place_id, lead.priority || 0);
                                      }}
                                      className="focus:outline-none transition-transform hover:scale-110 flex-shrink-0"
                                      title={lead.priority ? "Starred Lead" : "Click to Star"}
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${
                                          lead.priority
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-slate-650 hover:text-slate-400"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                  <p className="text-[9px] text-slate-500 truncate mt-0.5">{lead.address || "No address mapped"}</p>
                                </div>
                                {lead.notes && <p className="text-[9px] text-slate-400 bg-[#0c0b10] border border-[#25242a] px-2 py-1 rounded italic truncate">{lead.notes}</p>}
                                <div className="space-y-1 bg-[#0c0b10] rounded-md p-2.5 border border-[#25242a] text-[9px]">
                                  <div className="flex items-center justify-between text-slate-500">
                                    <span className="font-bold">Website</span>
                                    {lead.website ? <span className="text-indigo-400 font-bold">Yes</span> : <span className="text-rose-455 font-bold uppercase text-[7px] bg-rose-500/10 px-1 py-0.2 rounded">None</span>}
                                  </div>
                                  <div className="flex items-center justify-between text-slate-500">
                                    <span className="font-bold">Phone</span>
                                    <span className="truncate max-w-[80px] text-slate-300 font-semibold">{lead.phone || "—"}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-505">
                                    <span className="font-bold">Email</span>
                                    <span className="truncate max-w-[80px] text-slate-300 font-bold">{lead.email || "—"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-[#25242a]" onClick={(e) => e.stopPropagation()}>
                                  {(() => {
                                    const colLeadIdx = colLeads.indexOf(lead);
                                    const isAssigneeOpen = activeDropdown?.placeId === lead.place_id && activeDropdown?.type === "assignee";
                                    const currentAssigneeUser = users.find((u) => u.id === lead.assigned_to);
                                    const filteredUsers = users.filter((u) => 
                                      u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) || 
                                      u.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
                                    );
                                    return (
                                      <div className="relative custom-dropdown-container">
                                        <button
                                          onClick={() => {
                                            setAssigneeSearchQuery("");
                                            setActiveDropdown(isAssigneeOpen ? null : { placeId: lead.place_id, type: "assignee" });
                                          }}
                                          className="flex items-center justify-between gap-1 px-2 py-1 bg-[#141318] border border-[#25242a] hover:border-[#38373f] rounded-lg text-[10px] font-bold text-slate-350 hover:text-white transition-all cursor-pointer min-w-[95px] max-w-[120px]"
                                        >
                                          <div className="flex items-center gap-1 truncate">
                                            {currentAssigneeUser ? (
                                              <>
                                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-extrabold text-[8px] uppercase ${getAvatarBg(currentAssigneeUser.name)}`}>
                                                  {getInitials(currentAssigneeUser.name)}
                                                </span>
                                                <span className="truncate">{currentAssigneeUser.id === currentUser.id ? "Me" : currentAssigneeUser.name}</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="w-3.5 h-3.5 rounded bg-[#25242a] flex items-center justify-center font-bold text-[8px] text-slate-500">—</span>
                                                <span className="text-slate-505 font-semibold">Unassigned</span>
                                              </>
                                            )}
                                          </div>
                                          <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                        </button>

                                        {isAssigneeOpen && (
                                          <div className={`absolute z-50 left-0 w-48 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl p-1.5 flex flex-col gap-1.5 animate-slide-up ${
                                            colLeadIdx >= 1 ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                          }`}>
                                            <input
                                              type="text"
                                              placeholder="Filter team..."
                                              value={assigneeSearchQuery}
                                              onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                              className="w-full bg-[#0c0b10] border border-[#25242a] rounded-md py-1 px-2 text-[11px] text-white placeholder-slate-650 focus:outline-none"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            
                                            <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                                              <button
                                                onClick={() => {
                                                  handleAssignment(lead.place_id, null);
                                                  setActiveDropdown(null);
                                                }}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                                  !lead.assigned_to ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                                }`}
                                              >
                                                <span className="w-4 h-4 rounded bg-[#25242a] flex items-center justify-center font-bold text-[8px] text-slate-505">—</span>
                                                <span>Unassigned</span>
                                              </button>

                                              {filteredUsers.map((u) => (
                                                <button
                                                  key={u.id}
                                                  onClick={() => {
                                                    handleAssignment(lead.place_id, u.id);
                                                    setActiveDropdown(null);
                                                  }}
                                                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                                                    lead.assigned_to === u.id ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                                                  }`}
                                                >
                                                  <span className={`w-4.5 h-4.5 rounded flex items-center justify-center font-extrabold text-[8px] uppercase ${getAvatarBg(u.name)}`}>
                                                    {getInitials(u.name)}
                                                  </span>
                                                  <span className="truncate">{u.id === currentUser.id ? "Me" : u.name}</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => openEditModal(lead)} className="p-1 text-slate-500 hover:text-white rounded hover:bg-[#141318]"><Edit3 className="w-3 h-3" /></button>
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
          )}

        </main>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedLeadIds.size > 0 && (
        <div 
          className="fixed bottom-6 bg-[#141318]/95 backdrop-blur-md border border-[#25242a] text-white py-3 px-5 rounded-full shadow-2xl flex items-center gap-4 z-50 transition-all duration-300 animate-slide-up flex-nowrap whitespace-nowrap"
          style={{ left: "calc(50% + 40px)", transform: "translate(-50%, 0)" }}
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs bg-[#8b5cf6] text-white px-2 py-0.5 rounded-full font-extrabold">{selectedLeadIds.size}</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-450">Selected</span>
          </div>

          <div className="w-px h-6 bg-[#25242a] flex-shrink-0" />

          <div className="flex items-center gap-3 text-xs font-bold flex-nowrap">
            {(() => {
              const isBulkAssignOpen = activeBulkDropdown === "assignee";
              const filteredUsers = users.filter(u => 
                u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
              );
              return (
                <div className="relative custom-dropdown-container">
                  <button
                    onClick={() => {
                      setAssigneeSearchQuery("");
                      setActiveBulkDropdown(isBulkAssignOpen ? null : "assignee");
                    }}
                    className="bg-[#0c0b10] hover:bg-[#1c1b22] border border-[#25242a] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none cursor-pointer font-bold transition-all shadow-inner flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>Assign To...</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  </button>
                  {isBulkAssignOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-52 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl p-1.5 flex flex-col gap-1.5 animate-fade-in-up z-50">
                      <input
                        type="text"
                        placeholder="Filter team..."
                        value={assigneeSearchQuery}
                        onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                        className="w-full bg-[#0c0b10] border border-[#25242a] rounded-md py-1 px-2.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-[#8b5cf6] transition-all"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                        <button
                          onClick={() => {
                            handleBulkAction("assign", null);
                            setActiveBulkDropdown(null);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white text-slate-350 transition-colors"
                        >
                          <span className="w-4.5 h-4.5 rounded-md bg-[#25242a] flex items-center justify-center font-bold text-[9px] text-slate-505">—</span>
                          <span>Unassigned</span>
                        </button>
                        {filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              handleBulkAction("assign", u.id);
                              setActiveBulkDropdown(null);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white text-slate-350 transition-colors"
                          >
                            <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center font-extrabold text-[9px] uppercase ${getAvatarBg(u.name)}`}>
                              {getInitials(u.name)}
                            </span>
                            <span className="truncate">{u.id === currentUser.id ? "Me" : u.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const isBulkStatusOpen = activeBulkDropdown === "status";
              return (
                <div className="relative custom-dropdown-container">
                  <button
                    onClick={() => setActiveBulkDropdown(isBulkStatusOpen ? null : "status")}
                    className="bg-[#0c0b10] hover:bg-[#1c1b22] border border-[#25242a] rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none cursor-pointer font-bold transition-all shadow-inner flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>Status...</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  </button>
                  {isBulkStatusOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-36 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl py-1 flex flex-col gap-0.5 animate-fade-in-up z-50">
                      {boardColumns.map((col) => (
                        <button
                          key={col}
                          onClick={() => {
                            handleBulkAction("status", col);
                            setActiveBulkDropdown(null);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white text-slate-350 transition-colors"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(col)}`} />
                          <span>{col}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="w-px h-6 bg-[#25242a] flex-shrink-0" />

            <button
              onClick={() => handleBulkAction("priority", 1)}
              className="p-2 bg-[#0c0b10] hover:bg-[#1c1b22] border border-[#25242a] rounded-lg text-amber-400 hover:text-amber-300 transition-all active:scale-95 cursor-pointer flex-shrink-0"
              title="Star Selected"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
            </button>

            <button
              onClick={() => handleBulkAction("priority", 0)}
              className="p-2 bg-[#0c0b10] hover:bg-[#1c1b22] border border-[#25242a] rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer flex-shrink-0"
              title="Unstar Selected"
            >
              <Star className="w-4 h-4 text-slate-400" />
            </button>

            <div className="w-px h-6 bg-[#25242a] flex-shrink-0" />

            <button
              onClick={() => handleBulkAction("delete", null)}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-455 hover:text-rose-300 transition-all active:scale-95 cursor-pointer flex-shrink-0"
              title="Delete Selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-6 bg-[#25242a] flex-shrink-0" />

          <button
            onClick={() => setSelectedLeadIds(new Set())}
            className="p-2 hover:bg-[#1c1b22] rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            title="Clear Selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Manual Details Edit Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm transition-all"
            onClick={() => setEditingLead(null)}
          />

          <div className="relative z-10 w-full max-w-lg bg-[#141318] border border-[#25242a] rounded-xl overflow-hidden shadow-2xl p-8 space-y-6 text-white">
            <div className="flex items-center justify-between border-b border-[#25242a] pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-widest">
                  Edit Lead Details
                </h3>
              </div>
              <button onClick={() => setEditingLead(null)} className="rounded p-1.5 text-slate-500 hover:text-white hover:bg-[#1c1b22] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Business Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg py-2.5 px-4 focus:border-[#8b5cf6] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg py-2.5 px-4 focus:border-[#8b5cf6] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg py-2.5 px-4 focus:border-[#8b5cf6] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Internal Notes</label>
                <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg py-2.5 px-4 focus:border-[#8b5cf6] resize-none focus:outline-none" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-[#25242a]">
                <button type="button" onClick={() => setEditingLead(null)} className="font-bold py-2 px-5 rounded-lg text-xs cursor-pointer bg-[#1c1b22] text-slate-300 hover:text-white border border-[#25242a]">Cancel</button>
                <button type="submit" className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold py-2 px-5 rounded-lg text-xs cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Audit Logs / Comments Sidebar Drawer */}
      {selectedLead && (
        <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-[#141318] shadow-2xl z-50 border-l border-[#25242a] flex flex-col transform transition-transform">
          <div className="p-6 border-b border-[#25242a] bg-[#1c1b22] flex justify-between items-start">
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-center gap-2 w-full">
                {inlineEditingField === "name" ? (
                  <input
                    type="text"
                    value={inlineEditValue}
                    onChange={(e) => setInlineEditValue(e.target.value)}
                    onBlur={() => {
                      if (inlineEditValue.trim() && inlineEditValue !== selectedLead.name) {
                        handleInlineSave("name", inlineEditValue.trim());
                      } else {
                        setInlineEditingField(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (inlineEditValue.trim() && inlineEditValue !== selectedLead.name) {
                          handleInlineSave("name", inlineEditValue.trim());
                        } else {
                          setInlineEditingField(null);
                        }
                      } else if (e.key === "Escape") {
                        setInlineEditingField(null);
                      }
                    }}
                    autoFocus
                    className="bg-[#0c0b10] border border-[#25242a] text-white text-base font-extrabold px-2.5 py-1 rounded-lg focus:outline-none focus:border-[#8b5cf6] w-full"
                  />
                ) : (
                  <h2 
                    onClick={() => {
                      setInlineEditingField("name");
                      setInlineEditValue(selectedLead.name);
                    }}
                    className="text-lg font-extrabold text-white truncate hover:bg-[#141318] hover:outline-dashed hover:outline-1 hover:outline-slate-500/50 px-2 py-0.5 rounded transition-all cursor-pointer flex items-center justify-between group w-full"
                    title="Click to edit name"
                  >
                    <span className="truncate">{selectedLead.name}</span>
                    <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-60 text-slate-400 ml-2 flex-shrink-0" />
                  </h2>
                )}
                <button
                  onClick={() => handlePriorityToggle(selectedLead.place_id, selectedLead.priority || 0)}
                  className="p-1 rounded hover:bg-[#141318] transition-all flex-shrink-0 focus:outline-none cursor-pointer ml-1"
                  title={selectedLead.priority ? "Starred (High Priority)" : "Unstarred (Normal Priority)"}
                >
                  <Star className={`w-5 h-5 ${selectedLead.priority ? "fill-amber-400 text-amber-450 animate-pulse" : "text-slate-650 hover:text-slate-400"}`} />
                </button>
              </div>
              <p className="text-[10px] text-[#c084fc] uppercase tracking-widest font-bold mt-1">Lead Intelligence Hub</p>
            </div>
            <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-[#141318] rounded-lg transition-all cursor-pointer flex-shrink-0 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions (Status & Assignment) */}
          <div className="p-6 border-b border-[#25242a] bg-[#1c1b22]/50 flex flex-wrap gap-4 items-center justify-between">
            {(() => {
              const isStatusOpen = activeDropdown?.placeId === selectedLead.place_id && activeDropdown?.type === "drawer_status";
              return (
                <div className="flex flex-col gap-1 relative custom-dropdown-container">
                  <span className="text-[9px] font-extrabold text-slate-505 uppercase tracking-widest">Outreach Status</span>
                  <button
                    onClick={() => {
                      setActiveDropdown(isStatusOpen ? null : { placeId: selectedLead.place_id, type: "drawer_status" });
                    }}
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm min-w-[130px] ${getStatusStyles(selectedLead.status)}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(selectedLead.status)}`} />
                      <span>{selectedLead.status}</span>
                    </div>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  
                  {isStatusOpen && (
                    <div className="absolute top-full mt-1.5 left-0 w-36 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl py-1 flex flex-col gap-0.5 animate-fade-in-up z-50">
                      {boardColumns.map((col) => (
                        <button
                          key={col}
                          onClick={() => {
                            handleStatusChange(selectedLead.place_id, col);
                            setActiveDropdown(null);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                            selectedLead.status === col ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(col)}`} />
                          <span>{col}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const isAssigneeOpen = activeDropdown?.placeId === selectedLead.place_id && activeDropdown?.type === "drawer_assignee";
              const currentAssigneeUser = users.find((u) => u.id === selectedLead.assigned_to);
              const filteredUsers = users.filter((u) => 
                u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) || 
                u.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
              );
              return (
                <div className="flex flex-col gap-1 relative custom-dropdown-container">
                  <span className="text-[9px] font-extrabold text-slate-505 uppercase tracking-widest">Assignee</span>
                  <button
                    onClick={() => {
                      setAssigneeSearchQuery("");
                      setActiveDropdown(isAssigneeOpen ? null : { placeId: selectedLead.place_id, type: "drawer_assignee" });
                    }}
                    className="flex items-center justify-between gap-1.5 px-3 py-2 bg-[#1c1b22] border border-[#25242a] hover:border-[#38373f] rounded-lg text-xs font-bold text-slate-205 hover:text-white transition-all cursor-pointer min-w-[140px] max-w-[180px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {currentAssigneeUser ? (
                        <>
                          <span className={`w-4 h-4 rounded-md flex items-center justify-center font-extrabold text-[9px] uppercase ${getAvatarBg(currentAssigneeUser.name)}`}>
                            {getInitials(currentAssigneeUser.name)}
                          </span>
                          <span className="truncate">{currentAssigneeUser.id === currentUser.id ? "Me" : currentAssigneeUser.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="w-4 h-4 rounded-md bg-[#25242a] flex items-center justify-center font-bold text-[9px] text-slate-500">—</span>
                          <span className="text-slate-505 font-semibold">Unassigned</span>
                        </>
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  </button>

                  {isAssigneeOpen && (
                    <div className="absolute top-full mt-1.5 left-0 w-52 bg-[#141318] border border-[#25242a] rounded-lg shadow-2xl p-1.5 flex flex-col gap-1.5 animate-fade-in-up z-50">
                      <input
                        type="text"
                        placeholder="Filter team..."
                        value={assigneeSearchQuery}
                        onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                        className="w-full bg-[#0c0b10] border border-[#25242a] rounded-md py-1 px-2.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-[#8b5cf6] transition-all"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
                        <button
                          onClick={() => {
                            handleAssignment(selectedLead.place_id, null);
                            setActiveDropdown(null);
                          }}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                            !selectedLead.assigned_to ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                          }`}
                        >
                          <span className="w-4.5 h-4.5 rounded-md bg-[#25242a] flex items-center justify-center font-bold text-[9px] text-slate-500">—</span>
                          <span>Unassigned</span>
                        </button>

                        {filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              handleAssignment(selectedLead.place_id, u.id);
                              setActiveDropdown(null);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer hover:bg-[#1c1b22] hover:text-white transition-colors ${
                              selectedLead.assigned_to === u.id ? "text-[#c084fc] font-bold bg-[#8b5cf6]/5" : "text-slate-350"
                            }`}
                          >
                            <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center font-extrabold text-[9px] uppercase ${getAvatarBg(u.name)}`}>
                              {getInitials(u.name)}
                            </span>
                            <span className="truncate">{u.id === currentUser.id ? "Me" : u.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-[#25242a] bg-[#1c1b22] px-6">
            {(["info", "comments", "audit"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDrawerTab(tab)}
                className={`flex-1 py-3.5 text-xs font-bold transition-all border-b-2 text-center cursor-pointer ${
                  drawerTab === tab
                    ? "border-[#8b5cf6] text-white"
                    : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                {tab === "info" ? "Intel & Tasks" : tab === "comments" ? "Comments" : "Audit Trail"}
              </button>
            ))}
          </div>

          {/* Drawer Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            
            {/* 1. Intel & Tasks Tab */}
            {drawerTab === "info" && (
              <div className="space-y-6">
                
                {/* Contact Metadata Box */}
                <div className="space-y-1 bg-[#1c1b22] rounded-lg p-3 border border-[#25242a]">
                  {/* Website Row */}
                  <div className="flex items-center justify-between text-xs border-b border-[#25242a] pb-2 pt-1 min-h-[38px] group px-1">
                    <span className="font-bold text-slate-500">Website</span>
                    {inlineEditingField === "website" ? (
                      <input
                        type="text"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onBlur={() => {
                          if (inlineEditValue.trim() !== (selectedLead.website || "")) {
                            handleInlineSave("website", inlineEditValue.trim());
                          } else {
                            setInlineEditingField(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInlineSave("website", inlineEditValue.trim());
                          } else if (e.key === "Escape") {
                            setInlineEditingField(null);
                          }
                        }}
                        autoFocus
                        className="bg-[#0c0b10] border border-[#25242a] text-white text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-[#8b5cf6] w-2/3 text-right"
                      />
                    ) : (
                      <div 
                        onClick={() => {
                          setInlineEditingField("website");
                          setInlineEditValue(selectedLead.website || "");
                        }}
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-[#25242a]/30 px-2 py-1 rounded transition-all max-w-[70%] min-w-[60px] justify-end"
                        title="Click to edit website"
                      >
                        {selectedLead.website ? (
                          <span className="text-blue-400 font-bold hover:underline truncate text-right block max-w-[180px]">
                            {selectedLead.website}
                          </span>
                        ) : (
                          <span className="inline-block text-[8px] font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-455 border border-rose-500/20 rounded px-1.5 py-0.5">Missing</span>
                        )}
                        {selectedLead.website && (
                          <a
                            href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-[#25242a]"
                            title="Open external link"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* Phone Row */}
                  <div className="flex items-center justify-between text-xs border-b border-[#25242a] pb-2 pt-2 min-h-[38px] group px-1">
                    <span className="font-bold text-slate-505">Phone</span>
                    {inlineEditingField === "phone" ? (
                      <input
                        type="text"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onBlur={() => {
                          if (inlineEditValue.trim() !== (selectedLead.phone || "")) {
                            handleInlineSave("phone", inlineEditValue.trim());
                          } else {
                            setInlineEditingField(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInlineSave("phone", inlineEditValue.trim());
                          } else if (e.key === "Escape") {
                            setInlineEditingField(null);
                          }
                        }}
                        autoFocus
                        className="bg-[#0c0b10] border border-[#25242a] text-white text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-[#8b5cf6] w-2/3 text-right"
                      />
                    ) : (
                      <div 
                        onClick={() => {
                          setInlineEditingField("phone");
                          setInlineEditValue(selectedLead.phone || "");
                        }}
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-[#25242a]/30 px-2 py-1 rounded transition-all max-w-[70%] min-w-[60px] justify-end"
                        title="Click to edit phone"
                      >
                        <span className="font-semibold text-white truncate max-w-[200px]">{selectedLead.phone || "—"}</span>
                        <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* Email Row */}
                  <div className="flex items-center justify-between text-xs border-b border-[#25242a] pb-2 pt-2 min-h-[38px] group px-1">
                    <span className="font-bold text-slate-505">Email Address</span>
                    {inlineEditingField === "email" ? (
                      <input
                        type="email"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onBlur={() => {
                          if (inlineEditValue.trim() !== (selectedLead.email || "")) {
                            handleInlineSave("email", inlineEditValue.trim());
                          } else {
                            setInlineEditingField(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInlineSave("email", inlineEditValue.trim());
                          } else if (e.key === "Escape") {
                            setInlineEditingField(null);
                          }
                        }}
                        autoFocus
                        className="bg-[#0c0b10] border border-[#25242a] text-white text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-[#8b5cf6] w-2/3 text-right"
                      />
                    ) : (
                      <div 
                        onClick={() => {
                          setInlineEditingField("email");
                          setInlineEditValue(selectedLead.email || "");
                        }}
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-[#25242a]/30 px-2 py-1 rounded transition-all max-w-[70%] min-w-[60px] justify-end"
                        title="Click to edit email"
                      >
                        <span className="font-bold text-white truncate max-w-[180px]">{selectedLead.email || "—"}</span>
                        {selectedLead.email && renderEmailSourceIcon(selectedLead.email_source)}
                        <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* Address Row */}
                  <div className="flex items-center justify-between text-xs border-b border-[#25242a] pb-2 pt-2 min-h-[38px] group px-1">
                    <span className="font-bold text-slate-550">Physical Address</span>
                    {inlineEditingField === "address" ? (
                      <input
                        type="text"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onBlur={() => {
                          if (inlineEditValue.trim() !== (selectedLead.address || "")) {
                            handleInlineSave("address", inlineEditValue.trim());
                          } else {
                            setInlineEditingField(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInlineSave("address", inlineEditValue.trim());
                          } else if (e.key === "Escape") {
                            setInlineEditingField(null);
                          }
                        }}
                        autoFocus
                        className="bg-[#0c0b10] border border-[#25242a] text-white text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-[#8b5cf6] w-2/3 text-right"
                      />
                    ) : (
                      <div 
                        onClick={() => {
                          setInlineEditingField("address");
                          setInlineEditValue(selectedLead.address || "");
                        }}
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-[#25242a]/30 px-2 py-1 rounded transition-all max-w-[70%] min-w-[60px] justify-end"
                        title="Click to edit address"
                      >
                        <span className="font-medium text-slate-200 truncate max-w-[200px] text-right" title={selectedLead.address || ""}>
                          {selectedLead.address || "—"}
                        </span>
                        <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* Niche Row */}
                  <div className="flex items-center justify-between text-xs pt-2 pb-1 min-h-[38px] group px-1">
                    <span className="font-bold text-slate-550">Category / Niche</span>
                    {inlineEditingField === "niche" ? (
                      <input
                        type="text"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onBlur={() => {
                          if (inlineEditValue.trim() !== (selectedLead.niche || "")) {
                            handleInlineSave("niche", inlineEditValue.trim());
                          } else {
                            setInlineEditingField(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInlineSave("niche", inlineEditValue.trim());
                          } else if (e.key === "Escape") {
                            setInlineEditingField(null);
                          }
                        }}
                        autoFocus
                        className="bg-[#0c0b10] border border-[#25242a] text-white text-xs px-2.5 py-1 rounded-md focus:outline-none focus:border-[#8b5cf6] w-2/3 text-right"
                      />
                    ) : (
                      <div 
                        onClick={() => {
                          setInlineEditingField("niche");
                          setInlineEditValue(selectedLead.niche || "");
                        }}
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-[#25242a]/30 px-2 py-1 rounded transition-all max-w-[70%] min-w-[60px] justify-end"
                        title="Click to edit category / niche"
                      >
                        <span className="px-2.5 py-0.5 rounded-md text-[9px] font-bold bg-[#141318] text-[#c084fc] border border-[#25242a]">
                          {formatNiche(selectedLead.niche)}
                        </span>
                        <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Internal Notes Box */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Internal Notes</h3>
                  {inlineEditingField === "notes" ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setInlineEditingField(null);
                          }
                        }}
                        autoFocus
                        placeholder="Type internal team notes, contact names, or customized offers here..."
                        className="w-full bg-[#0c0b10] border border-[#25242a] rounded-lg p-3 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-[#8b5cf6] resize-y leading-relaxed"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setInlineEditingField(null)}
                          className="font-bold py-1.5 px-3 rounded-md text-[10px] cursor-pointer bg-[#1c1b22] text-slate-400 hover:text-white border border-[#25242a] hover:bg-[#25242a] transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInlineSave("notes", inlineEditValue)}
                          className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold py-1.5 px-3 rounded-md text-[10px] cursor-pointer hover:shadow-lg transition-all"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        setInlineEditingField("notes");
                        setInlineEditValue(selectedLead.notes || "");
                      }}
                      className="bg-[#1c1b22] border border-[#25242a] hover:border-[#38373f]/80 rounded-lg p-4 text-xs text-slate-350 hover:text-slate-200 cursor-pointer min-h-[80px] transition-all relative group"
                      title="Click to edit notes"
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {selectedLead.notes ? (
                          selectedLead.notes
                        ) : (
                          <span className="italic text-slate-500">No notes yet. Click here to add team notes or follow-up details...</span>
                        )}
                      </div>
                      <Edit3 className="absolute right-3 top-3 w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Workflow Checklist */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Workflow Checklist</h3>
                  <div className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-4 space-y-3">
                    {getLeadChecklist(selectedLead).map((task: any, index: number) => {
                      const checklist = getLeadChecklist(selectedLead);
                      return (
                        <label key={task.id} className="flex items-center gap-3 text-xs text-slate-300 font-bold select-none cursor-pointer hover:text-white transition-colors">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {
                              const nextChecklist = [...checklist];
                              nextChecklist[index] = { ...task, completed: !task.completed };
                              handleChecklistChange(selectedLead.place_id, nextChecklist);
                            }}
                            className="rounded border-slate-700 bg-[#0c0b10] text-[#8b5cf6] focus:ring-[#8b5cf6] focus:ring-offset-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={task.completed ? "line-through text-slate-500 font-medium" : ""}>{task.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Comments Tab */}
            {drawerTab === "comments" && (
              <div className="flex flex-col h-full space-y-4">
                
                {/* Scrollable comments stream */}
                <div className="flex-grow space-y-3 overflow-y-auto max-h-[380px] pr-1">
                  {loadingComments ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#8b5cf6]" /></div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-12 text-slate-550 bg-[#1c1b22] border border-[#25242a] rounded-lg">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="text-xs font-bold text-slate-400">No team comments yet.</p>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">Write notes about phone calls, contact names, or customized deals here.</p>
                    </div>
                  ) : (
                    comments.map((cmt) => (
                      <div key={cmt.id} className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-4 flex gap-3 items-start">
                        <div className="w-7 h-7 rounded-md bg-[#8b5cf6] text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 shadow-sm">
                          {(cmt.user_name || "T").charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold text-white">{cmt.user_name || "Team Member"}</span>
                            <span className="text-[9px] text-slate-500">{new Date(cmt.timestamp).toLocaleDateString()} at {new Date(cmt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{cmt.comment}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Box Form */}
                <form onSubmit={handleAddComment} className="border-t border-[#25242a] pt-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a team note / comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 bg-[#0c0b10] border border-[#25242a] rounded-lg py-2.5 px-4 text-xs text-slate-205 focus:border-[#8b5cf6] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-sm flex-shrink-0 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}

            {/* 3. Audit Trail Tab */}
            {drawerTab === "audit" && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Audit Timeline</h3>
                
                <div className="space-y-4">
                  {loadingLogs ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#8b5cf6]" /></div>
                  ) : activityLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No activity history.</p>
                  ) : (
                    activityLogs.map((log) => (
                      <div key={log.id} className="relative pl-6">
                        <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-[#8b5cf6] ring-4 ring-[#141318]" />
                        <div className="absolute left-2 top-3 bottom-[-16px] w-px bg-[#25242a]" />
                        
                        <div className="bg-[#1c1b22] border border-[#25242a] rounded-lg p-3 shadow-sm">
                          <p className="text-[11px] text-slate-200">
                            <strong className="font-bold text-white">{log.user_name || "System"}</strong>{" "}
                            {log.action === "scraped_email" && "extracted email"}
                            {log.action === "status_change" && `changed status from "${log.from_value}" to "${log.to_value}"`}
                            {log.action === "assignment" && (log.to_value ? `assigned lead to team member` : `unassigned lead`)}
                            {log.action === "edit_name" && `renamed business to "${log.to_value}"`}
                            {log.action === "edit_phone" && `updated phone to "${log.to_value}"`}
                            {log.action === "edit_email" && `updated email to "${log.to_value}"`}
                            {log.action === "edit_notes" && `updated internal notes`}
                            {log.action === "priority_change" && (Number(log.to_value) ? "starred this lead" : "unstarred this lead")}
                            {log.action === "checklist_change" && "updated workflow checklist"}
                            {log.action === "add_comment" && `posted comment: "${log.to_value}"`}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
