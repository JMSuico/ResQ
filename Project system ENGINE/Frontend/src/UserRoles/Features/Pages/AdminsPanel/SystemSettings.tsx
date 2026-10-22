// [Layer: UserRoles/Features/Pages/AdminsPanel]
// Responsibility: System runtime settings editor and SHA-256 tamper-evident audit log inspector.
// DO NOT permit alteration of previously chained SHA-256 hash entries.

import React, { useState, useEffect } from 'react';
import { getSystemSettings, updateSystemSetting, getAuditLogs } from '@/Endpoints/adminGovernanceApi';
import { Button } from '@/Shared/Button';
import { formatIsoTimestamp } from '@/Libs/Assets/formatters';

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'audit'>('settings');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const loadData = async () => {
    try {
      const [s, a] = await Promise.all([getSystemSettings(), getAuditLogs()]);
      setSettings(s);
      setAuditLogs(a);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSetting = async (key: string) => {
    try {
      await updateSystemSetting(key, editValue);
      setEditingKey(null);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">System Runtime Settings & Audit Trails</h2>
          <p className="text-xs text-slate-400 mt-0.5">Deterministic parameters and cryptographic SHA-256 verification</p>
        </div>

        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'settings' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Engine Settings
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'audit' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SHA-256 Audit Logs ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <div className="grid grid-cols-1 gap-4">
          {settings.map((s) => (
            <div key={s.id} className="tactical-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-sky-400">{s.key}</span>
                  <span className="px-2 py-0.2 rounded bg-slate-800 text-[9px] font-mono text-slate-400">
                    {s.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{s.description}</p>
                <div className="mt-2 text-xs font-mono text-slate-200 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                  {editingKey === s.key ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full bg-transparent text-white focus:outline-none"
                    />
                  ) : (
                    <span>{s.value}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                {editingKey === s.key ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditingKey(null)}>
                      Cancel
                    </Button>
                    <Button variant="success" size="sm" onClick={() => handleSaveSetting(s.key)}>
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingKey(s.key);
                      setEditValue(s.value);
                    }}
                  >
                    Edit Value
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="tactical-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Target Entity</th>
                  <th className="p-3.5">Payload Description</th>
                  <th className="p-3.5">Cryptographic SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">
                      {formatIsoTimestamp(log.timestamp)}
                    </td>
                    <td className="p-3.5 font-bold text-sky-400">{log.action}</td>
                    <td className="p-3.5 text-slate-300">{log.targetEntity}</td>
                    <td className="p-3.5 text-slate-400 max-w-xs truncate">{log.payload}</td>
                    <td className="p-3.5 text-[10px] text-emerald-400 font-bold truncate max-w-[200px]" title={log.currentHash}>
                      {log.currentHash.substring(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
