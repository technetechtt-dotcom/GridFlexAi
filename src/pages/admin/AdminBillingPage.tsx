import React, { useEffect, useState } from 'react';
import { CreditCard, Trash2, Edit2, Plus, Download, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchAdminBillingAccounts,
  createAdminBillingAccount,
  updateAdminBillingAccount,
  deleteAdminBillingAccount,
  fetchAdminClients,
  type AdminBillingAccount,
  type AdminClient
} from '../../services/api';

export function AdminBillingPage() {
  const [accounts, setAccounts] = useState<AdminBillingAccount[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientId: '',
    plan: 'starter' as 'starter' | 'pro' | 'enterprise',
    status: 'active' as 'active' | 'suspended' | 'past_due',
    billingEmail: '',
    taxId: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, clis] = await Promise.all([
        fetchAdminBillingAccounts(),
        fetchAdminClients()
      ]);
      setAccounts(accs);
      setClients(clis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateAdminBillingAccount(editingId, {
          plan: form.plan,
          status: form.status,
          billingEmail: form.billingEmail,
          taxId: form.taxId
        });
      } else {
        await createAdminBillingAccount(form);
      }
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to save billing account');
    }
  };

  const handleEdit = (acc: AdminBillingAccount) => {
    setForm({
      clientId: acc.clientId,
      plan: acc.plan,
      status: acc.status,
      billingEmail: acc.billingEmail ?? '',
      taxId: acc.taxId ?? ''
    });
    setEditingId(acc.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this billing account?')) return;
    try {
      await deleteAdminBillingAccount(id);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to delete billing account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Billing & Subscriptions</h2>
          <p className="text-sm text-slate-400">Manage client subscriptions and invoicing.</p>
        </div>
        <button
          onClick={() => {
            setForm({ clientId: '', plan: 'starter', status: 'active', billingEmail: '', taxId: '' });
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {showForm ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Billing Account'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Client</label>
                <select
                  disabled={!!editingId}
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Plan</label>
                <select
                  value={form.plan}
                  onChange={e => setForm(f => ({ ...f, plan: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="past_due">Past Due</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Billing Email</label>
                <input
                  type="email"
                  value={form.billingEmail}
                  onChange={e => setForm(f => ({ ...f, billingEmail: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-lg px-4 py-2 text-sm font-medium text-white">
                  {editingId ? 'Update Billing Account' : 'Create Billing Account'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-300">Client</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Plan</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Invoices</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No billing accounts found.</td></tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{acc.client.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" /> {acc.billingEmail || 'No email set'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                        acc.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400' :
                        acc.plan === 'pro' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {acc.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                        acc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        acc.status === 'suspended' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {acc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-500" />
                        {acc.invoiceCount} invoices
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(acc)} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-slate-300">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(acc.id)} className="p-1.5 bg-slate-800 rounded hover:bg-red-500/20 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
