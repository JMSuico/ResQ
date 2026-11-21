// [Layer: UserRoles/Features/Pages/AdminsPanel/Components]
// DeleteUserConfirmModal.tsx -- Danger-tier confirmation modal for soft-deleting users in LDRRMO Governance.
// Stitch Warm Ivory (#F7F1EA) + Soft Beige (#E9D9D0) + Cherry (#670626) claymorphic styling.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';
import { deleteUser, UserDetail, UserSummary } from '@/Endpoints/adminGovernanceApi';
import { AdminButton } from '../Shared/AdminButton';
import { AdminModalCard } from '../Shared/AdminModalCard';
import { CLAY_WELL } from '../Shared/adminCommandHelpers';

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
  showToast
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!user) return;
    if (user.isCliProtectedSuperAdmin) {
      setErrorMessage('CLI-created Superadmin accounts cannot be deleted from the Frontend/UI. Use Docker CLI (userdelete).');
      return;
    }
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
    <AdminModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Revoke Account"
      subtitle="Soft-delete user access"
      maxWidth="md"
    >
      <div className="space-y-4 text-sm text-[#670626]">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#670626] text-[#F7F1EA] text-sm font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className={`${CLAY_WELL} p-4 flex items-start gap-3 border-l-4 border-l-[#670626]`}>
          <div className="w-10 h-10 rounded-xl bg-[#670626] text-[#F7F1EA] flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-[#670626] text-xs font-mono uppercase tracking-wider">
              Access Revocation
            </h4>
            <p className="text-[#A83B4D] text-xs leading-relaxed">
              Revokes active sessions; logs &amp; audit trails remain.
            </p>
          </div>
        </div>

        {user && (
          <div className={`${CLAY_WELL} p-4 space-y-2`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#670626] text-base">{user.fullName}</span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold uppercase bg-[#670626] text-[#F7F1EA]">
                {user.role} {user.unit !== 'None' ? `(${user.unit})` : ''}
              </span>
            </div>
            <div className="text-[#A83B4D] font-mono text-xs">{user.email}</div>
            <div className="flex items-center justify-between pt-2 border-t border-[#670626]/15 text-xs font-mono">
              <span className="font-bold">ID: {user.employeeOrResidentId || 'N/A'}</span>
              <span className="text-[#A83B4D]">{user.departmentOrBarangay || 'Katipunan Command'}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#670626]/15">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </AdminButton>
          <AdminButton
            type="button"
            variant="danger"
            size="sm"
            isLoading={isDeleting}
            onClick={() => void handleDelete()}
            icon={<Trash2 className="w-4 h-4" />}
          >
            {isDeleting ? 'Revoking Access…' : 'Confirm Revocation'}
          </AdminButton>
        </div>
      </div>
    </AdminModalCard>
  );
};
