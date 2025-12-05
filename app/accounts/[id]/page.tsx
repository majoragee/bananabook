'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getAccount,
  getRecurringTransactions,
  getTransactions,
  getProjection,
  createRecurringTransaction,
  createTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  deleteTransaction,
  reconcileTransaction,
  type Account,
  type RecurringTransaction,
  type Transaction,
  type ProjectionEntry,
} from '@/lib/api';
import { formatCurrency, formatDate, getTodayString } from '@/lib/utils';

type Tab = 'projection' | 'recurring' | 'transactions';

export default function AccountDetail() {
  const params = useParams();
  const router = useRouter();
  const accountId = parseInt(params.id as string);

  const [account, setAccount] = useState<Account | null>(null);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projection, setProjection] = useState<ProjectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('projection');
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [projectionMonths, setProjectionMonths] = useState(12);
  const [reconcileModal, setReconcileModal] = useState<{
    entry: ProjectionEntry;
    customAmount: string;
    updateRecurring: boolean;
  } | null>(null);
  const [balanceAdjustModal, setBalanceAdjustModal] = useState<{
    currentBalance: number;
    newBalance: string;
  } | null>(null);
  const [editRecurringModal, setEditRecurringModal] = useState<RecurringTransaction | null>(null);
  const [editRecurringForm, setEditRecurringForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'deposit' | 'expense',
    frequency: 'monthly' as 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly',
    startDate: '',
    endDate: '',
    active: true,
  });

  const [recurringForm, setRecurringForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'deposit' | 'expense',
    frequency: 'monthly' as 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly',
    startDate: getTodayString(),
    endDate: '',
  });

  const [transactionForm, setTransactionForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'deposit' | 'expense' | 'adjustment',
    date: getTodayString(),
  });

  useEffect(() => {
    loadData();
  }, [accountId, projectionMonths]);

  async function loadData() {
    try {
      setLoading(true);
      const [accountData, recurringData, transactionsData, projectionData] =
        await Promise.all([
          getAccount(accountId),
          getRecurringTransactions(accountId),
          getTransactions(accountId),
          getProjection(accountId, projectionMonths),
        ]);

      setAccount(accountData);
      setRecurring(recurringData);
      setTransactions(transactionsData);
      setProjection(projectionData.projection);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load account data');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRecurring(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createRecurringTransaction({
        accountId,
        description: recurringForm.description,
        amount: parseFloat(recurringForm.amount),
        type: recurringForm.type,
        frequency: recurringForm.frequency,
        startDate: recurringForm.startDate,
        endDate: recurringForm.endDate || null,
      });
      setRecurringForm({
        description: '',
        amount: '',
        type: 'expense',
        frequency: 'monthly',
        startDate: getTodayString(),
        endDate: '',
      });
      setShowRecurringForm(false);
      loadData();
    } catch (error) {
      console.error('Failed to create recurring transaction:', error);
      alert('Failed to create recurring transaction');
    }
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createTransaction({
        accountId,
        description: transactionForm.description,
        amount: parseFloat(transactionForm.amount),
        type: transactionForm.type,
        date: transactionForm.date,
        reconciled: true,
      });
      setTransactionForm({
        description: '',
        amount: '',
        type: 'expense',
        date: getTodayString(),
      });
      setShowTransactionForm(false);
      loadData();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction');
    }
  }

  function openReconcileModal(entry: ProjectionEntry) {
    setReconcileModal({
      entry,
      customAmount: entry.amount.toString(),
      updateRecurring: false,
    });
  }

  function closeReconcileModal() {
    setReconcileModal(null);
  }

  async function handleQuickReconcile() {
    if (!reconcileModal) return;

    try {
      await reconcileTransaction({
        recurringTransactionId: reconcileModal.entry.recurringTransactionId!,
        date: reconcileModal.entry.date,
        amount: reconcileModal.entry.amount,
        updateRecurringAmount: false,
      });
      closeReconcileModal();
      loadData();
    } catch (error) {
      console.error('Failed to reconcile transaction:', error);
      alert('Failed to reconcile transaction');
    }
  }

  async function handleInstantReconcile(entry: ProjectionEntry, e: React.MouseEvent) {
    e.stopPropagation(); // Prevent opening the modal

    try {
      await reconcileTransaction({
        recurringTransactionId: entry.recurringTransactionId!,
        date: entry.date,
        amount: entry.amount,
        updateRecurringAmount: false,
      });
      loadData();
    } catch (error) {
      console.error('Failed to reconcile transaction:', error);
      alert('Failed to reconcile transaction');
    }
  }

  async function handleReconcileWithEdit() {
    if (!reconcileModal) return;

    const amount = parseFloat(reconcileModal.customAmount);
    if (isNaN(amount)) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await reconcileTransaction({
        recurringTransactionId: reconcileModal.entry.recurringTransactionId!,
        date: reconcileModal.entry.date,
        amount,
        updateRecurringAmount: reconcileModal.updateRecurring,
      });
      closeReconcileModal();
      loadData();
    } catch (error) {
      console.error('Failed to reconcile transaction:', error);
      alert('Failed to reconcile transaction');
    }
  }

  async function handleUpdateAmountOnly() {
    if (!reconcileModal) return;

    const amount = parseFloat(reconcileModal.customAmount);
    if (isNaN(amount)) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      // Update the recurring transaction without reconciling
      await updateRecurringTransaction(reconcileModal.entry.recurringTransactionId!, {
        amount,
      });
      closeReconcileModal();
      loadData();
    } catch (error) {
      console.error('Failed to update amount:', error);
      alert('Failed to update amount');
    }
  }

  function openEditRecurringModal(recurring: RecurringTransaction) {
    setEditRecurringModal(recurring);
    setEditRecurringForm({
      description: recurring.description,
      amount: recurring.amount.toString(),
      type: recurring.type,
      frequency: recurring.frequency,
      startDate: recurring.startDate,
      endDate: recurring.endDate || '',
      active: recurring.active,
    });
  }

  function closeEditRecurringModal() {
    setEditRecurringModal(null);
  }

  async function handleUpdateRecurring(e: React.FormEvent) {
    e.preventDefault();
    if (!editRecurringModal) return;

    try {
      await updateRecurringTransaction(editRecurringModal.id, {
        description: editRecurringForm.description,
        amount: parseFloat(editRecurringForm.amount),
        type: editRecurringForm.type,
        frequency: editRecurringForm.frequency,
        startDate: editRecurringForm.startDate,
        endDate: editRecurringForm.endDate || null,
        active: editRecurringForm.active,
      });
      closeEditRecurringModal();
      loadData();
    } catch (error) {
      console.error('Failed to update recurring transaction:', error);
      alert('Failed to update recurring transaction');
    }
  }

  async function handleDeleteRecurring(id: number) {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) return;
    try {
      await deleteRecurringTransaction(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete recurring transaction:', error);
      alert('Failed to delete recurring transaction');
    }
  }

  async function handleDeleteTransaction(id: number) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteTransaction(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction');
    }
  }

  function openBalanceAdjustModal() {
    if (!account) return;
    setBalanceAdjustModal({
      currentBalance: account.currentBalance,
      newBalance: Number(account.currentBalance).toFixed(2),
    });
  }

  function closeBalanceAdjustModal() {
    setBalanceAdjustModal(null);
  }

  async function handleBalanceAdjust() {
    if (!balanceAdjustModal) return;

    const newBalance = parseFloat(balanceAdjustModal.newBalance);
    if (isNaN(newBalance)) {
      alert('Please enter a valid balance');
      return;
    }

    const difference = newBalance - balanceAdjustModal.currentBalance;

    if (difference === 0) {
      alert('Balance is already correct');
      closeBalanceAdjustModal();
      return;
    }

    try {
      // Create an adjustment transaction for the difference
      await createTransaction({
        accountId,
        description: `Balance adjustment to ${formatCurrency(newBalance)}`,
        amount: Math.abs(difference),
        type: 'adjustment',
        date: getTodayString(),
        reconciled: true,
      });
      closeBalanceAdjustModal();
      loadData();
    } catch (error) {
      console.error('Failed to adjust balance:', error);
      alert('Failed to adjust balance');
    }
  }

  if (loading || !account) {
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
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Back to Accounts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
          <div className="mt-2">
            <span className="text-sm text-gray-800 font-medium">Current Balance: </span>
            <button
              onClick={openBalanceAdjustModal}
              className="text-lg font-semibold text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer"
              title="Click to adjust balance"
            >
              {formatCurrency(account.currentBalance)}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('projection')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'projection'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Balance Projection
              </button>
              <button
                onClick={() => setActiveTab('recurring')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'recurring'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Recurring Transactions
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'transactions'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Transaction History
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'projection' && (
              <div>
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <p className="text-sm text-gray-800 font-medium">
                    Click the <span className="text-green-600 font-bold">✓</span> button for quick reconcile, or click anywhere else on the row to edit the amount.
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-900">Show:</label>
                    <select
                      value={projectionMonths}
                      onChange={(e) => setProjectionMonths(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-400 rounded-md text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={1}>1 month</option>
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={12}>1 year</option>
                      <option value={18}>18 months</option>
                      <option value={24}>2 years</option>
                    </select>
                  </div>
                </div>

                {/* Balance Status Alert */}
                {(() => {
                  const unreconciled = projection.filter(entry => !entry.isReconciled);
                  const firstNegative = unreconciled.find(entry => entry.balance < 0);

                  if (firstNegative) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const negativeDate = new Date(firstNegative.date);
                    const daysUntil = Math.ceil((negativeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">⚠️</span>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-red-900 mb-1">
                              Negative Balance Alert
                            </h4>
                            <p className="text-sm text-red-800">
                              Your balance is projected to go negative{' '}
                              {daysUntil > 0 ? (
                                <>
                                  in <span className="font-bold text-red-900">{daysUntil} {daysUntil === 1 ? 'day' : 'days'}</span> on{' '}
                                </>
                              ) : daysUntil === 0 ? (
                                <>today on </>
                              ) : (
                                <>on </>
                              )}
                              <span className="font-bold">{formatDate(firstNegative.date)}</span>
                              {' '}reaching{' '}
                              <span className="font-bold text-red-900">
                                {formatCurrency(firstNegative.balance)}
                              </span>
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                              Transaction: {firstNegative.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Find the lowest balance
                  const lowestEntry = unreconciled.reduce((lowest, entry) => {
                    return entry.balance < lowest.balance ? entry : lowest;
                  }, unreconciled[0]);

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const lowestDate = new Date(lowestEntry.date);
                  const daysUntilLowest = Math.ceil((lowestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">✅</span>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-green-900 mb-1">
                            Balance Healthy
                          </h4>
                          <p className="text-sm text-green-800">
                            Your balance stays positive throughout the next{' '}
                            {projectionMonths === 1 ? 'month' :
                             projectionMonths === 12 ? 'year' :
                             projectionMonths + ' months'}!
                          </p>
                          <p className="text-xs text-green-700 mt-2">
                            Lowest projected balance:{' '}
                            <span className="font-bold">{formatCurrency(lowestEntry.balance)}</span>
                            {' '}
                            {daysUntilLowest > 0 ? (
                              <>
                                in <span className="font-bold">{daysUntilLowest} {daysUntilLowest === 1 ? 'day' : 'days'}</span> on{' '}
                              </>
                            ) : daysUntilLowest === 0 ? (
                              <>today on </>
                            ) : (
                              <>on </>
                            )}
                            <span className="font-bold">{formatDate(lowestEntry.date)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projection.filter(entry => !entry.isReconciled).map((entry, index) => {
                        const entryDate = new Date(entry.date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isPastDue = !entry.isReconciled && entryDate < today;
                        const isNegativeBalance = entry.balance < 0;

                        return (
                          <tr
                            key={index}
                            className={`${
                              isNegativeBalance
                                ? 'bg-red-100 hover:bg-red-200'
                                : isPastDue
                                ? 'bg-orange-50 hover:bg-orange-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td
                              className="px-4 py-3 text-sm text-gray-900 cursor-pointer"
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {formatDate(entry.date)}
                            </td>
                            <td
                              className="px-4 py-3 text-sm text-gray-900 cursor-pointer"
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {entry.description}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-medium cursor-pointer ${
                                entry.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                              }`}
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {entry.type === 'deposit' ? '+' : '-'}
                              {formatCurrency(entry.amount)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-semibold cursor-pointer ${
                                entry.balance < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {formatCurrency(entry.balance)}
                            </td>
                            <td
                              className="px-4 py-3 text-sm text-center cursor-pointer"
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {isPastDue ? (
                                <span className="text-orange-600 font-semibold">⚠ Past Due</span>
                              ) : (
                                <span className="text-gray-400">Projected</span>
                              )}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {entry.recurringTransactionId && (
                                <button
                                  onClick={(e) => handleInstantReconcile(entry, e)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900 transition-colors font-bold text-lg"
                                  title="Quick reconcile with estimated amount"
                                >
                                  ✓
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'recurring' && (
              <div>
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowRecurringForm(!showRecurringForm)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    {showRecurringForm ? 'Cancel' : 'Add Recurring Transaction'}
                  </button>
                </div>

                {/* Summary Stats */}
                {recurring.length > 0 && (() => {
                  const getMonthlyAmount = (amount: number, frequency: string) => {
                    switch (frequency) {
                      case 'daily': return amount * 30;
                      case 'weekly': return amount * 4;
                      case 'bi-weekly': return amount * 2;
                      case 'monthly': return amount;
                      case 'yearly': return 0; // Ignore yearly
                      default: return 0;
                    }
                  };

                  const monthlyDeposits = recurring
                    .filter(item => item.type === 'deposit')
                    .reduce((sum, item) => sum + getMonthlyAmount(Number(item.amount), item.frequency), 0);

                  const monthlyExpenses = recurring
                    .filter(item => item.type === 'expense')
                    .reduce((sum, item) => sum + getMonthlyAmount(Number(item.amount), item.frequency), 0);

                  const netCashFlow = monthlyDeposits - monthlyExpenses;

                  return (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-sm text-gray-800 font-medium mb-1">
                          Monthly Deposits
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(monthlyDeposits)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Estimated per month
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="text-sm text-gray-800 font-medium mb-1">
                          Monthly Expenses
                        </div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(monthlyExpenses)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Estimated per month
                        </div>
                      </div>
                      <div className={`border rounded-lg p-4 ${
                        netCashFlow >= 0
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-orange-50 border-orange-200'
                      }`}>
                        <div className="text-sm text-gray-800 font-medium mb-1">
                          Net Cash Flow
                        </div>
                        <div className={`text-2xl font-bold ${
                          netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'
                        }`}>
                          {formatCurrency(netCashFlow)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {netCashFlow >= 0 ? 'Surplus per month' : 'Deficit per month'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {showRecurringForm && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <form onSubmit={handleCreateRecurring} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          required
                          value={recurringForm.description}
                          onChange={(e) =>
                            setRecurringForm({ ...recurringForm, description: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g., Electric Bill"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={recurringForm.amount}
                            onChange={(e) =>
                              setRecurringForm({ ...recurringForm, amount: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Type
                          </label>
                          <select
                            value={recurringForm.type}
                            onChange={(e) =>
                              setRecurringForm({
                                ...recurringForm,
                                type: e.target.value as 'deposit' | 'expense',
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="expense">Expense</option>
                            <option value="deposit">Deposit</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Frequency
                        </label>
                        <select
                          value={recurringForm.frequency}
                          onChange={(e) =>
                            setRecurringForm({
                              ...recurringForm,
                              frequency: e.target.value as any,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="bi-weekly">Bi-Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            required
                            value={recurringForm.startDate}
                            onChange={(e) =>
                              setRecurringForm({ ...recurringForm, startDate: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            End Date (optional)
                          </label>
                          <input
                            type="date"
                            value={recurringForm.endDate}
                            onChange={(e) =>
                              setRecurringForm({ ...recurringForm, endDate: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Create Recurring Transaction
                      </button>
                    </form>
                  </div>
                )}

                {recurring.length === 0 ? (
                  <div className="text-center py-8 text-gray-800 font-medium">
                    No recurring transactions yet. Add one to get started!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recurring.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{item.description}</h4>
                            <div className="mt-2 space-y-1 text-sm text-gray-800 font-medium">
                              <div>
                                Amount:{' '}
                                <span className={`font-semibold ${
                                  item.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {item.type === 'deposit' ? '+' : '-'}
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                              <div>Frequency: {item.frequency}</div>
                              <div>Start: {formatDate(item.startDate)}</div>
                              {item.endDate && <div>End: {formatDate(item.endDate)}</div>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditRecurringModal(item)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRecurring(item.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowTransactionForm(!showTransactionForm)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    {showTransactionForm ? 'Cancel' : 'Add Ad-Hoc Transaction'}
                  </button>
                </div>

                {showTransactionForm && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <form onSubmit={handleCreateTransaction} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          required
                          value={transactionForm.description}
                          onChange={(e) =>
                            setTransactionForm({ ...transactionForm, description: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g., Emergency Car Repair"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={transactionForm.amount}
                            onChange={(e) =>
                              setTransactionForm({ ...transactionForm, amount: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Type
                          </label>
                          <select
                            value={transactionForm.type}
                            onChange={(e) =>
                              setTransactionForm({
                                ...transactionForm,
                                type: e.target.value as any,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="expense">Expense</option>
                            <option value="deposit">Deposit</option>
                            <option value="adjustment">Balance Adjustment</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          required
                          value={transactionForm.date}
                          onChange={(e) =>
                            setTransactionForm({ ...transactionForm, date: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Add Transaction
                      </button>
                    </form>
                  </div>
                )}

                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-800 font-medium">
                    No transactions yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((txn) => (
                      <div key={txn.id} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{txn.description}</h4>
                            <div className="mt-2 space-y-1 text-sm text-gray-800 font-medium">
                              <div>
                                Amount:{' '}
                                <span className={`font-semibold ${
                                  txn.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {txn.type === 'deposit' ? '+' : '-'}
                                  {formatCurrency(txn.amount)}
                                </span>
                              </div>
                              <div>Date: {formatDate(txn.date)}</div>
                              <div>Type: {txn.type}</div>
                              {txn.reconciledDate && (
                                <div>Reconciled: {formatDate(txn.reconciledDate)}</div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteTransaction(txn.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reconciliation Modal */}
      {reconcileModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeReconcileModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closeReconcileModal();
              }
            }}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reconcile Transaction</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-800 font-medium mb-1">
                {reconcileModal.entry.description}
              </div>
              <div className="text-xs text-gray-600">
                {formatDate(reconcileModal.entry.date)}
              </div>
              <div className={`text-lg font-semibold mt-2 ${
                reconcileModal.entry.type === 'deposit' ? 'text-green-600' : 'text-red-600'
              }`}>
                Estimated: {reconcileModal.entry.type === 'deposit' ? '+' : '-'}
                {formatCurrency(reconcileModal.entry.amount)}
              </div>
            </div>

            <div className="space-y-4">
              {/* Quick Reconcile Button */}
              <button
                onClick={handleQuickReconcile}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-semibold text-lg"
              >
                ✓ Quick Reconcile ({formatCurrency(reconcileModal.entry.amount)})
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or adjust amount</span>
                </div>
              </div>

              {/* Edit Amount Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Actual Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={reconcileModal.customAmount}
                  onChange={(e) =>
                    setReconcileModal({ ...reconcileModal, customAmount: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleReconcileWithEdit();
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-400 rounded-lg text-gray-900 text-lg font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Update Recurring Checkbox */}
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reconcileModal.updateRecurring}
                  onChange={(e) =>
                    setReconcileModal({ ...reconcileModal, updateRecurring: e.target.checked })
                  }
                  className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-400 rounded cursor-pointer"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    Also update future occurrences
                  </div>
                  <div className="text-xs text-gray-600">
                    Use this amount for all future projected transactions
                  </div>
                </div>
              </label>

              {/* Update Amount Only Button */}
              <button
                onClick={handleUpdateAmountOnly}
                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 font-semibold"
              >
                💾 Update Amount (Don't Reconcile Yet)
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or reconcile now</span>
                </div>
              </div>

              {/* Reconcile with Edit Button */}
              <button
                onClick={handleReconcileWithEdit}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Reconcile with New Amount
              </button>

              {/* Cancel Button */}
              <button
                onClick={closeReconcileModal}
                className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {balanceAdjustModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeBalanceAdjustModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closeBalanceAdjustModal();
              }
            }}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Adjust Current Balance</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-800 font-medium mb-1">
                Current Balance
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(balanceAdjustModal.currentBalance)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  New Balance (from bank statement)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceAdjustModal.newBalance}
                  onChange={(e) =>
                    setBalanceAdjustModal({ ...balanceAdjustModal, newBalance: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBalanceAdjust();
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg text-gray-900 text-xl font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {(() => {
                const newBalance = parseFloat(balanceAdjustModal.newBalance);
                if (!isNaN(newBalance) && newBalance !== balanceAdjustModal.currentBalance) {
                  const difference = newBalance - balanceAdjustModal.currentBalance;
                  return (
                    <div className={`p-3 rounded-lg ${
                      difference > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="text-sm text-gray-800 font-medium">
                        Adjustment will be:
                      </div>
                      <div className={`text-lg font-bold ${
                        difference > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {difference > 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        A reconciled adjustment transaction will be created
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <button
                onClick={handleBalanceAdjust}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Adjust Balance
              </button>

              <button
                onClick={closeBalanceAdjustModal}
                className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recurring Transaction Modal */}
      {editRecurringModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeEditRecurringModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                closeEditRecurringModal();
              }
            }}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Recurring Transaction</h3>

            {/* Impact explanation */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <span className="text-lg">ℹ️</span>
                How will this edit affect my projections?
              </h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-green-600 mt-0.5">✓</span>
                  <div>
                    <span className="font-semibold">Past reconciled transactions:</span> Will NOT be changed.
                    These are locked in as actual transactions.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-orange-600 mt-0.5">⚠</span>
                  <div>
                    <span className="font-semibold">Past unreconciled projections:</span> Will be updated
                    with the new values from this edit.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 mt-0.5">→</span>
                  <div>
                    <span className="font-semibold">Future projections:</span> Will be recalculated
                    with the new values from this edit.
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateRecurring} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={editRecurringForm.description}
                  onChange={(e) =>
                    setEditRecurringForm({ ...editRecurringForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editRecurringForm.amount}
                    onChange={(e) =>
                      setEditRecurringForm({ ...editRecurringForm, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Type
                  </label>
                  <select
                    value={editRecurringForm.type}
                    onChange={(e) =>
                      setEditRecurringForm({
                        ...editRecurringForm,
                        type: e.target.value as 'deposit' | 'expense',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="expense">Expense</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Frequency
                </label>
                <select
                  value={editRecurringForm.frequency}
                  onChange={(e) =>
                    setEditRecurringForm({
                      ...editRecurringForm,
                      frequency: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editRecurringForm.startDate}
                    onChange={(e) =>
                      setEditRecurringForm({ ...editRecurringForm, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={editRecurringForm.endDate}
                    onChange={(e) =>
                      setEditRecurringForm({ ...editRecurringForm, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRecurringForm.active}
                    onChange={(e) =>
                      setEditRecurringForm({ ...editRecurringForm, active: e.target.checked })
                    }
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-400 rounded cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-900">Active</span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-7">
                  Inactive recurring transactions won't appear in future projections
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={closeEditRecurringModal}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
