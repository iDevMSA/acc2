// حسابات القوائم المالية من قيود السجل العام — مشتركة بين صفحتي المحاسبة والتقارير.

export interface TrialBalanceItem {
  account: string;
  debit: number;
  credit: number;
}

export const calculateTrialBalance = (journal: any[]): TrialBalanceItem[] => {
  if (journal.length === 0) return [];

  const balances: { [key: string]: { debit: number; credit: number } } = {};

  journal.forEach((entry) => {
    const accountName = entry.account || 'حساب عام';
    if (!balances[accountName]) {
      balances[accountName] = { debit: 0, credit: 0 };
    }
    if (entry.debit) balances[accountName].debit += entry.debit;
    if (entry.credit) balances[accountName].credit += entry.credit;
  });

  return Object.entries(balances).map(([account, amounts]) => ({
    account,
    debit: amounts.debit,
    credit: amounts.credit,
  }));
};

export const calculateIncomeStatement = (journal: any[]) => {
  const revenueAccounts = journal.filter((e) => e.type === 'Revenue' || e.statement?.includes('إيراد'));
  const expenseAccounts = journal.filter((e) => e.type === 'Expense' || e.statement?.includes('مصروف'));

  const revenue = revenueAccounts.reduce((sum, e) => sum + (e.credit || 0), 0);
  const expenses = expenseAccounts.reduce((sum, e) => sum + (e.debit || 0), 0);

  return {
    revenue,
    expenses,
    grossProfit: revenue - expenses,
    profit: revenue - expenses,
    margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
  };
};

export const calculateBalanceSheet = (journal: any[]) => {
  const assets = journal.filter((e) => e.type === 'Asset' || e.statement?.includes('أصل'));
  const liabilities = journal.filter((e) => e.type === 'Liability' || e.statement?.includes('خصم'));
  const equity = journal.filter((e) => e.type === 'Equity' || e.statement?.includes('حقوق'));

  const totalAssets = assets.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, e) => sum + (e.credit || 0), 0);
  const totalEquity = equity.reduce((sum, e) => sum + (e.credit || 0), 0);

  return {
    assets: totalAssets,
    liabilities: totalLiabilities,
    equity: totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
};
