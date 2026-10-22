// [Layer: UserRoles/Features/Pages/AdminsPanel]
// Responsibility: Administrative user governance, biometric capture inspection, and account approval/suspension.
// DO NOT expose raw user passwords in governance views.

import React, { useState, useEffect } from 'react';
import { getUsers, updateUserStatus } from '@/Endpoints/adminGovernanceApi';
import { Button } from '@/Shared/Button';
import { SearchBar } from '@/Shared/FormPrimitives';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp } from '@/Libs/Assets/formatters';

export const UserGovernance: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('Biometric Capture');

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleStatusUpdate = async (userId: string, newStatus: 'Verified' | 'Suspended' | 'Pending') => {
    try {
      await updateUserStatus(userId, newStatus);
      await loadUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const openCapture = (userId: string, kind: 'id' | 'face', userName: string) => {
    setLightboxImageUrl(`/api/users/${userId}/captures/${kind}`);
    setLightboxTitle(`${userName} - ${kind === 'id' ? 'Government ID Card' : 'Live Face Biometric'}`);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.employeeOrResidentId && u.employeeOrResidentId.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    const matchesStatus = selectedStatus === 'ALL' || u.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">User Accounts & Biometric Governance</h2>
          <p className="text-xs text-slate-400 mt-0.5">Verification approval, identity inspection, and account suspension</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search user by name or email..." className="w-64" />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
          >
            <option value="ALL">All Roles</option>
            <option value="LDRRMO_Admin">LDRRMO Admin</option>
            <option value="Responder">Responder</option>
            <option value="Civilian">Civilian</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div className="tactical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-3.5">User / Credentials</th>
                <th className="p-3.5">Role & Unit</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Face Biometric</th>
                <th className="p-3.5">Biometric Captures</th>
                <th className="p-3.5">Registered</th>
                <th className="p-3.5 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const statusColor = {
                    Verified: 'bg-emerald-950/80 text-emerald-400 border-emerald-800',
                    Pending: 'bg-amber-950/80 text-amber-400 border-amber-800',
                    Suspended: 'bg-rose-950/80 text-rose-400 border-rose-800'
                  }[u.status] || 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-100">{u.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        {u.employeeOrResidentId && (
                          <div className="text-[10px] text-slate-500 font-mono">ID: {u.employeeOrResidentId}</div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-200">{u.role}</span>
                        {u.unit !== 'None' && (
                          <div className="text-[10px] text-sky-400 font-mono">Unit: {u.unit}</div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusColor}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {u.faceVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-400">Unverified</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openCapture(u.id, 'id', u.fullName)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-slate-700"
                          >
                            🪪 ID PNG
                          </button>
                          <button
                            onClick={() => openCapture(u.id, 'face', u.fullName)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-sky-300 border border-slate-700"
                          >
                            👤 Face PNG
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                        {formatIsoTimestamp(u.createdAt)}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {u.status !== 'Verified' && (
                            <Button variant="success" size="sm" onClick={() => handleStatusUpdate(u.id, 'Verified')}>
                              Approve
                            </Button>
                          )}
                          {u.status !== 'Suspended' ? (
                            <Button variant="danger" size="sm" onClick={() => handleStatusUpdate(u.id, 'Suspended')}>
                              Suspend
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(u.id, 'Pending')}>
                              Reset to Pending
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title={lightboxTitle}
      />
    </div>
  );
};
