
import React from 'react';
import { User, Bell, CreditCard, Shield } from 'lucide-react';

const SettingsView: React.FC = () => {
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-semibold tracking-tight">Preferences & Config</h1>
      
      <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-10 space-y-12">
        <section className="space-y-6">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3"><User className="w-4 h-4 text-indigo-400" /> Account Identity</h3>
          <div className="flex items-center gap-8 mb-8">
            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-3xl font-bold border-2 border-white/10">R</div>
            <div>
              <h4 className="text-xl font-bold text-white">Rajesh Kumar</h4>
              <p className="text-slate-500 text-sm">Verified Institutional Access</p>
            </div>
          </div>
        </section>

        <section className="space-y-6 pt-10 border-t border-white/5">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3"><Bell className="w-4 h-4 text-amber-400" /> Notifications</h3>
          <div className="flex items-center justify-between bg-slate-950/40 p-5 rounded-2xl border border-white/5">
            <span className="text-sm font-bold text-slate-200">Morning Risk Brief (WhatsApp)</span>
            <div className="w-12 h-6 rounded-full p-1.5 bg-indigo-600">
              <div className="w-3 h-3 bg-white rounded-full translate-x-6" />
            </div>
          </div>
        </section>

        <section className="pt-10 border-t border-white/5">
          <div className="bg-gradient-to-r from-indigo-900/40 to-violet-900/30 border border-indigo-500/20 p-8 rounded-[2rem] flex items-center justify-between">
            <div>
              <h4 className="text-2xl font-bold text-white flex items-center gap-3">Elite Institutional <Shield className="w-6 h-6 text-indigo-400" /></h4>
              <p className="text-xs text-slate-400 mt-2 font-medium">Next Billing: Jan 16, 2025</p>
            </div>
            <button className="px-8 py-4 bg-white text-slate-950 font-bold rounded-2xl text-sm">Manage</button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;
