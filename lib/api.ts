// API client for communicating with the backend

const API_BASE = '/api';

export interface Account {
  id: number;
  name: string;
  startingBalance: number;
  currentBalance: number;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: number;
  description: string;
  amount: number;
  type: 'deposit' | 'expense';
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string | null;
  active: boolean;
  accountId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: 'deposit' | 'expense' | 'adjustment';
  date: string;
  reconciled: boolean;
  reconciledDate: string | null;
  accountId: number;
  recurringTransactionId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionEntry {
  date: string;
  description: string;
  amount: number;
  type: 'deposit' | 'expense' | 'adjustment';
  balance: number;
  isReconciled: boolean;
  recurringTransactionId?: number;
  transactionId?: number;
}

export interface Projection {
  account: Account;
  projection: ProjectionEntry[];
}

// Account APIs
export async function getAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_BASE}/accounts`);
  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
}

export async function getAccount(id: number): Promise<Account> {
  const response = await fetch(`${API_BASE}/accounts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch account');
  return response.json();
}

export async function createAccount(data: {
  name: string;
  startingBalance: number;
  startDate: string;
}): Promise<Account> {
  const response = await fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create account');
  return response.json();
}

export async function updateAccount(
  id: number,
  data: Partial<Account>
): Promise<Account> {
  const response = await fetch(`${API_BASE}/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update account');
  return response.json();
}

export async function deleteAccount(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/accounts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete account');
}

// Recurring Transaction APIs
export async function getRecurringTransactions(
  accountId?: number
): Promise<RecurringTransaction[]> {
  const url = accountId
    ? `${API_BASE}/recurring-transactions?accountId=${accountId}`
    : `${API_BASE}/recurring-transactions`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch recurring transactions');
  return response.json();
}

export async function createRecurringTransaction(data: {
  accountId: number;
  description: string;
  amount: number;
  type: 'deposit' | 'expense';
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string | null;
  active?: boolean;
}): Promise<RecurringTransaction> {
  const response = await fetch(`${API_BASE}/recurring-transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create recurring transaction');
  return response.json();
}

export async function updateRecurringTransaction(
  id: number,
  data: Partial<RecurringTransaction>
): Promise<RecurringTransaction> {
  const response = await fetch(`${API_BASE}/recurring-transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update recurring transaction');
  return response.json();
}

export async function deleteRecurringTransaction(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/recurring-transactions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete recurring transaction');
}

// Transaction APIs
export async function getTransactions(
  accountId?: number,
  reconciled?: boolean
): Promise<Transaction[]> {
  let url = `${API_BASE}/transactions`;
  const params = new URLSearchParams();
  if (accountId !== undefined) params.append('accountId', accountId.toString());
  if (reconciled !== undefined) params.append('reconciled', reconciled.toString());
  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
}

export async function createTransaction(data: {
  accountId: number;
  description: string;
  amount: number;
  type: 'deposit' | 'expense' | 'adjustment';
  date: string;
  reconciled?: boolean;
  recurringTransactionId?: number | null;
}): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create transaction');
  return response.json();
}

export async function reconcileTransaction(data: {
  recurringTransactionId: number;
  date: string;
  amount?: number;
  updateRecurringAmount?: boolean;
}): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/transactions/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to reconcile transaction');
  return response.json();
}

export async function updateTransaction(
  id: number,
  data: Partial<Transaction>
): Promise<Transaction> {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update transaction');
  return response.json();
}

export async function deleteTransaction(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete transaction');
}

// Projection APIs
export async function getProjection(
  accountId: number,
  months = 12
): Promise<Projection> {
  const response = await fetch(
    `${API_BASE}/projections/${accountId}?months=${months}`
  );
  if (!response.ok) throw new Error('Failed to fetch projection');
  return response.json();
}
