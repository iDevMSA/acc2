import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Taxes from './Taxes';

// react-router-dom v7 لا يُحمَّل في Jest 27 (exports)، والصفحة تحتاج Link فقط
jest.mock('react-router-dom', () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/database', () => ({
  ref: () => ({}),
  onValue: (_r: unknown, cb: (s: { val: () => unknown }) => void) => {
    cb({ val: () => null });
    return () => {};
  },
}));
// قيمة ثابتة مثل السياق الحقيقي، وإلا يتكرر الاشتراك مع كل رسم
const mockApp = { user: { uid: 'u1' }, currency: 'SAR' };
jest.mock('../context/AppContext', () => ({
  useApp: () => mockApp,
}));
const mockLedger = { invoices: [], notes: [], accountsById: {}, roleOf: () => 'general', mainCurrency: 'SAR', company: { name: '' } };
jest.mock('../context/LedgerContext', () => ({
  useLedger: () => mockLedger,
}));
jest.mock('../lib/salesInvoices', () => ({
  useSalesInvoices: () => ({ invoices: [], loading: false }),
}));
const mockSave = jest.fn();
jest.mock('../hooks/useTaxSettings', () => ({
  useTaxSettings: () => ({ settings: null, loading: false, save: mockSave }),
}));

test('account can edit and save its own tax values', () => {
  render(<Taxes />);
  // الدولة الافتراضية من عملة الحساب
  expect((screen.getByDisplayValue('15') as HTMLInputElement).value).toBe('15');

  fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '12' } });
  fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '5, 0' } });
  fireEvent.change(screen.getByPlaceholderText('15 رقماً يبدأ وينتهي بـ 3'), {
    target: { value: '300000000000003' },
  });
  fireEvent.click(screen.getByText('حفظ'));

  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({ countryCode: 'SA', standardRate: 12, reducedRates: [5, 0], hasVat: true }),
  );

  fireEvent.click(screen.getByText('استعادة قيم الدولة الافتراضية'));
  expect(screen.getByDisplayValue('15')).toBeTruthy();
});
