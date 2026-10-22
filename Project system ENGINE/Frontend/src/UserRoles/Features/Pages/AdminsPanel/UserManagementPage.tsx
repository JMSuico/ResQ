// [Layer: UserRoles/Features/Pages/AdminsPanel]
// UserManagementPage.tsx -- Full Admin User Governance CRUD interface for ResQTrack.
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
    } catch (err: any) {
      addToast(err?.message || 'Could not load users registry.', 'error');
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
        `${user.fullName} is now ${nextStatus === 'Verified' ? 'approved & verified.' : 'suspended.'}`,
        nextStatus === 'Verified' ? 'success' : 'warning'
      );
      loadUsers();
    } catch (err: any) {
      addToast(err?.message || 'Failed to update user status.', 'error');
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
    return { total, verified, pending, suspended, responders };
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

  // Role Badge Renderer
  const renderRoleBadge = (role: string, unit: string) => {
    if (role === 'LDRRMO_Admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm">
          <span>🏛️</span> LDRRMO Admin
        </span>
      );
    }
    if (role === 'Responder') {
      if (unit === 'RHU') {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm">
            <span>🚑</span> RHU Medical
          </span>
        );
      }
      if (unit === 'FIRE') {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-orange-950/80 text-orange-300 border border-orange-800/80 shadow-sm">
            <span>🚒</span> FIRE (BFP)
          </span>
        );
      }
      if (unit === 'PNP') {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800/80 shadow-sm">
            <span>👮</span> PNP Police
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/80 shadow-sm">
          <span>🛡️</span> Responder
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/80 shadow-sm">
        <span>👤</span> Civilian Resident
      </span>
    );
  };

  // Status Badge Renderer
  const renderStatusBadge = (status: string) => {
    if (status === 'Verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Verified
        </span>
      );
    }
    if (status === 'Suspended') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-800 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        Pending
      </span>
    );
  };

  // Filter Dropdown options
  const roleOptions = [
    { value: 'ALL', label: 'All System Roles' },
    { value: 'LDRRMO_Admin', label: 'LDRRMO Admin' },
    { value: 'Responder', label: 'Responder' },
    { value: 'Civilian', label: 'Civilian Resident' },
  ];

  const unitOptions = [
    { value: 'ALL', label: 'All Tactical Units' },
    { value: 'RHU', label: 'RHU (Medical)' },
    { value: 'FIRE', label: 'FIRE (BFP)' },
    { value: 'PNP', label: 'PNP (Police)' },
    { value: 'None', label: 'None (Civilian / Admin)' },
  ];

  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'Verified', label: 'Verified Accounts' },
    { value: 'Pending', label: 'Pending Approval' },
    { value: 'Suspended', label: 'Suspended Accounts' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
              LDRRMO User Governance & Identity Registry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete administrative directory, role-based governance, biometric captures, and emergency unit allocation for Dipolog City & Zamboanga del Norte.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadUsers}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="action-green"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            + Register New User
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Registered</span>
            <span className="text-lg font-black text-white">{stats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-800/60 text-sky-400 flex items-center justify-center text-sm font-bold">
            👥
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Verified Active</span>
            <span className="text-lg font-black text-emerald-300">{stats.verified}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center text-sm font-bold">
            ✓
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Pending Approval</span>
            <span className="text-lg font-black text-amber-300">{stats.pending}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center text-sm font-bold">
            ⏳
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">Suspended</span>
            <span className="text-lg font-black text-rose-300">{stats.suspended}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center text-sm font-bold">
            ⛔
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">Tactical Responders</span>
            <span className="text-lg font-black text-sky-300">{stats.responders}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-800/60 text-sky-400 flex items-center justify-center text-sm font-bold">
            🚨
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name, email, employee ID, station, phone..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Dropdown
            options={roleOptions}
            value={selectedRole}
            onChange={(val) => setSelectedRole(val)}
            menuWidth="w-48"
          />

          <Dropdown
            options={unitOptions}
            value={selectedUnit}
            onChange={(val) => setSelectedUnit(val)}
            menuWidth="w-48"
          />

          <Dropdown
            options={statusOptions}
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            menuWidth="w-44"
          />

          {(search || selectedRole !== 'ALL' || selectedUnit !== 'ALL' || selectedStatus !== 'ALL') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedRole('ALL');
                setSelectedUnit('ALL');
                setSelectedStatus('ALL');
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800 select-none">
              <tr>
                <th className="py-3.5 px-4 font-bold tracking-wider">User Identity & Email</th>
                <th className="py-3.5 px-4 font-bold tracking-wider">Role & Agency</th>
                <th className="py-3.5 px-4 font-bold tracking-wider">Station / Barangay</th>
                <th className="py-3.5 px-4 font-bold tracking-wider">Status</th>
                <th className="py-3.5 px-4 font-bold tracking-wider">Created</th>
                <th className="py-3.5 px-4 font-bold tracking-wider text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-6">
                    <SkeletonLoader rows={5} className="w-full" />
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <div className="text-3xl mb-2">🔍</div>
                    <div className="font-semibold text-slate-200 text-sm">No matching user records found</div>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new emergency user.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((u) => {
                  const isVerified = u.status === 'Verified';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* 1. User Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-sm font-bold text-slate-200 flex-shrink-0">
                            {u.fullName?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                              <span className="truncate">{u.fullName}</span>
                              {u.faceVerified && (
                                <span title="Live Biometric Face Verified" className="text-emerald-400 text-xs">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 font-mono text-[11px] truncate">{u.email}</div>
                            {u.employeeOrResidentId && (
                              <div className="text-[10px] text-sky-400 font-mono">
                                ID: {u.employeeOrResidentId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Role & Agency */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderRoleBadge(u.role, u.unit)}
                      </td>

                      {/* 3. Station / Barangay */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200 truncate max-w-[200px]">
                          {u.departmentOrBarangay || '—'}
                        </div>
                        {u.rankOrTitle && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {u.rankOrTitle}
                          </div>
                        )}
                      </td>

                      {/* 4. Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(u.status)}
                      </td>

                      {/* 5. Created At */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {fmtDate(u.createdAt)}
                      </td>

                      {/* 6. Governance Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* View Detail Button */}
                          <button
                            type="button"
                            onClick={() => setViewUserId(u.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/80"
                            title="Inspect User Details & Captures"
                            aria-label={`Inspect ${u.fullName}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => setEditUserTarget(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 transition-colors cursor-pointer border border-slate-700/80"
                            title="Edit User Profile"
                            aria-label={`Edit ${u.fullName}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Quick Status Toggle Button */}
                          {isVerified ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusToggle(u)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Suspend User Account"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusToggle(u)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Approve User Account"
                            >
                              Approve
                            </button>
                          )}

                          {/* Soft Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeleteUserTarget(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer border border-slate-700/80"
                            title="Soft-Delete User"
                            aria-label={`Delete ${u.fullName}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              Showing <strong className="text-white">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-white">{endIndex}</strong> of{' '}
              <strong className="text-white">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
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

            <span className="text-xs text-slate-400 px-2">
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
              success: 'border-emerald-600 bg-slate-900/95 text-emerald-300',
              error: 'border-rose-600 bg-slate-900/95 text-rose-300',
              warning: 'border-amber-600 bg-slate-900/95 text-amber-300',
              info: 'border-sky-600 bg-slate-900/95 text-sky-300',
            }[toast.type];

            return (
              <div
                key={toast.id}
                className={`p-3.5 rounded-xl border shadow-2xl backdrop-blur-md pointer-events-auto flex items-start justify-between gap-3 text-xs animate-slideUp ${borderColors}`}
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
