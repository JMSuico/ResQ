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
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to soft-delete user account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm User Account Deletion"
      subtitle="Administrative soft-deletion and access revocation"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs text-slate-200">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/80 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-900/60 border border-rose-700/80 flex items-center justify-center text-lg flex-shrink-0 text-rose-300">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-rose-300 text-xs tracking-wide">
              Data Privacy & Audit Safeguard
            </h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              This action will revoke active login sessions and mark the user record as soft-deleted. Associated dispatch reports, emergency calls, and GPS telemetry will remain intact for legal auditability.
            </p>
          </div>
        </div>

        {/* User Target Card */}
        {user && (
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">{user.fullName}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}
              </span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
            {user.employeeOrResidentId && (
              <div className="text-[10px] text-sky-400 font-mono">
                System ID: {user.employeeOrResidentId}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={isDeleting}
            onClick={handleDelete}
          >
            Confirm Soft-Delete
          </Button>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
