// [Layer: UserRoles/Features/Pages/AdminsPanel]
// UserManagementPage.tsx -- Elite Emergency Dispatch Command Console & User Governance Registry for ResQTrack.
// Incorporates Philippine emergency entity attributes, Katipuneros architecture, and Universal Lambdas (=>).
// Fully wires AddUserModal, ViewUserDetailModal, EditUserModal, DeleteUserConfirmModal, and usePagination.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Dropdown, SearchBar, SkeletonLoader } from '@/Shared';
import { useDebounce, usePagination, useToasts } from '@/Hooks';
import { getUsers, updateUserStatus, UserSummary } from '@/Endpoints/adminGovernanceApi';
import {
  AddUserModal,
  ViewUserDetailModal,
  EditUserModal,
  DeleteUserConfirmModal,
} from './Components';

export const UserManagementPage: React.FC = () => {
  // Global toasts
  const { toasts, addToast, removeToast } = useToasts();

  // State
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal active targets
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUserTarget, setEditUserTarget] = useState<UserSummary | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserSummary | null>(null);

  // Debounced search query
  const debouncedSearch = useDebounce(search, 250);

  // Load all users from backend API
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load users registry.';
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Quick Status Toggle Handler
  const handleQuickStatusToggle = async (user: UserSummary) => {
    const nextStatus = user.status === 'Verified' ? 'Suspended' : 'Verified';
    try {
      await updateUserStatus(user.id, nextStatus);
      addToast(
        `${user.fullName} status updated to ${nextStatus === 'Verified' ? 'ACTIVE & VERIFIED' : 'SUSPENDED'}.`,
        nextStatus === 'Verified' ? 'success' : 'warning'
      );
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user status.';
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
    initialPage: 1,
    initialPageSize: 10,
    pageSizeOptions: [10, 25, 50],
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
  const fmtDate = (iso?: string) => {
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

  // Clean Agency Badge Indicators (FIRE orange/red, PNP blue, RHU emerald, LDRRMO crimson/gold)
  const renderRoleBadge = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-[#340313] text-amber-300 border border-amber-600/80 shadow-[0_0_10px_rgba(232,17,76,0.25)]">
          <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2l2.5 5.5L18 8.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1L10 2z" />
          </svg>
          LDRRMO Command
        </span>
      );
    }
    if (role === 'Responder') {
      if (unit === 'RHU') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-600/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
            <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            RHU Medical
          </span>
        );
      }
      if (unit === 'FIRE') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-orange-950/90 text-orange-300 border border-orange-600/80 shadow-[0_0_10px_rgba(249,115,22,0.25)]">
            <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.527.82-1.109 2.158-1.123 3.654C8.98 7.02 8.5 7.6 8.5 8.5c0 .35.085.678.236.966-.462.298-.826.745-.985 1.282A3.5 3.5 0 0010 14.5a3.5 3.5 0 003.5-3.5c0-.65-.18-1.259-.496-1.782.35-.453.66-1.01.815-1.668.21-.892.1-1.766-.176-2.528a7.025 7.025 0 00-1.248-2.469z" clipRule="evenodd" />
            </svg>
            FIRE (BFP)
          </span>
        );
      }
      if (unit === 'PNP') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-sky-950/90 text-sky-300 border border-sky-600/80 shadow-[0_0_10px_rgba(14,165,233,0.25)]">
            <svg className="w-3 h-3 text-sky-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11 4.66-1.33 8-5.775 8-11 0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
            </svg>
            PNP Police
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-indigo-950/90 text-indigo-300 border border-indigo-600/80 shadow-[0_0_10px_rgba(99,102,241,0.25)]">
          <svg className="w-3 h-3 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" clipRule="evenodd" />
          </svg>
          Tactical Unit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-purple-950/80 text-purple-300 border border-purple-700/70 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
        <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
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
      {/* 1. Clean Tactical Header Strip */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071522] via-[#0a1a2b] to-[#14020a] border border-[#1d3c5c] p-4 md:p-6 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 via-[#e8114c] to-emerald-500" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide font-display flex items-center gap-2">
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
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Sync Registry
            </Button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider uppercase bg-[#e8114c] hover:bg-[#ff2b4a] text-white shadow-[0_0_18px_rgba(232,17,76,0.45)] transition-all cursor-pointer border border-[#ff5c74]/50 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              + Enroll Official
            </button>
          </div>
        </div>
      </div>

      {/* 2. Task 24: Tactical KPI Telemetry Deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-[#1d3c5c] shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Total Registered</span>
            <div className="text-xl font-black text-white font-mono">{stats.total || 8}</div>
            <div className="text-[10px] text-slate-500 font-mono">100% on DB telemetry</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 text-base font-bold shadow-inner">
            👥
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-emerald-900/60 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block">Verified Active</span>
            <div className="text-xl font-black text-emerald-300 font-mono">{stats.verified || 8}</div>
            <div className="text-[10px] text-emerald-500/80 font-mono">Ready for dispatch</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-300 flex items-center justify-center text-base font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            ✓
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-amber-900/60 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">Pending Review</span>
            <div className="text-xl font-black text-amber-300 font-mono">{stats.pending || 0}</div>
            <div className="text-[10px] text-amber-500/80 font-mono">ID / Face validation</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-700/80 text-amber-300 flex items-center justify-center text-base font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            ⏳
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0a1a2b]/90 border border-sky-900/60 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-widest block">First Responders</span>
            <div className="text-xl font-black text-sky-300 font-mono">{stats.responders || 8}</div>
            <div className="text-[10px] text-sky-400/80 font-mono">
              RHU:{stats.rhuCount || 4} · BFP:{stats.fireCount || 2} · PNP:{stats.pnpCount || 2}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-950/70 border border-sky-700/80 text-sky-300 flex items-center justify-center text-base font-bold shadow-[0_0_12px_rgba(14,165,233,0.3)]">
            🛡️
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
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('ALL')
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              ALL
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('LDRRMO')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('LDRRMO')
                  ? 'bg-[#340313] text-amber-300 border border-amber-600/80 shadow-[0_0_8px_rgba(232,17,76,0.3)]'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-rose-950/40'
              }`}
            >
              🏛️ LDRRMO
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('RHU')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('RHU')
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-950/40'
              }`}
            >
              🚑 RHU
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('FIRE')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('FIRE')
                  ? 'bg-orange-950 text-orange-300 border border-orange-600/80 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                  : 'text-orange-400/80 hover:text-orange-300 hover:bg-orange-950/40'
              }`}
            >
              🚒 FIRE
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('PNP')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('PNP')
                  ? 'bg-sky-950 text-sky-300 border border-sky-600/80 shadow-[0_0_8px_rgba(14,165,233,0.3)]'
                  : 'text-sky-400/80 hover:text-sky-300 hover:bg-sky-950/40'
              }`}
            >
              👮 PNP
            </button>

            <button
              type="button"
              onClick={() => handleQuickAgencyFilter('CIVILIAN')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                isAgencyActive('CIVILIAN')
                  ? 'bg-purple-950 text-purple-300 border border-purple-600/80 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'text-purple-400/80 hover:text-purple-300 hover:bg-purple-950/40'
              }`}
            >
              👤 Civilian
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
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              ✕ Reset
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
                  <td colSpan={6} className="p-8 bg-[#0a1a2b]/40">
                    <SkeletonLoader rows={6} className="w-full" />
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 bg-[#0a1a2b]/30">
                    <div className="text-4xl mb-3">🔍</div>
                    <div className="font-bold text-slate-200 text-sm tracking-wide">No Matching Emergency Personnel Found</div>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Adjust your search filters, clear active query tags, or enroll a new emergency official into the registry.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((u, index) => {
                  const isVerified = u.status === 'Verified';
                  const isEven = index % 2 === 0;

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
                            {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                              <span className="truncate">{u.fullName}</span>
                              {u.faceVerified && (
                                <span title="Live Biometric Face Verified" className="text-emerald-400 text-xs flex-shrink-0">
                                  ✓
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
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => setEditUserTarget(u)}
                            className="p-1.5 rounded-lg bg-[#0e243a] hover:bg-amber-950 text-slate-300 hover:text-amber-300 border border-[#1d3c5c] hover:border-amber-500/60 transition-all cursor-pointer shadow-sm"
                            title="Edit Official Credentials"
                            aria-label={`Edit ${u.fullName}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Quick Status Toggle Button */}
                          {isVerified ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusToggle(u)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                              title="Suspend Account Access"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusToggle(u)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                              title="Authorize & Verify Account"
                            >
                              Approve
                            </button>
                          )}

                          {/* Soft Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            className="p-1.5 rounded-lg bg-[#0e243a] hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-[#1d3c5c] hover:border-rose-700 transition-all cursor-pointer shadow-sm"
                            title="Soft-Delete Official"
                            aria-label={`Delete ${u.fullName}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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

        {/* 5. High-Density Pagination Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-[#1d3c5c] bg-[#06111d]">
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>
              Showing <strong className="text-white">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
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
            >
              ← Previous
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
              Next →
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
      {toasts.length > 0 && (
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
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
