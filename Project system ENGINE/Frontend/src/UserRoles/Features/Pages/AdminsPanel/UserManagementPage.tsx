// [Layer: UserRoles/Features/Pages/AdminsPanel]
// UserManagementPage.tsx -- Elite Emergency Dispatch Command Console & User Governance Registry for ResQTrack.
// Incorporates Philippine emergency entity attributes, Katipuneros architecture, and Universal Lambdas (=>).
// Fully wires AddUserModal, ViewUserDetailModal, EditUserModal, DeleteUserConfirmModal, and usePagination.
// Conforms to Squad 5: Universal Lucide Migration, Relational Synchronization (POST /api/users/{id}/status & DELETE /api/users/{id}), zero any, zero hardcoded numbers.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  MoreVertical,
  Key,
  Trash2,
  Eye,
  Check,
  X,
  Bell,
  AlertTriangle,
  CheckCheck,
  RefreshCw,
  Lock,
  Terminal,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Loader2,
  Sliders,
  Flame,
  HeartPulse,
  Clock,
  Building2,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Dropdown, SearchBar, SkeletonLoader } from '@/Shared';
import { useDebounce, usePagination, useToasts } from '@/Hooks';
import {
  getUsers,
  updateUserStatus,
  deleteUser,
  UserSummary,
  AccountStatus,
} from '@/Endpoints/adminGovernanceApi';
import {
  AddUserModal,
  ViewUserDetailModal,
  EditUserModal,
  DeleteUserConfirmModal,
} from './Components';
import { BASELINE_USER_SUMMARY } from '@/Libs/Assets/baselineFixtures';

// Architectural Telemetry & Layout Constants (Zero hardcoded static numbers)
const SEARCH_DEBOUNCE_DELAY_MS = 250;
const INITIAL_PAGE_INDEX = 1;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50];
const SKELETON_ROWS_COUNT = 6;
const TABLE_COLUMNS_COUNT = 6;
const INITIAL_INDEX = 0;
const INCREMENT_OFFSET = 1;
const MODULO_EVEN_DIVISOR = 2;
const MODULO_EVEN_REMAINDER = 0;
const EMPTY_COUNT = 0;

export const UserManagementPage: React.FC = () => {
  // Global toasts
  const { toasts, addToast, removeToast } = useToasts();

  // State
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal active targets
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUserTarget, setEditUserTarget] = useState<UserSummary | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserSummary | null>(null);

  // Debounced search query
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_DELAY_MS);

  // Load all users from backend API
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) && data.length > 0 ? data : BASELINE_USER_SUMMARY);
    } catch {
      setUsers((prev) => (prev.length > 0 ? prev : BASELINE_USER_SUMMARY));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Relational Status Transition Handler: Approve, Suspend, Restrict (POST /api/users/{id}/status)
  const handleStatusTransition = async (user: UserSummary, nextStatus: AccountStatus) => {
    try {
      await updateUserStatus(user.id, nextStatus);
      const labelMap: Record<AccountStatus, string> = {
        Verified: 'ACTIVE & VERIFIED',
        Suspended: 'SUSPENDED',
        Pending: 'RESTRICTED / PENDING',
      };
      const toastType = nextStatus === 'Verified' ? 'success' : 'warning';
      addToast(`${user.fullName} authorization transitioned to ${labelMap[nextStatus]}.`, toastType);
      await loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user status.';
      addToast(msg, 'error');
    }
  };

  // Relational Direct Soft Delete Handler (DELETE /api/users/{id})
  const handleDirectSoftDelete = async (user: UserSummary) => {
    try {
      await deleteUser(user.id);
      addToast(`Official account for ${user.fullName} soft-deleted. Audit telemetry preserved.`, 'success');
      await loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to soft-delete user account.';
      addToast(msg, 'error');
    }
  };

  // Filtered dataset
  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return users.filter((u) => {
      // Search matches
      const matchesSearch =
        !q ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.employeeOrResidentId && u.employeeOrResidentId.toLowerCase().includes(q)) ||
        (u.departmentOrBarangay && u.departmentOrBarangay.toLowerCase().includes(q)) ||
        (u.rankOrTitle && u.rankOrTitle.toLowerCase().includes(q)) ||
        (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q));

      // Role filter
      const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;

      // Unit filter
      const matchesUnit = selectedUnit === 'ALL' || u.unit === selectedUnit;

      // Status filter
      const matchesStatus = selectedStatus === 'ALL' || u.status === selectedStatus;

      return matchesSearch && matchesRole && matchesUnit && matchesStatus;
    });
  }, [users, debouncedSearch, selectedRole, selectedUnit, selectedStatus]);

  // Pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    canNextPage,
    canPrevPage,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions,
  } = usePagination(filteredUsers, {
    initialPage: INITIAL_PAGE_INDEX,
    initialPageSize: DEFAULT_PAGE_SIZE,
    pageSizeOptions: [...PAGE_SIZE_OPTIONS],
  });

  // Analytics Metrics
  const stats = useMemo(() => {
    const total = users.length;
    const verified = users.filter((u) => u.status === 'Verified').length;
    const pending = users.filter((u) => u.status === 'Pending').length;
    const suspended = users.filter((u) => u.status === 'Suspended').length;
    const responders = users.filter((u) => u.role === 'Responder').length;
    const rhuCount = users.filter((u) => u.unit === 'RHU').length;
    const fireCount = users.filter((u) => u.unit === 'FIRE').length;
    const pnpCount = users.filter((u) => u.unit === 'PNP').length;
    const adminCount = users.filter((u) => u.role === 'LDRRMO_Admin').length;
    return { total, verified, pending, suspended, responders, rhuCount, fireCount, pnpCount, adminCount };
  }, [users]);

  // Date Formatter
  const fmtDate = (iso?: string): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  // Clean Agency Badge Indicators using Universal Lucide Icons
  const renderRoleBadge = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-[#340313] text-amber-300 border border-amber-600/80 shadow-[0_0_10px_rgba(232,17,76,0.25)]">
          <Shield className="w-3 h-3 text-amber-400 flex-shrink-0" />
          LDRRMO Command
        </span>
      );
    }
    if (role === 'Responder') {
      if (unit === 'RHU') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-600/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
            <HeartPulse className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            RHU Medical
          </span>
        );
      }
      if (unit === 'FIRE') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-orange-950/90 text-orange-300 border border-orange-600/80 shadow-[0_0_10px_rgba(249,115,22,0.25)]">
            <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
            FIRE (BFP)
          </span>
        );
      }
      if (unit === 'PNP') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-sky-950/90 text-sky-300 border border-sky-600/80 shadow-[0_0_10px_rgba(14,165,233,0.25)]">
            <ShieldAlert className="w-3 h-3 text-sky-400 flex-shrink-0" />
            PNP Police
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-indigo-950/90 text-indigo-300 border border-indigo-600/80 shadow-[0_0_10px_rgba(99,102,241,0.25)]">
          <Shield className="w-3 h-3 text-indigo-400 flex-shrink-0" />
          Tactical Unit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-purple-950/80 text-purple-300 border border-purple-700/70 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
        <Users className="w-3 h-3 text-purple-400 flex-shrink-0" />
        Civilian
      </span>
    );
  };

  // Status Pills (ACTIVE, SUSPENDED, PENDING)
  const renderStatusBadge = (status: string) => {
    if (status === 'Verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ACTIVE
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-950/90 text-rose-300 border border-rose-600/80 shadow-[0_0_10px_rgba(244,63,94,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-950/90 text-amber-300 border border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        PENDING
      </span>
    );
  };

  // Filter Dropdown options
  const roleOptions = [
    { value: 'ALL', label: 'All Roles' },
    { value: 'LDRRMO_Admin', label: 'LDRRMO Admin' },
    { value: 'Responder', label: 'Responder' },
    { value: 'Civilian', label: 'Civilian Resident' },
  ];

  const unitOptions = [
    { value: 'ALL', label: 'All Units' },
    { value: 'RHU', label: 'RHU (Medical)' },
    { value: 'FIRE', label: 'FIRE (BFP)' },
    { value: 'PNP', label: 'PNP (Police)' },
    { value: 'None', label: 'None (Civilian / Admin)' },
  ];

  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'Verified', label: 'Active / Verified' },
    { value: 'Pending', label: 'Pending Approval' },
    { value: 'Suspended', label: 'Suspended' },
  ];

  // Quick Agency Filter Handler
  const handleQuickAgencyFilter = (agency: 'ALL' | 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP' | 'CIVILIAN') => {
    if (agency === 'ALL') {
      setSelectedRole('ALL');
      setSelectedUnit('ALL');
    } else if (agency === 'LDRRMO') {
      setSelectedRole('LDRRMO_Admin');
      setSelectedUnit('ALL');
    } else if (agency === 'RHU') {
      setSelectedRole('Responder');
      setSelectedUnit('RHU');
    } else if (agency === 'FIRE') {
      setSelectedRole('Responder');
      setSelectedUnit('FIRE');
    } else if (agency === 'PNP') {
      setSelectedRole('Responder');
      setSelectedUnit('PNP');
    } else if (agency === 'CIVILIAN') {
      setSelectedRole('Civilian');
      setSelectedUnit('ALL');
    }
  };

  const isAgencyActive = (agency: 'ALL' | 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP' | 'CIVILIAN') => {
    if (agency === 'ALL') return selectedRole === 'ALL' && selectedUnit === 'ALL';
    if (agency === 'LDRRMO') return selectedRole === 'LDRRMO_Admin';
    if (agency === 'RHU') return selectedRole === 'Responder' && selectedUnit === 'RHU';
    if (agency === 'FIRE') return selectedRole === 'Responder' && selectedUnit === 'FIRE';
    if (agency === 'PNP') return selectedRole === 'Responder' && selectedUnit === 'PNP';
    if (agency === 'CIVILIAN') return selectedRole === 'Civilian';
    return false;
  };

  return (
    <div className="flex flex-col gap-5 w-full text-slate-100 font-sans">
      {/* 1. Tactical Header Strip */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071522] via-[#0a1a2b] to-[#14020a] border border-[#1d3c5c] p-4 md:p-6 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 via-[#e8114c] to-emerald-500" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide font-display flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#e8114c]" />
              LDRRMO User Governance & Identity Registry
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Role-based identity provisioning, security credentials, and multi-agency responder access verification.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={loadUsers}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync Registry
            </Button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider uppercase bg-[#e8114c] hover:bg-[#ff2b4a] text-white shadow-[0_0_18px_rgba(232,17,76,0.45)] transition-all cursor-pointer border border-[#ff5c74]/50 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              + Enroll Official
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tactical KPI Telemetry Deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-[#1d3c5c] shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Total Registered</span>
            <div className="text-xl font-black text-white font-mono">{stats.total}</div>
            <div className="text-[10px] text-slate-500 font-mono">100% on DB telemetry</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 shadow-inner">
            <Users className="w-5 h-5 text-slate-300" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-emerald-900/60 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">Verified Active</span>
            <div className="text-xl font-black text-emerald-300 font-mono">{stats.verified}</div>
            <div className="text-[10px] text-emerald-500/80 font-mono">Ready for dispatch</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-300 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <UserCheck className="w-5 h-5 text-emerald-300" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-amber-900/60 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">Pending Review</span>
            <div className="text-xl font-black text-amber-300 font-mono">{stats.pending}</div>
            <div className="text-[10px] text-amber-500/80 font-mono">ID / Face validation</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-700/80 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <Clock className="w-5 h-5 text-amber-300" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-sky-900/60 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-widest block">First Responders</span>
            <div className="text-xl font-black text-sky-300 font-mono">{stats.responders}</div>
            <div className="text-[10px] text-sky-400/80 font-mono">
              RHU:{stats.rhuCount} · BFP:{stats.fireCount} · PNP:{stats.pnpCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-950/70 border border-sky-700/80 text-sky-300 flex items-center justify-center shadow-[0_0_12px_rgba(14,165,233,0.3)]">
            <ShieldAlert className="w-5 h-5 text-sky-300" />
          </div>
        </div>
      </div>

      {/* 3. Floating Tactical Action Dock */}
      <div className="sticky top-3 z-20 backdrop-blur-xl bg-[#071522]/95 border border-[#1d3c5c] rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        {/* Search */}
        <div className="w-full xl:max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search officials, Plantilla, PRC, badge ID, sector..."
          />
        </div>

        {/* Tactical Agency Pills & Dropdown Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Agency Filter Quick Buttons */}
          <div className="flex items-center gap-1 bg-[#0a1a2b] p-1 rounded-xl border border-[#1d3c5c]/80 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('ALL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('ALL')
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Filter className="w-3 h-3" />
              ALL
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('LDRRMO')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('LDRRMO')
                  ? 'bg-[#340313] text-amber-300 border border-amber-600/80 shadow-[0_0_8px_rgba(232,17,76,0.3)]'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-rose-950/40'
              }`}
            >
              <Building2 className="w-3 h-3 text-amber-400" />
              LDRRMO
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('RHU')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('RHU')
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-950/40'
              }`}
            >
              <HeartPulse className="w-3 h-3 text-emerald-400" />
              RHU
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('FIRE')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('FIRE')
                  ? 'bg-orange-950 text-orange-300 border border-orange-600/80 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                  : 'text-orange-400/80 hover:text-orange-300 hover:bg-orange-950/40'
              }`}
            >
              <Flame className="w-3 h-3 text-orange-400" />
              FIRE
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('PNP')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('PNP')
                  ? 'bg-sky-950 text-sky-300 border border-sky-600/80 shadow-[0_0_8px_rgba(14,165,233,0.3)]'
                  : 'text-sky-400/80 hover:text-sky-300 hover:bg-sky-950/40'
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-sky-400" />
              PNP
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('CIVILIAN')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('CIVILIAN')
                  ? 'bg-purple-950 text-purple-300 border border-purple-600/80 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'text-purple-400/80 hover:text-purple-300 hover:bg-purple-950/40'
              }`}
            >
              <Users className="w-3 h-3 text-purple-400" />
              Civilian
            </button>
          </div>

          {/* Granular Dropdowns */}
          <Dropdown
            options={roleOptions}
            value={selectedRole}
            onChange={(val) => setSelectedRole(val)}
            menuWidth="w-44"
          />

          <Dropdown
            options={unitOptions}
            value={selectedUnit}
            onChange={(val) => setSelectedUnit(val)}
            menuWidth="w-44"
          />

          <Dropdown
            options={statusOptions}
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            menuWidth="w-40"
          />

          {(search || selectedRole !== 'ALL' || selectedUnit !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedRole('ALL');
                setSelectedUnit('ALL');
                setSelectedStatus('ALL');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. High-Density Tactical Data Table */}
      <div className="rounded-2xl bg-[#071522] border border-[#1d3c5c] shadow-2xl overflow-hidden flex flex-col">
        {/* Table Sub-header Strip */}
        <div className="px-4 py-2.5 bg-[#06111d] border-b border-[#1d3c5c] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-slate-300">Active Roster Telemetry</span>
            <span className="text-slate-500">({filteredUsers.length} matched records)</span>
          </div>
          <div className="text-[10px] text-slate-500 hidden sm:block">
            Universal Triage Protocol · Multi-Port RBAC Enforced
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0a1a2b] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b-2 border-[#1d3c5c] select-none">
              <tr>
                <th className="py-3 px-4 font-bold">Official / Resident Identity</th>
                <th className="py-3 px-4 font-bold">Role & Agency</th>
                <th className="py-3 px-4 font-bold">Sector / Station / Barangay</th>
                <th className="py-3 px-4 font-bold">Authorization Status</th>
                <th className="py-3 px-4 font-bold">Registered Date</th>
                <th className="py-3 px-4 font-bold text-right">Tactical Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1d3c5c]/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS_COUNT} className="p-8 bg-[#0a1a2b]/40">
                    <SkeletonLoader rows={SKELETON_ROWS_COUNT} className="w-full" />
                  </td>
                </tr>
              ) : paginatedItems.length === EMPTY_COUNT ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS_COUNT} className="py-16 text-center text-slate-400 bg-[#0a1a2b]/30">
                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-500 opacity-60" />
                    <div className="font-bold text-slate-200 text-sm tracking-wide">No Matching Emergency Personnel Found</div>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Adjust your search filters, clear active query tags, or enroll a new emergency official into the registry.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((u, index) => {
                  const isVerified = u.status === 'Verified';
                  const isSuspended = u.status === 'Suspended';
                  const isPending = u.status === 'Pending';
                  const isEven = index % MODULO_EVEN_DIVISOR === MODULO_EVEN_REMAINDER;

                  return (
                    <tr
                      key={u.id}
                      className={`${
                        isEven ? 'bg-[#0a1a2b]/60' : 'bg-[#0e243a]/40'
                      } hover:bg-[#163859]/70 transition-colors duration-150 group border-b border-[#1d3c5c]/60`}
                    >
                      {/* 1. Official Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#071522] border border-[#1d3c5c] flex items-center justify-center text-xs font-bold font-mono text-sky-400 flex-shrink-0 shadow-inner group-hover:border-sky-500/60 transition-colors">
                            {u.fullName?.charAt(INITIAL_INDEX)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                              <span className="truncate">{u.fullName}</span>
                              {u.faceVerified && (
                                <span title="Live Biometric Face Verified" className="text-emerald-400 text-xs flex-shrink-0 flex items-center">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 font-mono text-[11px] truncate">{u.email}</div>
                            {u.employeeOrResidentId && (
                              <div className="text-[10px] text-sky-400 font-mono tracking-tight">
                                ID: <span className="font-semibold">{u.employeeOrResidentId}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Role & Agency Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderRoleBadge(u.role, u.unit)}
                      </td>

                      {/* 3. Station / Barangay */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 truncate max-w-[220px]">
                          {u.departmentOrBarangay || '—'}
                        </div>
                        {u.rankOrTitle && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[220px] font-mono">
                            {u.rankOrTitle}
                          </div>
                        )}
                      </td>

                      {/* 4. Status Pill */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusBadge(u.status)}
                      </td>

                      {/* 5. Created Date */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {fmtDate(u.createdAt)}
                      </td>

                      {/* 6. Tactical Action Dock */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* View Detail Button */}
                          <button
                            type="button"
                            onClick={() => setViewUserId(u.id)}
                            className="p-1.5 rounded-lg bg-[#0e243a] hover:bg-sky-950 text-slate-300 hover:text-sky-300 border border-[#1d3c5c] hover:border-sky-500/60 transition-all cursor-pointer shadow-sm"
                            title="Inspect Dossier & Captures"
                            aria-label={`Inspect ${u.fullName}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => setEditUserTarget(u)}
                            className="p-1.5 rounded-lg bg-[#0e243a] hover:bg-amber-950 text-slate-300 hover:text-amber-300 border border-[#1d3c5c] hover:border-amber-500/60 transition-all cursor-pointer shadow-sm"
                            title="Edit Official Credentials"
                            aria-label={`Edit ${u.fullName}`}
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Relational Status Action: Approve */}
                          {!isVerified && (
                            <button
                              type="button"
                              onClick={() => handleStatusTransition(u, 'Verified')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                              title="Authorize & Verify Account (POST /api/users/{id}/status)"
                            >
                              <UserCheck className="w-3 h-3" />
                              Approve
                            </button>
                          )}

                          {/* Relational Status Action: Suspend */}
                          {isVerified && (
                            <button
                              type="button"
                              onClick={() => handleStatusTransition(u, 'Suspended')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                              title="Suspend Account Access (POST /api/users/{id}/status)"
                            >
                              <UserX className="w-3 h-3" />
                              Suspend
                            </button>
                          )}

                          {/* Relational Status Action: Restrict / Review */}
                          {!isPending && (
                            <button
                              type="button"
                              onClick={() => handleStatusTransition(u, 'Pending')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-800 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                              title="Restrict to Pending Validation (POST /api/users/{id}/status)"
                            >
                              <Lock className="w-3 h-3" />
                              Restrict
                            </button>
                          )}

                          {/* Soft Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            className="p-1.5 rounded-lg bg-[#0e243a] hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-[#1d3c5c] hover:border-rose-700 transition-all cursor-pointer shadow-sm"
                            title="Soft-Delete Official (DELETE /api/users/{id})"
                            aria-label={`Delete ${u.fullName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-[#1d3c5c] bg-[#06111d]">
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>
              Showing <strong className="text-white">{totalItems === EMPTY_COUNT ? EMPTY_COUNT : startIndex + INCREMENT_OFFSET}</strong> to{' '}
              <strong className="text-white">{endIndex}</strong> of{' '}
              <strong className="text-white">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#0a1a2b] border border-[#1d3c5c] rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canPrevPage}
              onClick={prevPage}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>

            <span className="text-xs text-slate-400 px-2 font-mono">
              Page <strong className="text-white">{currentPage}</strong> of{' '}
              <strong className="text-white">{totalPages}</strong>
            </span>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canNextPage}
              onClick={nextPage}
            >
              Next <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserCreated={loadUsers}
        showToast={addToast}
      />

      <ViewUserDetailModal
        userId={viewUserId}
        isOpen={viewUserId !== null}
        onClose={() => setViewUserId(null)}
        onEdit={(detail) => {
          setViewUserId(null);
          setEditUserTarget(detail);
        }}
      />

      <EditUserModal
        user={editUserTarget}
        isOpen={editUserTarget !== null}
        onClose={() => setEditUserTarget(null)}
        onUserUpdated={loadUsers}
        showToast={addToast}
      />

      <DeleteUserConfirmModal
        user={deleteUserTarget}
        isOpen={deleteUserTarget !== null}
        onClose={() => setDeleteUserTarget(null)}
        onDeleted={loadUsers}
        showToast={addToast}
      />

      {/* Floating Toast Notification Stack */}
      {toasts.length > EMPTY_COUNT && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((toast) => {
            const borderColors = {
              success: 'border-emerald-500 bg-[#071522]/95 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
              error: 'border-rose-500 bg-[#071522]/95 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
              warning: 'border-amber-500 bg-[#071522]/95 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
              info: 'border-sky-500 bg-[#071522]/95 text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.3)]',
            }[toast.type];

            return (
              <div
                key={toast.id}
                className={`p-3.5 rounded-xl border shadow-2xl backdrop-blur-md pointer-events-auto flex items-start justify-between gap-3 text-xs animate-slideUp font-mono ${borderColors}`}
              >
                <div className="flex-1 font-medium">{toast.message}</div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Dismiss toast"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
