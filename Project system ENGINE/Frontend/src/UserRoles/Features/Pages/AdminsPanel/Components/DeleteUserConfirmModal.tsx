// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// DeleteUserConfirmModal.tsx -- Danger-tier confirmation modal for soft-deleting users in LDRRMO Governance.
// Uses Universal Lambdas (=>), Katipuneros architecture, and DefaultFloatingModalCard.
// DO NOT hard delete emergency user records to preserve incident telemetry and audit logs.

import React, { useState } from 'react';
import { DefaultFloatingModalCard, Button } from '@/Shared';
import { deleteUser, UserDetail, UserSummary } from '@/Endpoints/adminGovernanceApi';

export interface DeleteUserConfirmModalProps {
  user: UserSummary | UserDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DeleteUserConfirmModal: React.FC<DeleteUserConfirmModalProps> = ({
  user,
  isOpen,
  onClose,
  onDeleted,
  showToast,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteUser(user.id);
      showToast(`User account for ${user.fullName} successfully soft-deleted.`, 'success');
      onDeleted();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to soft-delete user account.';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Revoke & Soft-Delete Official Account"
      subtitle="Administrative credential revocation with audit trail preservation"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs text-slate-200">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 font-mono flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tactical Emergency Hazard Banner */}
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-3 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
          <div className="w-10 h-10 rounded-xl bg-rose-900/60 border border-rose-700/80 flex items-center justify-center text-lg flex-shrink-0 text-rose-300 shadow-inner">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-rose-300 text-xs font-mono uppercase tracking-wider">
              NDRRMC / LDRRMO Audit Safeguard Policy
            </h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              This action revokes all active logon sessions and suspends credential authorization. Dispatched incident logs, telemetry entries, and historical blur variance checks are retained for administrative and legal compliance.
            </p>
          </div>
        </div>

        {/* Structured Target Official Dossier Preview */}
        {user && (
          <div className="p-3.5 rounded-xl bg-[#071522] border border-[#1d3c5c] space-y-2 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm font-display tracking-wide">{user.fullName}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#0a1a2b] text-sky-300 border border-sky-800/60">
                {user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}
              </span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
            <div className="flex items-center justify-between pt-1 border-t border-[#1d3c5c]/60 text-[10px] font-mono">
              <span className="text-sky-400">
                ID: {user.employeeOrResidentId || 'N/A'}
              </span>
              <span className="text-slate-500">
                {user.departmentOrBarangay || 'Central Dispatch'}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#1d3c5c]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase bg-[#e8114c] hover:bg-[#ff2b4a] text-white shadow-[0_0_15px_rgba(232,17,76,0.45)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 border border-[#ff5c74]/50"
          >
            {isDeleting ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Revoking Access…
              </>
            ) : (
              <>
                <span>⛔</span> Confirm Soft-Delete
              </>
            )}
          </button>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
