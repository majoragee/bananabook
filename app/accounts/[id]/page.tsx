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
type Toast = { kind: 'error' | 'success'; msg: string };
type DeleteTarget = { id: number; kind: 'recurring' | 'transaction'; label: string };

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
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteTarget | null>(null);
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const anyModalOpen = reconcileModal || balanceAdjustModal || editRecurringModal || deleteConfirm;
    if (!anyModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setReconcileModal(null);
        setBalanceAdjustModal(null);
        setEditRecurringModal(null);
        setDeleteConfirm(null);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [reconcileModal, balanceAdjustModal, editRecurringModal, deleteConfirm]);

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
      setToast({ kind: 'error', msg: "Couldn't load the account data — check your connection and try again." });
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRecurring(e: React.FormEvent) {
    e.preventDefault();
    if (recurringForm.endDate && recurringForm.endDate < recurringForm.startDate) {
      setToast({ kind: 'error', msg: "End date can't be before the start date." });
      return;
    }
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
      setToast({ kind: 'success', msg: 'Recurring transaction created.' });
      loadData();
    } catch (error) {
      console.error('Failed to create recurring transaction:', error);
      setToast({ kind: 'error', msg: "Couldn't create the recurring transaction — check your connection and try again." });
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
      setToast({ kind: 'success', msg: 'Transaction recorded.' });
      loadData();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      setToast({ kind: 'error', msg: "Couldn't record the transaction — check your connection and try again." });
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
      setToast({ kind: 'success', msg: 'Transaction reconciled.' });
      loadData();
    } catch (error) {
      console.error('Failed to reconcile transaction:', error);
      setToast({ kind: 'error', msg: "Couldn't reconcile the transaction — check your connection and try again." });
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
      setToast({ kind: 'success', msg: 'Transaction reconciled.' });
      loadData();
    } catch (error) {
      console.error('Failed to reconcile transaction:', error);
      setToast({ kind: 'error', msg: "Couldn't reconcile the transaction — check your connection and try again." });
    }
  }

  async function handleReconcileWithEdit() {
    if (!reconcileModal) return;

    const amount = parseFloat(reconcileModal.customAmount);
    if (isNaN(amount)) {
      setToast({ kind: 'error', msg: 'Please enter a valid amount.' });
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
      setToast({ kind: 'success', msg: 'Transaction reconciled.' });
      loadData();
    } catch (error) {
      console.error('Failed to reconcile transaction:', error);
      setToast({ kind: 'error', msg: "Couldn't reconcile the transaction — check your connection and try again." });
    }
  }

  async function handleUpdateAmountOnly() {
    if (!reconcileModal) return;

    const amount = parseFloat(reconcileModal.customAmount);
    if (isNaN(amount)) {
      setToast({ kind: 'error', msg: 'Please enter a valid amount.' });
      return;
    }

    try {
      // Update the recurring transaction without reconciling
      await updateRecurringTransaction(reconcileModal.entry.recurringTransactionId!, {
        amount,
      });
      closeReconcileModal();
      setToast({ kind: 'success', msg: 'Estimate updated.' });
      loadData();
    } catch (error) {
      console.error('Failed to update amount:', error);
      setToast({ kind: 'error', msg: "Couldn't update the estimate — check your connection and try again." });
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

    if (editRecurringForm.endDate && editRecurringForm.endDate < editRecurringForm.startDate) {
      setToast({ kind: 'error', msg: "End date can't be before the start date." });
      return;
    }

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
      setToast({ kind: 'success', msg: 'Recurring transaction updated.' });
      loadData();
    } catch (error) {
      console.error('Failed to update recurring transaction:', error);
      setToast({ kind: 'error', msg: "Couldn't update the recurring transaction — check your connection and try again." });
    }
  }

  function requestDeleteRecurring(id: number, label: string) {
    setDeleteConfirm({ id, kind: 'recurring', label });
  }

  function requestDeleteTransaction(id: number, label: string) {
    setDeleteConfirm({ id, kind: 'transaction', label });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { id, kind } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      if (kind === 'recurring') {
        await deleteRecurringTransaction(id);
      } else {
        await deleteTransaction(id);
      }
      loadData();
    } catch (error) {
      console.error(`Failed to delete ${kind}:`, error);
      setToast({
        kind: 'error',
        msg: `Couldn't delete the ${kind === 'recurring' ? 'recurring transaction' : 'transaction'} — check your connection and try again.`,
      });
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
      setToast({ kind: 'error', msg: 'Please enter a valid balance.' });
      return;
    }

    const difference = newBalance - balanceAdjustModal.currentBalance;

    if (difference === 0) {
      setToast({ kind: 'success', msg: 'Balance is already correct — nothing to adjust.' });
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
      setToast({ kind: 'success', msg: 'Balance adjusted.' });
      loadData();
    } catch (error) {
      console.error('Failed to adjust balance:', error);
      setToast({ kind: 'error', msg: "Couldn't adjust the balance — check your connection and try again." });
    }
  }

  if (loading || !account) {
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
          <Link href="/" className="text-accent text-sm mb-2 inline-block">
            ← Back to Accounts
          </Link>
          <h1 className="text-2xl font-bold text-ink">{account.name}</h1>
          <div className="mt-2">
            <span className="text-sm text-ink-soft font-medium">Current Balance: </span>
            <button
              onClick={openBalanceAdjustModal}
              className="num text-2xl font-semibold text-accent underline decoration-dotted underline-offset-4 cursor-pointer"
              title="Click to adjust balance"
            >
              {formatCurrency(account.currentBalance)}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero verdict band — always visible regardless of active tab */}
        <div className="card p-6 mb-6">
          {(() => {
            const unreconciled = projection.filter(entry => !entry.isReconciled);
            const firstNegative = unreconciled.find(entry => entry.balance < 0);
            const lowestEntry = unreconciled.length > 0
              ? unreconciled.reduce((lowest, entry) => (entry.balance < lowest.balance ? entry : lowest), unreconciled[0])
              : null;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let daysUntil = 0;
            if (firstNegative) {
              const negativeDate = new Date(firstNegative.date);
              daysUntil = Math.ceil((negativeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            }

            let daysUntilLowest = 0;
            if (lowestEntry) {
              const lowestDate = new Date(lowestEntry.date);
              daysUntilLowest = Math.ceil((lowestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            }

            return (
              <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                <div>
                  {firstNegative ? (
                    <>
                      <span className="badge badge-warn">Overdraft ahead</span>
                      <p className="text-lg text-ink mt-2">
                        Goes negative{' '}
                        {daysUntil > 0 ? (
                          <>
                            in <span className="font-semibold">{daysUntil} {daysUntil === 1 ? 'day' : 'days'}</span> on{' '}
                          </>
                        ) : daysUntil === 0 ? (
                          <>today on </>
                        ) : (
                          <>on </>
                        )}
                        <span className="font-semibold">{formatDate(firstNegative.date)}</span>
                        {' '}reaching{' '}
                        <span className="stat text-neg">{formatCurrency(firstNegative.balance)}</span>
                      </p>
                      <p className="text-xs text-ink-mute mt-1">
                        Transaction: {firstNegative.description}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="badge badge-mute">On track</span>
                      <p className="text-lg text-ink mt-2">
                        Balance stays positive through the next{' '}
                        {projectionMonths === 1 ? 'month' :
                         projectionMonths === 12 ? 'year' :
                         projectionMonths + ' months'}
                      </p>
                      {lowestEntry && (
                        <p className="text-xs text-ink-mute mt-1">
                          Lowest point{' '}
                          <span className="stat">{formatCurrency(lowestEntry.balance)}</span>
                          {' '}
                          {daysUntilLowest > 0 ? (
                            <>
                              in <span className="font-semibold">{daysUntilLowest} {daysUntilLowest === 1 ? 'day' : 'days'}</span> on{' '}
                            </>
                          ) : daysUntilLowest === 0 ? (
                            <>today on </>
                          ) : (
                            <>on </>
                          )}
                          <span className="font-semibold">{formatDate(lowestEntry.date)}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="col-head">Current Balance</div>
                    <div className="stat text-lg text-ink mt-1">{formatCurrency(account.currentBalance)}</div>
                  </div>
                  {lowestEntry && (
                    <div>
                      <div className="col-head">Lowest Projected</div>
                      <div className={`stat text-lg mt-1 ${lowestEntry.balance < 0 ? 'text-neg' : 'text-ink'}`}>
                        {formatCurrency(lowestEntry.balance)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="card mb-6">
          <div className="border-b border-line">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('projection')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'projection'
                    ? 'border-b-2 border-accent text-ink'
                    : 'text-ink-mute hover:text-ink'
                }`}
              >
                Balance Projection
              </button>
              <button
                onClick={() => setActiveTab('recurring')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'recurring'
                    ? 'border-b-2 border-accent text-ink'
                    : 'text-ink-mute hover:text-ink'
                }`}
              >
                Recurring Transactions
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'transactions'
                    ? 'border-b-2 border-accent text-ink'
                    : 'text-ink-mute hover:text-ink'
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
                  <p className="text-sm text-ink-soft font-medium">
                    Tap <span className="text-pos font-bold">✓</span> to confirm a projected item at its estimated amount, or Adjust to enter what actually happened.
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-ink">Show:</label>
                    <select
                      value={projectionMonths}
                      onChange={(e) => setProjectionMonths(parseInt(e.target.value))}
                      className="px-3 py-2 border border-line-strong rounded-md text-ink font-medium bg-surface focus:border-accent focus:ring-1 focus:ring-accent"
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

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="col-head px-4 py-3 text-left">Date</th>
                        <th className="col-head px-4 py-3 text-left">Description</th>
                        <th className="col-head px-4 py-3 text-right">Amount</th>
                        <th className="col-head px-4 py-3 text-right">Balance</th>
                        <th className="col-head px-4 py-3 text-center">Status</th>
                        <th className="col-head px-2 py-3 text-center w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-line">
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
                                ? 'bg-neg-soft hover:bg-neg-soft'
                                : isPastDue
                                ? 'bg-warn-soft'
                                : 'hover:bg-surface-2'
                            }`}
                          >
                            <td
                              className="num px-4 py-3 text-sm text-ink-soft cursor-pointer whitespace-nowrap"
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {formatDate(entry.date)}
                            </td>
                            <td
                              className="px-4 py-3 text-sm text-ink cursor-pointer"
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {entry.description}
                            </td>
                            <td
                              className={`num px-4 py-3 text-sm text-right font-medium cursor-pointer whitespace-nowrap ${
                                entry.type === 'deposit' ? 'text-pos' : 'text-neg'
                              }`}
                              onClick={() => {
                                if (entry.recurringTransactionId) {
                                  openReconcileModal(entry);
                                }
                              }}
                            >
                              {entry.type === 'deposit' ? '+' : '−'}
                              {formatCurrency(entry.amount)}
                            </td>
                            <td
                              className={`num px-4 py-3 text-sm text-right font-semibold cursor-pointer whitespace-nowrap ${
                                entry.balance < 0 ? 'text-neg' : 'text-ink'
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
                                <span className="badge badge-warn">Past due</span>
                              ) : (
                                <span className="badge badge-mute">Projected</span>
                              )}
                            </td>
                            <td className="px-2 py-3 text-center">
                              {entry.recurringTransactionId && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={(e) => handleInstantReconcile(entry, e)}
                                    className="btn-pos w-8 h-8 rounded-md p-0 inline-flex items-center justify-center font-bold text-lg"
                                    title="Quick reconcile with estimated amount"
                                    aria-label={`Reconcile ${entry.description} at estimated amount`}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openReconcileModal(entry);
                                    }}
                                    className="btn btn-ghost text-xs px-2 py-1 h-8"
                                    aria-label={`Adjust ${entry.description}`}
                                  >
                                    Adjust
                                  </button>
                                </div>
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
                    className="btn btn-primary"
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
                      case 'yearly': return amount / 12;
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
                      <div className="card p-4">
                        <div className="col-head mb-2">
                          Monthly Deposits
                        </div>
                        <div className="stat text-2xl text-pos">
                          {formatCurrency(monthlyDeposits)}
                        </div>
                        <div className="text-xs text-ink-mute mt-1">
                          Estimated per month
                        </div>
                      </div>
                      <div className="card p-4">
                        <div className="col-head mb-2">
                          Monthly Expenses
                        </div>
                        <div className="stat text-2xl text-neg">
                          {formatCurrency(monthlyExpenses)}
                        </div>
                        <div className="text-xs text-ink-mute mt-1">
                          Estimated per month
                        </div>
                      </div>
                      <div className="card p-4">
                        <div className="col-head mb-2">
                          Net Cash Flow
                        </div>
                        <div className={`stat text-2xl ${
                          netCashFlow >= 0 ? 'text-accent' : 'text-warn'
                        }`}>
                          {netCashFlow >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netCashFlow))}
                        </div>
                        <div className="text-xs text-ink-mute mt-1">
                          {netCashFlow >= 0 ? 'Surplus per month' : 'Deficit per month'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {showRecurringForm && (
                  <div className="bg-surface-2 p-4 rounded-md mb-4">
                    <form onSubmit={handleCreateRecurring} className="space-y-4">
                      <div>
                        <label className="label">
                          Description
                        </label>
                        <input
                          type="text"
                          required
                          value={recurringForm.description}
                          onChange={(e) =>
                            setRecurringForm({ ...recurringForm, description: e.target.value })
                          }
                          className="field"
                          placeholder="e.g., Electric Bill"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">
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
                            className="num field"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="label">
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
                            className="field"
                          >
                            <option value="expense">Expense</option>
                            <option value="deposit">Deposit</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label">
                          Frequency
                        </label>
                        <select
                          value={recurringForm.frequency}
                          onChange={(e) =>
                            setRecurringForm({
                              ...recurringForm,
                              frequency: e.target.value as 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly',
                            })
                          }
                          className="field"
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
                          <label className="label">
                            Start Date
                          </label>
                          <input
                            type="date"
                            required
                            value={recurringForm.startDate}
                            onChange={(e) =>
                              setRecurringForm({ ...recurringForm, startDate: e.target.value })
                            }
                            className="field"
                          />
                        </div>
                        <div>
                          <label className="label">
                            End Date (optional)
                          </label>
                          <input
                            type="date"
                            value={recurringForm.endDate}
                            onChange={(e) =>
                              setRecurringForm({ ...recurringForm, endDate: e.target.value })
                            }
                            className="field"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary w-full"
                      >
                        Create Recurring Transaction
                      </button>
                    </form>
                  </div>
                )}

                {recurring.length === 0 ? (
                  <div className="text-center py-8 text-ink-soft font-medium">
                    No recurring transactions yet. Add one to get started!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recurring.map((item) => (
                      <div key={item.id} className="card p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-ink">{item.description}</h4>
                            <div className="mt-2 space-y-1 text-sm text-ink-soft font-medium">
                              <div>
                                Amount:{' '}
                                <span className={`num font-semibold ${
                                  item.type === 'deposit' ? 'text-pos' : 'text-neg'
                                }`}>
                                  {item.type === 'deposit' ? '+' : '−'}
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                              <div>Frequency: <span className="capitalize">{item.frequency}</span></div>
                              <div>Start: <span className="num">{formatDate(item.startDate)}</span></div>
                              {item.endDate && <div>End: <span className="num">{formatDate(item.endDate)}</span></div>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditRecurringModal(item)}
                              className="text-accent text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => requestDeleteRecurring(item.id, item.description)}
                              className="btn-danger-quiet"
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
                    className="btn btn-primary"
                  >
                    {showTransactionForm ? 'Cancel' : 'Record a Transaction'}
                  </button>
                </div>

                {showTransactionForm && (
                  <div className="bg-surface-2 p-4 rounded-md mb-4">
                    <form onSubmit={handleCreateTransaction} className="space-y-4">
                      <div>
                        <label className="label">
                          Description
                        </label>
                        <input
                          type="text"
                          required
                          value={transactionForm.description}
                          onChange={(e) =>
                            setTransactionForm({ ...transactionForm, description: e.target.value })
                          }
                          className="field"
                          placeholder="e.g., Emergency Car Repair"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">
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
                            className="num field"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="label">
                            Type
                          </label>
                          <select
                            value={transactionForm.type}
                            onChange={(e) =>
                              setTransactionForm({
                                ...transactionForm,
                                type: e.target.value as 'deposit' | 'expense' | 'adjustment',
                              })
                            }
                            className="field"
                          >
                            <option value="expense">Expense</option>
                            <option value="deposit">Deposit</option>
                            <option value="adjustment">Balance Adjustment</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label">
                          Date
                        </label>
                        <input
                          type="date"
                          required
                          value={transactionForm.date}
                          onChange={(e) =>
                            setTransactionForm({ ...transactionForm, date: e.target.value })
                          }
                          className="field"
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary w-full"
                      >
                        Add Transaction
                      </button>
                    </form>
                  </div>
                )}

                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-ink-soft font-medium">
                    No transactions yet. Record one to get started!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((txn) => (
                      <div key={txn.id} className="card p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-ink">{txn.description}</h4>
                            <div className="mt-2 space-y-1 text-sm text-ink-soft font-medium">
                              <div>
                                Amount:{' '}
                                <span className={`num font-semibold ${
                                  txn.type === 'deposit' ? 'text-pos' : 'text-neg'
                                }`}>
                                  {txn.type === 'deposit' ? '+' : '−'}
                                  {formatCurrency(txn.amount)}
                                </span>
                              </div>
                              <div>Date: <span className="num">{formatDate(txn.date)}</span></div>
                              <div>Type: <span className="capitalize">{txn.type}</span></div>
                              {txn.reconciledDate && (
                                <div>Reconciled: <span className="num">{formatDate(txn.reconciledDate)}</span></div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => requestDeleteTransaction(txn.id, txn.description)}
                            className="btn-danger-quiet"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeReconcileModal}
        >
          <div
            className="card shadow-xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm actual amount"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-ink mb-4">Confirm actual amount</h3>

            <div className="mb-4 p-4 bg-surface-2 rounded-md">
              <div className="text-sm text-ink-soft font-medium mb-1">
                {reconcileModal.entry.description}
              </div>
              <div className="text-xs text-ink-mute">
                {formatDate(reconcileModal.entry.date)}
              </div>
              <div className={`num text-lg font-semibold mt-2 ${
                reconcileModal.entry.type === 'deposit' ? 'text-pos' : 'text-neg'
              }`}>
                Estimated: {reconcileModal.entry.type === 'deposit' ? '+' : '−'}
                {formatCurrency(reconcileModal.entry.amount)}
              </div>
            </div>

            <div className="space-y-4">
              {/* Edit Amount Section */}
              <div>
                <label className="label">
                  Actual amount
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
                  className="num field text-lg font-semibold"
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
                  className="mt-1 h-5 w-5 accent-accent border-line-strong rounded cursor-pointer"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">
                    Also update future occurrences
                  </div>
                  <div className="text-xs text-ink-mute">
                    Use this amount for all future projected transactions
                  </div>
                </div>
              </label>

              {/* Primary: Confirm */}
              <button
                onClick={handleReconcileWithEdit}
                className="btn btn-primary w-full"
              >
                Confirm
              </button>

              {/* Secondary: Save estimate only */}
              <div>
                <button
                  onClick={handleUpdateAmountOnly}
                  className="btn btn-ghost w-full"
                >
                  Save estimate only
                </button>
                <p className="text-ink-mute text-xs mt-1 text-center">
                  Updates the forecast without recording it as done.
                </p>
              </div>

              {/* Cancel Button */}
              <button
                onClick={closeReconcileModal}
                className="btn btn-ghost w-full"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeBalanceAdjustModal}
        >
          <div
            className="card shadow-xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Adjust current balance"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-ink mb-4">Adjust Current Balance</h3>

            <div className="mb-4 p-4 bg-surface-2 rounded-md">
              <div className="col-head mb-2">
                Current Balance
              </div>
              <div className="stat text-2xl text-ink">
                {formatCurrency(balanceAdjustModal.currentBalance)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">
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
                  className="num field text-xl font-semibold"
                  autoFocus
                />
              </div>

              {(() => {
                const newBalance = parseFloat(balanceAdjustModal.newBalance);
                if (!isNaN(newBalance) && newBalance !== balanceAdjustModal.currentBalance) {
                  const difference = newBalance - balanceAdjustModal.currentBalance;
                  return (
                    <div className={`p-3 rounded-md border border-line ${
                      difference > 0 ? 'bg-pos-soft' : 'bg-neg-soft'
                    }`}>
                      <div className="text-sm text-ink-soft font-medium">
                        Adjustment will be:
                      </div>
                      <div className={`num text-lg font-bold ${
                        difference > 0 ? 'text-pos' : 'text-neg'
                      }`}>
                        {difference > 0 ? '+' : '−'}{formatCurrency(Math.abs(difference))}
                      </div>
                      <div className="text-xs text-ink-mute mt-1">
                        A reconciled adjustment transaction will be created
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <button
                onClick={handleBalanceAdjust}
                className="btn btn-primary w-full"
              >
                Adjust Balance
              </button>

              <button
                onClick={closeBalanceAdjustModal}
                className="btn btn-ghost w-full"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeEditRecurringModal}
        >
          <div
            className="card shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Edit recurring transaction"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-ink mb-4">Edit Recurring Transaction</h3>

            {/* Impact explanation */}
            <div className="mb-6 p-4 bg-accent-soft border border-line rounded-md">
              <h4 className="font-semibold text-ink mb-2">
                How will this edit affect my projections?
              </h4>
              <div className="space-y-2 text-sm text-ink-soft">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 rounded-full bg-pos shrink-0" />
                  <div>
                    <span className="font-semibold text-pos">Unchanged —</span> Past reconciled transactions
                    will NOT be changed. These are locked in as actual transactions.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 rounded-full bg-warn shrink-0" />
                  <div>
                    <span className="font-semibold text-warn">Updated —</span> Past unreconciled projections
                    will be updated with the new values from this edit.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 rounded-full bg-accent shrink-0" />
                  <div>
                    <span className="font-semibold text-accent">Recalculated —</span> Future projections
                    will be recalculated with the new values from this edit.
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateRecurring} className="space-y-4">
              <div>
                <label className="label">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={editRecurringForm.description}
                  onChange={(e) =>
                    setEditRecurringForm({ ...editRecurringForm, description: e.target.value })
                  }
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
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
                    className="num field"
                  />
                </div>
                <div>
                  <label className="label">
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
                    className="field"
                  >
                    <option value="expense">Expense</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">
                  Frequency
                </label>
                <select
                  value={editRecurringForm.frequency}
                  onChange={(e) =>
                    setEditRecurringForm({
                      ...editRecurringForm,
                      frequency: e.target.value as 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly',
                    })
                  }
                  className="field"
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
                  <label className="label">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editRecurringForm.startDate}
                    onChange={(e) =>
                      setEditRecurringForm({ ...editRecurringForm, startDate: e.target.value })
                    }
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={editRecurringForm.endDate}
                    onChange={(e) =>
                      setEditRecurringForm({ ...editRecurringForm, endDate: e.target.value })
                    }
                    className="field"
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
                    className="h-5 w-5 accent-accent border-line-strong rounded cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-ink">Active</span>
                </label>
                <p className="text-xs text-ink-mute mt-1 ml-7">
                  Inactive recurring transactions won&apos;t appear in future projections
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={closeEditRecurringModal}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            aria-label={`Confirm delete ${deleteConfirm.kind === 'recurring' ? 'recurring transaction' : 'transaction'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink mb-2">
              {deleteConfirm.kind === 'recurring' ? 'Delete recurring transaction?' : 'Delete transaction?'}
            </h3>
            <p className="text-sm text-ink-soft mb-6">
              This will permanently delete &ldquo;{deleteConfirm.label}&rdquo;. This can&apos;t be undone.
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
