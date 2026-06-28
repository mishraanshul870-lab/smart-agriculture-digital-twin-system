import React, { useState } from 'react';
import { User as UserIcon, Mail, Layers, LogOut, ShieldCheck, Cpu, Edit2, Check, X, Loader2 } from 'lucide-react';
import { User, Farm } from '../types';
import { fetch } from '../utils/api';

interface ProfileProps {
  user: User;
  farms: Farm[];
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

export default function Profile({ user, farms, onLogout, onUpdateUser }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        onUpdateUser(data.user);
        setIsEditing(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold text-white">Farmer Profile</h2>
        <p className="text-sm text-neutral-400">
          Manage your agricultural account, system settings, and twin configurations.
        </p>
      </div>

      {/* Profile Details Card */}
      <div className="bg-[#1E1E1E] border border-neutral-800 rounded-xl p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-[#2E7D32]/10 border border-[#2E7D32]/20 rounded-full text-[#4CAF50]">
              <UserIcon className="h-10 w-10" />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="bg-[#252525] border border-neutral-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#4CAF50]"
                  />
                  <button onClick={handleSave} disabled={loading} className="p-1.5 bg-[#4CAF50]/20 text-[#4CAF50] rounded-lg hover:bg-[#4CAF50]/30 transition-colors">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setIsEditing(false)} disabled={loading} className="p-1.5 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                  <button onClick={() => setIsEditing(true)} className="text-neutral-500 hover:text-white transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <span className="text-xs text-neutral-400 font-mono flex items-center gap-1 mt-0.5">
                <Mail className="h-3.5 w-3.5 text-neutral-500" />
                {user.email}
              </span>
            </div>
          </div>
        </div>

        {/* User stats */}
        <div className="grid grid-cols-2 gap-4 border-t border-b border-neutral-800/60 py-5">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-500">Registered Farms</span>
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <Layers className="h-4 w-4 text-[#4CAF50]" />
              <span>{farms.length} of 10</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-500">System Gateway</span>
            <div className="flex items-center gap-1.5 text-[#4CAF50] font-mono text-xs font-semibold">
              <Cpu className="h-4 w-4 text-[#4CAF50]" />
              <span>CONNECTED (SIM)</span>
            </div>
          </div>
        </div>

        {/* Security / System compliance info */}
        <div className="flex gap-2.5 bg-neutral-900/50 border border-neutral-800/50 p-4 rounded-xl text-xs text-neutral-300">
          <ShieldCheck className="h-5 w-5 text-[#4CAF50] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Privacy & Verification</p>
            <p className="leading-relaxed text-neutral-400">
              Your credentials are secured with stateful hash checks. Simulated IoT tokens are dynamically rotated upon page refreshes to protect system integrity.
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="w-full h-11 bg-red-950/20 hover:bg-red-900/10 text-red-400 hover:text-red-300 border border-red-900/30 hover:border-red-800/40 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign Out of Account
        </button>
      </div>
    </div>
  );
}
