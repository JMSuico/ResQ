// [Layer: UserRoles/Features/Pages/AdminsPanel]
// UserManagementPage.tsx -- LDRRMO User Governance Registry for ResQTrack.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

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
  Lock,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Flame,
  HeartPulse,
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  X
} from 'lucide-react';
import { Dropdown, SearchBar, SkeletonLoader } from '@/Shared';
import { useDebounce, usePagination, useToasts } from '@/Hooks';
import {
  getUsers,
  updateUserStatus,
  deleteUser,
  UserSummary,
  AccountStatus
} from '@/Endpoints/adminGovernanceApi';
import {
  AddUserModal,
  ViewUserDetailModal,
  EditUserModal,
  DeleteUserConfirmModal
} from './Components';
import { BASELINE_USER_SUMMARY } from '@/Libs/Assets/baselineFixtures';
import { AdminButton } from './Shared/AdminButton';
import { CLAY_SURFACE, CLAY_WELL } from './Shared/adminCommandHelpers';

const SEARCH_DEBOUNCE_DELAY_MS = 250;
const INITIAL_PAGE_INDEX = 1;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50];
const SKELETON_ROWS_COUNT = 6;
const TABLE_COLUMNS_COUNT = 6;
const INITIAL_INDEX = 0;
const INCREMENT_OFFSET = 1;
const EMPTY_COUNT = 0;

export const UserManagementPage: React.FC = () => {
  const { toasts, addToast, removeToast } = useToasts();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUserTarget, setEditUserTarget] = useState<UserSummary | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserSummary | null>(null);

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_DELAY_MS);

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
    void loadUsers();
  }, [loadUsers]);

  const handleStatusTransition = async (user: UserSummary, nextStatus: AccountStatus) => {
    try {
      await updateUserStatus(user.id, nextStatus);
      const labelMap: Record<AccountStatus, string> = {
        Verified: 'ACTIVE & VERIFIED',
        Suspended: 'SUSPENDED',
        Pending: 'RESTRICTED / PENDING'
      };
      const toastType = nextStatus === 'Verified' ? 'success' : 'warning';
      addToast(`${user.fullName} authorization transitioned to ${labelMap[nextStatus]}.`, toastType);
      await loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user status.';
      addToast(msg, 'error');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.employeeOrResidentId && u.employeeOrResidentId.toLowerCase().includes(q)) ||
        (u.departmentOrBarangay && u.departmentOrBarangay.toLowerCase().includes(q)) ||
        (u.rankOrTitle && u.rankOrTitle.toLowerCase().includes(q)) ||
        (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q));

      const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
      const matchesUnit = selectedUnit === 'ALL' || u.unit === selectedUnit;
      const matchesStatus = selectedStatus === 'ALL' || u.status === selectedStatus;

      return matchesSearch && matchesRole && matchesUnit && matchesStatus;
    });
  }, [users, debouncedSearch, selectedRole, selectedUnit, selectedStatus]);

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
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions
  } = usePagination(filteredUsers, {
    initialPage: INITIAL_PAGE_INDEX,
    initialPageSize: DEFAULT_PAGE_SIZE,
    pageSizeOptions: [...PAGE_SIZE_OPTIONS]
  });

  const stats = useMemo(() => {
    const total = users.length;
    const verified = users.filter((u) => u.status === 'Verified').length;
    const pending = users.filter((u) => u.status === 'Pending').length;
    const responders = users.filter((u) => u.role === 'Responder').length;
    const rhuCount = users.filter((u) => u.unit === 'RHU').length;
    const fireCount = users.filter((u) => u.unit === 'FIRE').length;
    const pnpCount = users.filter((u) => u.unit === 'PNP').length;
    return { total, verified, pending, responders, rhuCount, fireCount, pnpCount };
  }, [users]);

  const fmtDate = (iso?: string): string => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return iso;
    }
  };

  const renderRoleBadge = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-[#670626] text-[#F7F1EA]">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          LDRRMO Command
        </span>
      );
    }
    if (role === 'Responder') {
      if (unit === 'RHU') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-emerald-100 text-emerald-900 border border-emerald-700/30">
            <HeartPulse className="w-3.5 h-3.5 flex-shrink-0" />
            RHU Medical
          </span>
        );
      }
      if (unit === 'FIRE') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-orange-100 text-orange-900 border border-orange-700/30">
            <Flame className="w-3.5 h-3.5 flex-shrink-0" />
            FIRE (BFP)
          </span>
        );
      }
      if (unit === 'PNP') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-sky-100 text-sky-900 border border-sky-700/30">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            PNP Police
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-[#E9D9D0] text-[#670626] border border-[#670626]/20">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          Tactical Unit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-[#F7F1EA] text-[#A83B4D] border border-[#A83B4D]/30">
        <Users className="w-3.5 h-3.5 flex-shrink-0" />
        Civilian
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'Verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-emerald-100 text-emerald-900 border border-emerald-700/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
          ACTIVE
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-[#670626] text-[#F7F1EA]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F7F1EA]" />
          SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-700/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
        PENDING
      </span>
    );
  };

  const roleOptions = [
    { value: 'ALL', label: 'All Roles' },
    { value: 'LDRRMO_Admin', label: 'LDRRMO Admin' },
    { value: 'Responder', label: 'Responder' },
    { value: 'Civilian', label: 'Civilian Resident' }
  ];

  const unitOptions = [
    { value: 'ALL', label: 'All Units' },
    { value: 'RHU', label: 'RHU (Medical)' },
    { value: 'FIRE', label: 'FIRE (BFP)' },
    { value: 'PNP', label: 'PNP (Police)' },
    { value: 'None', label: 'None (Civilian / Admin)' }
  ];

  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'Verified', label: 'Active / Verified' },
    { value: 'Pending', label: 'Pending Approval' },
    { value: 'Suspended', label: 'Suspended' }
  ];

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
    <div className="flex flex-col gap-5 w-full pb-10">
      {/* Header Strip */}
      <div className={`${CLAY_SURFACE} p-5 md:p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A83B4D]">
              LDRRMO Command / User Management
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-[#A83B4D]" />
              User Management
            </h1>
            <p className="text-sm text-[#A83B4D] font-mono">
              Accounts, residency &amp; access control
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadUsers()}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync
            </AdminButton>

            <AdminButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              icon={<UserPlus className="w-4 h-4" />}
            >
              + Add User
            </AdminButton>
          </div>
        </div>
      </div>

      {/* KPI Telemetry Deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${CLAY_SURFACE} p-4 border-l-4 border-l-[#670626] flex items-center justify-between`}>
          <div>
            <span className="text-xs font-mono font-bold text-[#A83B4D] uppercase tracking-wider block">Total Users</span>
            <div className="text-2xl sm:text-3xl font-black text-[#670626] font-mono mt-1">{stats.total}</div>
            <div className="text-xs text-[#A83B4D] font-mono">All accounts</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center text-[#670626]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className={`${CLAY_SURFACE} p-4 border-l-4 border-l-emerald-700 flex items-center justify-between`}>
          <div>
            <span className="text-xs font-mono font-bold text-[#A83B4D] uppercase tracking-wider block">Verified</span>
            <div className="text-2xl sm:text-3xl font-black text-[#670626] font-mono mt-1">{stats.verified}</div>
            <div className="text-xs text-emerald-800 font-mono font-bold">Active access</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className={`${CLAY_SURFACE} p-4 border-l-4 border-l-amber-600 flex items-center justify-between`}>
          <div>
            <span className="text-xs font-mono font-bold text-[#A83B4D] uppercase tracking-wider block">Pending</span>
            <div className="text-2xl sm:text-3xl font-black text-[#670626] font-mono mt-1">{stats.pending}</div>
            <div className="text-xs text-[#A83B4D] font-mono">Awaiting review</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className={`${CLAY_SURFACE} p-4 border-l-4 border-l-[#A83B4D] flex items-center justify-between`}>
          <div>
            <span className="text-xs font-mono font-bold text-[#A83B4D] uppercase tracking-wider block">Responders</span>
            <div className="text-2xl sm:text-3xl font-black text-[#670626] font-mono mt-1">{stats.responders}</div>
            <div className="text-xs text-[#A83B4D] font-mono">
              RHU:{stats.rhuCount} · BFP:{stats.fireCount} · PNP:{stats.pnpCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5`}>
        <div className="w-full xl:max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search officials, Plantilla, PRC, badge ID, barangay..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`${CLAY_WELL} flex items-center gap-1 p-1 overflow-x-auto`}>
            {(
              [
                { key: 'ALL', label: 'ALL', Icon: Filter },
                { key: 'LDRRMO', label: 'LDRRMO', Icon: Building2 },
                { key: 'RHU', label: 'RHU', Icon: HeartPulse },
                { key: 'FIRE', label: 'FIRE', Icon: Flame },
                { key: 'PNP', label: 'PNP', Icon: ShieldAlert },
                { key: 'CIVILIAN', label: 'Civilian', Icon: Users }
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleQuickAgencyFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                  isAgencyActive(key)
                    ? 'bg-[#670626] text-[#F7F1EA]'
                    : 'text-[#670626] hover:bg-[#F7F1EA]/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <Dropdown options={roleOptions} value={selectedRole} onChange={(val) => setSelectedRole(val)} menuWidth="w-44" />
          <Dropdown options={unitOptions} value={selectedUnit} onChange={(val) => setSelectedUnit(val)} menuWidth="w-44" />
          <Dropdown options={statusOptions} value={selectedStatus} onChange={(val) => setSelectedStatus(val)} menuWidth="w-40" />

          {(search || selectedRole !== 'ALL' || selectedUnit !== 'ALL' || selectedStatus !== 'ALL') && (
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedRole('ALL');
                setSelectedUnit('ALL');
                setSelectedStatus('ALL');
              }}
              icon={<X className="w-3.5 h-3.5" />}
            >
              Reset
            </AdminButton>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className={`${CLAY_SURFACE} p-4 overflow-hidden flex flex-col gap-4`}>
        <div className="flex items-center justify-between text-xs font-mono text-[#670626] px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
            <span className="font-black uppercase tracking-wider">Accounts</span>
            <span className="text-[#A83B4D]">({filteredUsers.length} records)</span>
          </div>
          <div className="text-xs text-[#A83B4D] hidden sm:block">Role-Based Access Control</div>
        </div>

        <div className={`${CLAY_WELL} overflow-x-auto`}>
          <table className="w-full text-left text-sm border-collapse text-[#670626]">
            <thead className="bg-[#670626]/10 text-[#670626] font-mono text-xs uppercase tracking-wider border-b border-[#670626]/15 select-none">
              <tr>
                <th className="py-3.5 px-4 font-bold">User</th>
                <th className="py-3.5 px-4 font-bold">Role & Agency</th>
                <th className="py-3.5 px-4 font-bold">Unit / Barangay</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Registered</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#670626]/10 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS_COUNT} className="p-8">
                    <SkeletonLoader rows={SKELETON_ROWS_COUNT} className="w-full" />
                  </td>
                </tr>
              ) : paginatedItems.length === EMPTY_COUNT ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS_COUNT} className="py-16 text-center text-[#A83B4D]">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-60" />
                    <div className="font-bold text-[#670626] text-base">No Matching Accounts</div>
                    <p className="text-sm mt-1 max-w-md mx-auto">
                      Adjust filters or add a new user.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((u) => {
                  const isVerified = u.status === 'Verified';
                  const isPending = u.status === 'Pending';

                  return (
                    <tr key={u.id} className="hover:bg-[#F7F1EA]/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#F7F1EA] border border-[#670626]/20 flex items-center justify-center text-sm font-bold font-mono text-[#670626] flex-shrink-0">
                            {u.fullName?.charAt(INITIAL_INDEX)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#670626] text-sm truncate flex items-center gap-1.5">
                              <span className="truncate">{u.fullName}</span>
                              {u.faceVerified && (
                                <span title="Live Biometric Face Verified" className="text-emerald-700 flex-shrink-0">
                                  <CheckCircle2 className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                            <div className="text-[#A83B4D] font-mono text-xs truncate">{u.email}</div>
                            {u.employeeOrResidentId && (
                              <div className="text-xs text-[#670626]/80 font-mono mt-0.5">
                                ID: <span className="font-semibold">{u.employeeOrResidentId}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderRoleBadge(u.role, u.unit)}</td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-sm text-[#670626] truncate max-w-[220px]">
                          {u.departmentOrBarangay || '—'}
                        </div>
                        {u.rankOrTitle && (
                          <div className="text-xs text-[#A83B4D] truncate max-w-[220px] font-mono mt-0.5">
                            {u.rankOrTitle}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(u.status)}</td>

                      <td className="py-3.5 px-4 font-mono text-xs text-[#A83B4D] whitespace-nowrap">
                        {fmtDate(u.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewUserId(u.id)}
                            className="p-2 rounded-lg bg-[#F7F1EA] hover:bg-[#670626] text-[#670626] hover:text-[#F7F1EA] border border-[#670626]/20 transition-all cursor-pointer"
                            title="View User Details"
                            aria-label={`Inspect ${u.fullName}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditUserTarget(u)}
                            className="p-2 rounded-lg bg-[#F7F1EA] hover:bg-[#670626] text-[#670626] hover:text-[#F7F1EA] border border-[#670626]/20 transition-all cursor-pointer"
                            title="Edit Official Credentials"
                            aria-label={`Edit ${u.fullName}`}
                          >
                            <Sliders className="w-4 h-4" />
                          </button>

                          {!isVerified && (
                            <AdminButton
                              type="button"
                              variant="success"
                              size="xs"
                              onClick={() => void handleStatusTransition(u, 'Verified')}
                              icon={<UserCheck className="w-3.5 h-3.5" />}
                            >
                              Approve
                            </AdminButton>
                          )}

                          {isVerified && (
                            <AdminButton
                              type="button"
                              variant="danger"
                              size="xs"
                              onClick={() => void handleStatusTransition(u, 'Suspended')}
                              icon={<UserX className="w-3.5 h-3.5" />}
                            >
                              Suspend
                            </AdminButton>
                          )}

                          {!isPending && (
                            <AdminButton
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => void handleStatusTransition(u, 'Pending')}
                              icon={<Lock className="w-3.5 h-3.5" />}
                            >
                              Restrict
                            </AdminButton>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            className="p-2 rounded-lg bg-[#F7F1EA] hover:bg-[#670626] text-[#670626] hover:text-[#F7F1EA] border border-[#670626]/20 transition-all cursor-pointer"
                            title="Soft-Delete Official"
                            aria-label={`Delete ${u.fullName}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#670626]/15">
          <div className="flex items-center gap-3 text-sm text-[#A83B4D] font-mono">
            <span>
              Showing <strong className="text-[#670626]">{totalItems === EMPTY_COUNT ? EMPTY_COUNT : startIndex + INCREMENT_OFFSET}</strong> to{' '}
              <strong className="text-[#670626]">{endIndex}</strong> of{' '}
              <strong className="text-[#670626]">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wider">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#E9D9D0] border border-[#670626]/20 rounded-lg px-2.5 py-1 text-sm text-[#670626] font-bold font-mono"
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
            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrevPage}
              onClick={prevPage}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </AdminButton>

            <span className="text-sm text-[#A83B4D] px-2 font-mono">
              Page <strong className="text-[#670626]">{currentPage}</strong> of{' '}
              <strong className="text-[#670626]">{totalPages}</strong>
            </span>

            <AdminButton
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNextPage}
              onClick={nextPage}
            >
              Next <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </AdminButton>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserCreated={() => void loadUsers()}
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
        onUserUpdated={() => void loadUsers()}
        showToast={addToast}
      />

      <DeleteUserConfirmModal
        user={deleteUserTarget}
        isOpen={deleteUserTarget !== null}
        onClose={() => setDeleteUserTarget(null)}
        onDeleted={() => void loadUsers()}
        showToast={addToast}
      />

      {toasts.length > EMPTY_COUNT && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`${CLAY_SURFACE} p-3.5 border-2 border-[#670626] pointer-events-auto flex items-start justify-between gap-3 text-sm font-mono`}
            >
              <div className="flex-1 font-bold text-[#670626]">{toast.message}</div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[#670626] cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
