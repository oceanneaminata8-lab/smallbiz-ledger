import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { DatabaseService } from '../services/database.service';
import {
  Transaction,
  CATEGORIES,
  RecurrenceType,
  RECURRENCE_OPTIONS,
  RecurringTransaction,
} from '../models/transaction.model';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
  ]
})
export class HomePage implements OnInit {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  
  newTransaction: any = {
    type: 'expense',
    amount: 0,
    date: new Date().toISOString(),
    description: '',
    category: 'Utility',
    recurrence: 'none' as RecurrenceType,
  };
  
  startDate: string = '';
  endDate: string = '';
  isLoading = true;
  dbReady = false;
  editingTransaction: Transaction | null = null;
  categories = CATEGORIES;
  searchText = '';
  selectedPeriod = 'all';
  datePresets = [
    { label: 'All', value: 'all' },
    { label: '7 Days', value: '7' },
    { label: '30 Days', value: '30' },
    { label: 'This Month', value: 'month' },
  ];
  recurrenceOptions = RECURRENCE_OPTIONS;
  upcomingRecurring: RecurringTransaction[] = [];
  categoryTotals: { category: string; total: number }[] = [];
  monthlyTotals: { month: string; income: number; expense: number }[] = [];
  darkMode = false;
  totalIncome = 0;
  totalExpense = 0;
  netBalance = 0;

  constructor(
    private dbService: DatabaseService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.darkMode = localStorage.getItem('ledgerDarkMode') === 'true';
    document.body.classList.toggle('dark-theme', this.darkMode);

    await this.dbService.initializeDatabase();
    this.dbReady = true;
    await this.loadRecurringSchedules();
    await this.loadTransactions();
  }

  async loadTransactions() {
    try {
      this.isLoading = true;
      this.transactions = await this.dbService.getAllTransactions();
      await this.applyFilter();
    } catch (error) {
      this.showToast('Error loading transactions', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async applyFilter() {
    let results: Transaction[] = [];

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate).getTime();
      const end = new Date(this.endDate).setHours(23, 59, 59, 999);
      results = await this.dbService.getTransactionsByDateRange(start, end);
    } else {
      results = [...this.transactions];
    }

    if (this.searchText?.trim()) {
      const query = this.searchText.trim().toLowerCase();
      results = results.filter(
        t =>
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }

    this.filteredTransactions = results;
    this.calculateSummary();
  }

  calculateSummary() {
    this.totalIncome = this.filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    this.totalExpense = this.filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    this.netBalance = this.totalIncome - this.totalExpense;
    this.calculateCategoryTotals();
    this.calculateMonthlyTotals();
  }

  calculateCategoryTotals() {
    const totals = this.filteredTransactions.reduce((acc, t) => {
      const mappedAmount = t.type === 'expense' ? -t.amount : t.amount;
      acc[t.category] = (acc[t.category] || 0) + mappedAmount;
      return acc;
    }, {} as Record<string, number>);

    this.categoryTotals = Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 5);
  }

  calculateMonthlyTotals() {
    const now = new Date();
    const months = [] as { month: string; income: number; expense: number }[];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = monthDate.toLocaleString('en-US', { month: 'short' });
      months.push({ month: monthLabel, income: 0, expense: 0 });
    }

    this.filteredTransactions.forEach(transaction => {
      const txDate = new Date(transaction.date);
      const monthLabel = txDate.toLocaleString('en-US', { month: 'short' });
      const entry = months.find(m => m.month === monthLabel);
      if (entry) {
        if (transaction.type === 'income') {
          entry.income += transaction.amount;
        } else {
          entry.expense += transaction.amount;
        }
      }
    });

    this.monthlyTotals = months;
  }

  getMonthlyMax(): number {
    const values = this.monthlyTotals.reduce((acc, item) => {
      acc.push(item.income, item.expense);
      return acc;
    }, [] as number[]);
    return Math.max(...values, 1);
  }

  getCategoryMax(): number {
    const values = this.categoryTotals.map(item => Math.abs(item.total));
    return Math.max(...values, 1);
  }

  getBarPercent(value: number, max: number): number {
    const normalized = (Math.abs(value) / Math.max(max, 1)) * 100;
    return Math.max(4, Math.min(100, normalized));
  }

  async loadRecurringSchedules() {
    try {
      this.upcomingRecurring = await this.dbService.getAllRecurringTransactions();
    } catch (error) {
      console.error('Error loading recurring schedules:', error);
    }
  }

  getNextRecurringDate(currentDate: number, recurrence: RecurrenceType): number {
    const date = new Date(currentDate);
    if (recurrence === 'daily') {
      date.setDate(date.getDate() + 1);
    } else if (recurrence === 'weekly') {
      date.setDate(date.getDate() + 7);
    } else if (recurrence === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    }
    return date.getTime();
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark-theme', this.darkMode);
    localStorage.setItem('ledgerDarkMode', String(this.darkMode));
  }

  async applyDatePreset(preset: string) {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (preset === '7') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      end = now;
    } else if (preset === '30') {
      start = new Date(now);
      start.setDate(now.getDate() - 29);
      end = now;
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (preset === 'all') {
      this.startDate = '';
      this.endDate = '';
    } else if (start && end) {
      this.startDate = start.toISOString().split('T')[0];
      this.endDate = end.toISOString().split('T')[0];
    }

    this.selectedPeriod = preset;
    await this.applyFilter();
  }

  async resetFilters() {
    this.startDate = '';
    this.endDate = '';
    this.searchText = '';
    this.selectedPeriod = 'all';
    await this.applyFilter();
  }

  getAbsolute(value: number): number {
    return Math.abs(value);
  }

  async addTransaction() {
    if (!this.dbReady) {
      this.showToast('Please wait while the database initializes', 'warning');
      await this.dbService.initializeDatabase();
      this.dbReady = true;
    }

    if (!this.newTransaction.description?.trim()) {
      this.showToast('Please enter a description', 'warning');
      return;
    }

    const amount = Number(this.newTransaction.amount);
    if (isNaN(amount) || amount <= 0) {
      this.showToast('Amount must be a number greater than 0', 'warning');
      return;
    }

    const dateValue = new Date(this.newTransaction.date).getTime();
    if (isNaN(dateValue)) {
      this.showToast('Please select a valid date', 'warning');
      return;
    }

    try {
      const transaction = {
        type: this.newTransaction.type,
        amount,
        date: dateValue,
        description: this.newTransaction.description,
        category: this.newTransaction.category,
      };
      console.log('Adding transaction', transaction);
      await this.dbService.addTransaction(transaction);

      if (this.newTransaction.recurrence && this.newTransaction.recurrence !== 'none') {
        const recurrenceValue = this.newTransaction.recurrence as RecurrenceType;
        const recurringSchedule = {
          type: this.newTransaction.type,
          amount: this.newTransaction.amount,
          startDate: transaction.date,
          nextDate: this.getNextRecurringDate(transaction.date, recurrenceValue),
          description: this.newTransaction.description,
          category: this.newTransaction.category,
          recurrence: recurrenceValue,
        };

        await this.dbService.addRecurringTransaction(recurringSchedule);
        this.showToast('Recurring transaction schedule created successfully', 'success');
      }

      this.newTransaction = {
        type: 'expense',
        amount: 0,
        date: new Date().toISOString(),
        description: '',
        category: 'Utility',
        recurrence: 'none',
      };
      await this.loadTransactions();
      await this.loadRecurringSchedules();
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      this.showToast(`Error adding transaction: ${error?.message ?? 'Unknown error'}`, 'danger');
    }
  }

  async updateTransaction() {
    if (!this.editingTransaction) return;
    
    try {
      await this.dbService.updateTransaction(this.editingTransaction);
      this.showToast('Transaction updated successfully', 'success');
      this.editingTransaction = null;
      await this.loadTransactions();
    } catch (error) {
      this.showToast('Error updating transaction', 'danger');
    }
  }

  async deleteTransaction(id: number) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this transaction?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.dbService.deleteTransaction(id);
              this.showToast('Transaction deleted', 'success');
              await this.loadTransactions();
            } catch (error) {
              this.showToast('Error deleting transaction', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteRecurringSchedule(id: number) {
    try {
      await this.dbService.deleteRecurringTransaction(id);
      this.showToast('Recurring schedule removed', 'success');
      await this.loadRecurringSchedules();
    } catch (error) {
      this.showToast('Error removing recurring schedule', 'danger');
    }
  }

  async exportToExcel() {
    let transactionsToExport: Transaction[] = [];

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate).getTime();
      const end = new Date(this.endDate).setHours(23, 59, 59, 999);

      if (start > end) {
        this.showToast('Start Date cannot be greater than End Date', 'danger');
        return;
      }

      transactionsToExport = await this.dbService.getTransactionsByDateRange(start, end);
    } else {
      transactionsToExport = await this.dbService.getAllTransactions();
    }

    if (this.searchText?.trim()) {
      const query = this.searchText.trim().toLowerCase();
      transactionsToExport = transactionsToExport.filter(
        t =>
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }

    if (transactionsToExport.length === 0) {
      this.showToast('No transactions to export in this date range', 'warning');
      return;
    }

    try {
      const rows = [
        ['ID', 'Type', 'Amount', 'Date', 'Description', 'Category'],
      ];

      const dataRows = transactionsToExport.map(t => [
        t.id,
        t.type,
        t.amount,
        new Date(t.date).toISOString().split('T')[0],
        t.description,
        t.category,
      ]);

      const ws = XLSX.utils.aoa_to_sheet([...rows, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      (ws as any)['!cols'] = [
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 30 },
        { wch: 14 },
      ];

      const fileName = `transactions_${this.startDate || 'all'}_to_${this.endDate || 'all'}.xlsx`;
      const workbookBlob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
        type: 'application/octet-stream',
      });
      const fileURL = URL.createObjectURL(workbookBlob);
      const anchor = document.createElement('a');
      anchor.href = fileURL;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(fileURL);

      this.showToast(`Exported ${transactionsToExport.length} transactions successfully`, 'success');
    } catch (error) {
      console.error('Error exporting:', error);
      this.showToast('Error exporting to Excel', 'danger');
    }
  }

  editTransaction(transaction: Transaction) {
    this.editingTransaction = { ...transaction };
  }

  cancelEdit() {
    this.editingTransaction = null;
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US');
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  async onDateRangeChange() {
    await this.applyFilter();
  }
}