'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAccounts, createAccount, deleteAccount, type Account } from '@/lib/api';
import { formatCurrency, formatDate, getTodayString } from '@/lib/utils';

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startingBalance: '',
    startDate: getTodayString(),
  });

  useEffect(() => {
    loadAccounts();
  }, []);

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
      loadAccounts();
    } catch (error) {
      console.error('Failed to create account:', error);
      alert('Failed to create account');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
      await deleteAccount(id);
      loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">BananaBook</h1>
          <p className="text-sm text-gray-700 font-medium">Budget Projection & Account Tracking</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Your Accounts</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'Add Account'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Create New Account</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Main Checking"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Create Account
              </button>
            </form>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-800 font-medium mb-4">No accounts yet. Create your first account to get started!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-800 font-medium">Current Balance:</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(account.currentBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-800 font-medium">Starting Balance:</span>
                    <span className="text-sm text-gray-900">
                      {formatCurrency(account.startingBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-800 font-medium">Start Date:</span>
                    <span className="text-sm text-gray-900">
                      {formatDate(account.startDate)}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/accounts/${account.id}`}
                  className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
