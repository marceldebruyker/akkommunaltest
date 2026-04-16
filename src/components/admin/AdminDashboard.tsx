import React, { useState, useEffect } from 'react';
import type { AdminUserRecord } from '../../pages/api/admin/users';

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Expanded User logic
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users. Are you an admin?');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeMutation = async (targetUserId: string, action: string, payload: any) => {
    try {
      setActionLoading(`${targetUserId}-${action}`);
      const res = await fetch('/api/admin/mutate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action, payload })
      });
      if (!res.ok) throw new Error('Mutation failed');
      await fetchUsers(); // reload cleanly
    } catch (err) {
      alert('Aktion fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-gray-500 py-10 text-center animate-pulse">Lade Kunden-Datenbank...</div>;
  if (error) return <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200">Zugriff verweigert: {error}</div>;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Search Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-4 top-3 text-gray-400">search</span>
          <input 
            type="text" 
            placeholder="Kunden nach Name oder E-Mail durchsuchen..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#05183a] focus:ring-1 focus:ring-[#05183a] transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm font-semibold text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
          {filteredUsers.length} Benutzer gefunden
        </div>
      </div>

      {/* User List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#05183a] text-white text-xs uppercase font-bold tracking-widest">
            <tr>
              <th className="px-6 py-4">Name & E-Mail</th>
              <th className="px-6 py-4">Rollen</th>
              <th className="px-6 py-4">Zugang</th>
              <th className="px-6 py-4 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <React.Fragment key={user.id}>
                {/* Main Row */}
                <tr className={`hover:bg-gray-50 transition-colors ${expandedUser === user.id ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#05183a]">{user.first_name} {user.last_name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    {user.is_admin && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md border border-red-200">ADMIN</span>}
                    {user.is_partner && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-md border border-blue-200">BW-PARTNER</span>}
                    {!user.is_admin && !user.is_partner && <span className="text-gray-400 text-xs">Standard</span>}
                  </td>
                  <td className="px-6 py-4">
                    {user.has_membership ? (
                      <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Gesamt-Abo</span>
                    ) : (
                      <span className="text-gray-500 text-sm">{user.purchases.length} Module</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                      className="text-[#05183a] bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">{expandedUser === user.id ? 'expand_less' : 'edit'}</span>
                    </button>
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {expandedUser === user.id && (
                  <tr>
                    <td colSpan={4} className="p-0 border-b-2 border-[#05183a]/10">
                      <div className="bg-gradient-to-b from-gray-50 to-white px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-inner">
                        
                        {/* Section 1: Roles */}
                        <div>
                          <h4 className="font-bold text-[#05183a] mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-400 text-lg">admin_panel_settings</span> Rollen & Rechte
                          </h4>
                          <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                              <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={user.is_partner} 
                                  onChange={(e) => executeMutation(user.id, 'UPDATE_ROLE', { is_partner: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              </div>
                              <span className="font-semibold text-gray-700 text-sm">Offizieller Experte / BW-Partner (Forum)</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                              <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={user.is_admin} 
                                  onChange={(e) => executeMutation(user.id, 'UPDATE_ROLE', { is_admin: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                              </div>
                              <span className="font-semibold text-gray-700 text-sm">System-Administrator / Zugriff auf dieses Cockpit</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                              <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={user.has_membership} 
                                  onChange={(e) => executeMutation(user.id, 'UPDATE_ROLE', { has_membership: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                              </div>
                              <span className="font-semibold text-gray-700 text-sm">Abo-Mitglied (Zugriff auf ALLE Module & Live-Events)</span>
                            </label>
                          </div>
                        </div>

                        {/* Section 2: Bookings */}
                        <div>
                          <h4 className="font-bold text-[#05183a] mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-400 text-lg">shopping_bag</span> Einzelfreischaltungen / Module
                          </h4>
                          
                          <div className="flex gap-2 mb-4">
                            <input 
                              type="text" 
                              placeholder="Neuen Slug eintippen (z.B. 'praktiker')" 
                              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#05183a]"
                              value={newSlug}
                              onChange={(e) => setNewSlug(e.target.value)}
                            />
                            <button 
                              onClick={() => {
                                if (newSlug.trim()) {
                                  executeMutation(user.id, 'GRANT_SLUG', { slug: newSlug.trim() });
                                  setNewSlug('');
                                }
                              }}
                              className="bg-[#05183a] hover:bg-[#0a2d6e] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                              Freischalten
                            </button>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            {user.purchases.length === 0 ? (
                              <div className="p-4 text-center text-sm text-gray-500 py-6 bg-gray-50">Keine spezifischen Module zugewiesen.</div>
                            ) : (
                              <ul className="divide-y divide-gray-100">
                                {user.purchases.map(slug => (
                                  <li key={slug} className="p-3 px-4 flex justify-between items-center font-medium font-mono text-sm text-gray-700 bg-gray-50/30">
                                    {slug}
                                    <button 
                                      onClick={() => executeMutation(user.id, 'REVOKE_SLUG', { slug })}
                                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                      title="Zugang entziehen"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
