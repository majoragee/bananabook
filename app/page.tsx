'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAccounts, createAccount, deleteAccount, type Account } from '@/lib/api';
import { formatCurrency, formatDate, getTodayString } from '@/lib/utils';

type Toast = { kind: 'error' | 'success'; msg: string };

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startingBalance: '',
    startDate: getTodayString(),
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!deleteConfirm) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteConfirm(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirm]);

  async function loadAccounts() {
    try {
      setLoading(true);
      const data = await getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createAccount({
        name: formData.name,
        startingBalance: parseFloat(formData.startingBalance),
        startDate: formData.startDate,
      });
      setFormData({ name: '', startingBalance: '', startDate: getTodayString() });
      setShowForm(false);
      setToast({ kind: 'success', msg: 'Account created.' });
      loadAccounts();
    } catch (error) {
      console.error('Failed to create account:', error);
      setToast({ kind: 'error', msg: "Couldn't create the account — check your connection and try again." });
    }
  }

  function requestDelete(id: number, label: string) {
    setDeleteConfirm({ id, label });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteAccount(id);
      loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      setToast({ kind: 'error', msg: "Couldn't delete the account — check your connection and try again." });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-mute">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-ink">BananaBook</h1>
          <p className="text-sm text-ink-soft font-medium">Budget Projection & Account Tracking</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-ink">Your Accounts</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
          >
            {showForm ? 'Cancel' : 'Add Account'}
          </button>
        </div>

        {showForm && (
          <div className="card p-6 mb-6">
            <h3 className="text-lg font-semibold text-ink mb-4">Create New Account</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="field"
                  placeholder="e.g., Main Checking"
                />
              </div>
              <div>
                <label className="label">
                  Starting Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.startingBalance}
                  onChange={(e) =>
                    setFormData({ ...formData, startingBalance: e.target.value })
                  }
                  className="num field"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="field"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
              >
                Create Account
              </button>
            </form>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="card p-8 text-center text-ink-soft">
            <p className="font-medium mb-4">No accounts yet. Create your first account to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-ink">{account.name}</h3>
                  <div className="num text-ink-mute text-xs mt-1">
                    Starting {formatCurrency(account.startingBalance)} on {formatDate(account.startDate)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="stat text-lg text-ink text-right">
                    {formatCurrency(account.currentBalance)}
                  </div>
                  <Link
                    href={`/accounts/${account.id}`}
                    className="btn btn-ghost"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => requestDelete(account.id, account.name)}
                    className="btn-danger-quiet"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-4 inset-x-0 flex justify-center z-50 px-4">
          <div
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`card px-4 py-3 text-sm font-medium shadow-xl ${
              toast.kind === 'error' ? 'bg-neg-soft text-neg' : 'bg-pos-soft text-pos'
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="card shadow-xl max-w-sm w-full p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete account"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink mb-2">Delete account?</h3>
            <p className="text-sm text-ink-soft mb-6">
              This will permanently delete &ldquo;{deleteConfirm.label}&rdquo; and its transaction history.
              This can&apos;t be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="btn btn-danger flex-1">
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-ghost flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
