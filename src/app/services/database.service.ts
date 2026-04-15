import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { Transaction, RecurringTransaction } from '../models/transaction.model';
import { IndexedDBService } from './indexeddb.service';

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;
  private useIndexedDB = false;
  private indexedDBService: IndexedDBService;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.indexedDBService = new IndexedDBService();
    this.useIndexedDB = Capacitor.getPlatform() === 'web';
  }

  async initializeDatabase(force: boolean = false): Promise<void> {
    if (this.isInitialized && !force) return;

    try {
      console.log('Platform:', Capacitor.getPlatform());
      console.log('Using IndexedDB:', this.useIndexedDB);

      if (this.useIndexedDB) {
        // Use IndexedDB for web
        await this.indexedDBService.initializeDatabase();
      } else {
        // Use SQLite for mobile
        if (Capacitor.getPlatform() === 'web') {
          console.log('Initializing web store...');
          try {
            await this.sqlite.initWebStore();
            await this.sqlite.checkConnectionsConsistency();
            console.log('Web store initialized');
          } catch (webError) {
            console.error('Web store initialization failed:', webError);
            // Don't throw, try to continue without web store
          }
        }

        // Create or open database
        console.log('Creating database connection...');
        this.db = await this.sqlite.createConnection(
          'smallbiz_ledger',
          false,
          'no-encryption',
          1,
          false
        );

        console.log('Opening database...');
        await this.db.open();
        
        console.log('Creating tables...');
        await this.createTables();
        
        console.log('Generating recurring transactions...');
        await this.generateRecurringTransactions();
      }
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error: any) {
      console.error('Error initializing database:', error);
      this.isInitialized = false;
      throw new Error(`Database initialization failed: ${error.message || 'Unknown error'}`);
    }
  }

  private async createTables(): Promise<void> {
    const transactionQuery = `
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        date INTEGER NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL
      );
    `;

    const recurringQuery = `
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        start_date INTEGER NOT NULL,
        next_date INTEGER NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        recurrence TEXT NOT NULL
      );
    `;

    await this.db?.execute(transactionQuery);
    await this.db?.execute(recurringQuery);
    console.log('Tables created/verified');
  }

  // INSERT transaction
  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<number> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.addTransaction(transaction);
    }
    
    const query = `
      INSERT INTO transactions (type, amount, date, description, category)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [
      transaction.type,
      transaction.amount,
      transaction.date,
      transaction.description,
      transaction.category,
    ];

    try {
      const result = await this.db!.run(query, values);
      console.log('Transaction added:', result);
      return result.changes?.lastId || 0;
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }

  // SELECT all transactions
  async getAllTransactions(): Promise<Transaction[]> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.getAllTransactions();
    }
    
    const query = 'SELECT * FROM transactions ORDER BY date DESC';
    
    try {
      const result = await this.db!.query(query);
      return (result.values as Transaction[]) || [];
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  // SELECT by date range (BETWEEN query)
  async getTransactionsByDateRange(startDate: number, endDate: number): Promise<Transaction[]> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.getTransactionsByDateRange(startDate, endDate);
    }
    
    const query = `
      SELECT * FROM transactions 
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC
    `;
    
    try {
      const result = await this.db!.query(query, [startDate, endDate]);
      return (result.values as Transaction[]) || [];
    } catch (error) {
      console.error('Error filtering transactions:', error);
      throw error;
    }
  }

  async addRecurringTransaction(recurring: Omit<RecurringTransaction, 'id'>): Promise<number> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.addRecurringTransaction(recurring);
    }
    
    const query = `
      INSERT INTO recurring_transactions (type, amount, start_date, next_date, description, category, recurrence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      recurring.type,
      recurring.amount,
      recurring.startDate,
      recurring.nextDate,
      recurring.description,
      recurring.category,
      recurring.recurrence,
    ];

    try {
      const result = await this.db!.run(query, values);
      console.log('Recurring schedule added:', result);
      return result.changes?.lastId || 0;
    } catch (error) {
      console.error('Error adding recurring transaction:', error);
      throw error;
    }
  }

  async getAllRecurringTransactions(): Promise<RecurringTransaction[]> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.getAllRecurringTransactions();
    }
    
    const query = 'SELECT * FROM recurring_transactions ORDER BY next_date ASC';

    try {
      const result = await this.db!.query(query);
      return (result.values as RecurringTransaction[]) || [];
    } catch (error) {
      console.error('Error getting recurring transactions:', error);
      throw error;
    }
  }

  async deleteRecurringTransaction(id: number): Promise<void> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.deleteRecurringTransaction(id);
    }
    
    const query = 'DELETE FROM recurring_transactions WHERE id = ?';

    try {
      await this.db!.run(query, [id]);
      console.log('Recurring schedule deleted:', id);
    } catch (error) {
      console.error('Error deleting recurring transaction:', error);
      throw error;
    }
  }

  async generateRecurringTransactions(): Promise<void> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.generateRecurringTransactions();
    }
    
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
        const query = `
          UPDATE recurring_transactions
          SET next_date = ?
          WHERE id = ?
        `;
        await this.db!.run(query, [nextDate, item.id]);
        console.log('Recurring next date updated for', item.id, nextDate);
      }
    }
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

  // DELETE transaction
  async deleteTransaction(id: number): Promise<void> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.deleteTransaction(id);
    }
    
    const query = 'DELETE FROM transactions WHERE id = ?';
    
    try {
      await this.db!.run(query, [id]);
      console.log('Transaction deleted:', id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  // UPDATE transaction
  async updateTransaction(transaction: Transaction): Promise<void> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.updateTransaction(transaction);
    }
    
    const query = `
      UPDATE transactions 
      SET type = ?, amount = ?, date = ?, description = ?, category = ?
      WHERE id = ?
    `;
    const values = [
      transaction.type,
      transaction.amount,
      transaction.date,
      transaction.description,
      transaction.category,
      transaction.id,
    ];

    try {
      await this.db!.run(query, values);
      console.log('Transaction updated:', transaction.id);
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  // Get summary statistics
  async getSummary(startDate: number, endDate: number): Promise<any> {
    this.ensureInitialized();
    
    if (this.useIndexedDB) {
      return this.indexedDBService.getSummary(startDate, endDate);
    }
    
    const query = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_balance
      FROM transactions
      WHERE date BETWEEN ? AND ?
    `;
    
    try {
      const result = await this.db!.query(query, [startDate, endDate]);
      const values = result.values as any[];
      return values?.[0] || { total_income: 0, total_expense: 0, net_balance: 0 };
    } catch (error) {
      console.error('Error getting summary:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    if (!this.useIndexedDB && !this.db) {
      throw new Error('SQLite database not initialized.');
    }
  }
}