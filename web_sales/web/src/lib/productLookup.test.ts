import { arabicProductName, quantityAr } from './productLookup';

test('sizes are written in Arabic units', () => {
  expect(quantityAr('330 ml')).toBe('330 مل');
  expect(quantityAr('1,5 L')).toBe('1.5 لتر');
  expect(quantityAr('500g')).toBe('500 غ');
  expect(quantityAr('1 kg')).toBe('1 كغ');
  expect(quantityAr('6 x 250 ml')).toBe('6 × 250 مل');
  expect(quantityAr('')).toBe('');
});

test('Arabic name gets the size appended once', async () => {
  expect(await arabicProductName({ name: 'Coca-Cola', nameAr: 'كوكا كولا', quantity: '330 ml' })).toBe('كوكا كولا 330 مل');
  expect(await arabicProductName({ name: 'x', nameAr: 'مياه 330 مل', quantity: '330 ml' })).toBe('مياه 330 مل');
});
