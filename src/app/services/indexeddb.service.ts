import { Injectable } from '@angular/core';
import { Transaction, RecurringTransaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root',
})
export class IndexedDBService {
  private dbName = 'smallbiz_ledger_idb';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async initializeDatabase(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      console.log('Initializing IndexedDB...');
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('Creating IndexedDB object stores...');

        // Create transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          transactionStore.createIndex('type', 'type', { unique: false });
          transactionStore.createIndex('date', 'date', { unique: false });
          transactionStore.createIndex('category', 'category', { unique: false });
        }

        // Create recurring transactions store
        if (!db.objectStoreNames.contains('recurring_transactions')) {
          const recurringStore = db.createObjectStore('recurring_transactions', { keyPath: 'id', autoIncrement: true });
          recurringStore.createIndex('type', 'type', { unique: false });
          recurringStore.createIndex('nextDate', 'nextDate', { unique: false });
        }
      };
    });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('IndexedDB not initialized. Call initializeDatabase() first.');
    }
  }

  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<number> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const dbTransaction = this.db!.transaction(['transactions'], 'readwrite');
      const store = dbTransaction.objectStore('transactions');
      const request = store.add(transaction);

      request.onsuccess = () => {
        console.log('Transaction added to IndexedDB:', request.result);
        resolve(request.result as number);
      };

      request.onerror = () => {
        console.error('Error adding transaction to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllTransactions(): Promise<Transaction[]> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readonly');
      const store = transaction.objectStore('transactions');
      const request = store.getAll();

      request.onsuccess = () => {
        const transactions = (request.result as Transaction[]).sort((a, b) => b.date - a.date);
        resolve(transactions);
      };

      request.onerror = () => {
        console.error('Error getting transactions from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async getTransactionsByDateRange(startDate: number, endDate: number): Promise<Transaction[]> {
    this.ensureInitialized();
    const allTransactions = await this.getAllTransactions();
    return allTransactions.filter(t => t.date >= startDate && t.date <= endDate);
  }

  async updateTransaction(transactionData: Transaction): Promise<void> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const dbTransaction = this.db!.transaction(['transactions'], 'readwrite');
      const store = dbTransaction.objectStore('transactions');
      const request = store.put(transactionData);

      request.onsuccess = () => {
        console.log('Transaction updated in IndexedDB:', transactionData.id);
        resolve();
      };

      request.onerror = () => {
        console.error('Error updating transaction in IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteTransaction(id: number): Promise<void> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readwrite');
      const store = transaction.objectStore('transactions');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Transaction deleted from IndexedDB:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Error deleting transaction from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async addRecurringTransaction(recurring: Omit<RecurringTransaction, 'id'>): Promise<number> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recurring_transactions'], 'readwrite');
      const store = transaction.objectStore('recurring_transactions');
      const request = store.add(recurring);

      request.onsuccess = () => {
        console.log('Recurring transaction added to IndexedDB:', request.result);
        resolve(request.result as number);
      };

      request.onerror = () => {
        console.error('Error adding recurring transaction to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllRecurringTransactions(): Promise<RecurringTransaction[]> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recurring_transactions'], 'readonly');
      const store = transaction.objectStore('recurring_transactions');
      const request = store.getAll();

      request.onsuccess = () => {
        const recurring = (request.result as RecurringTransaction[]).sort((a, b) => a.nextDate - b.nextDate);
        resolve(recurring);
      };

      request.onerror = () => {
        console.error('Error getting recurring transactions from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteRecurringTransaction(id: number): Promise<void> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['recurring_transactions'], 'readwrite');
      const store = transaction.objectStore('recurring_transactions');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Recurring transaction deleted from IndexedDB:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Error deleting recurring transaction from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async generateRecurringTransactions(): Promise<void> {
    this.ensureInitialized();
    const now = Date.now();
    const recurringItems = await this.getAllRecurringTransactions();

    for (const item of recurringItems) {
      let nextDate = item.nextDate;
      let created = false;

      while (nextDate <= now) {
        const transaction = {
          type: item.type,
          amount: item.amount,
          date: nextDate,
          description: item.description,
          category: item.category,
        };

        await this.addTransaction(transaction);
        created = true;

        nextDate = this.getNextRecurringDate(nextDate, item.recurrence);
      }

      if (created) {
        await this.updateRecurringNextDate(item.id, nextDate);
      }
    }
  }

  private async updateRecurringNextDate(id: number, nextDate: number): Promise<void> {
    this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const dbTransaction = this.db!.transaction(['recurring_transactions'], 'readwrite');
      const store = dbTransaction.objectStore('recurring_transactions');
      
      // First get the existing record
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result as RecurringTransaction;
        if (item) {
          item.nextDate = nextDate;
          const putRequest = store.put(item);
          
          putRequest.onsuccess = () => {
            console.log('Recurring next date updated for', id, nextDate);
            resolve();
          };
          
          putRequest.onerror = () => {
            console.error('Error updating recurring next date:', putRequest.error);
            reject(putRequest.error);
          };
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => {
        console.error('Error getting recurring transaction:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  private getNextRecurringDate(date: number, recurrence: string): number {
    const next = new Date(date);

    if (recurrence === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (recurrence === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (recurrence === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    }

    return next.getTime();
  }

  async getSummary(startDate: number, endDate: number): Promise<any> {
    this.ensureInitialized();
    const allTransactions = await this.getAllTransactions();
    const filteredTransactions = allTransactions.filter(t => t.date >= startDate && t.date <= endDate);

    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netBalance = totalIncome - totalExpense;

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_balance: netBalance,
    };
  }
}
