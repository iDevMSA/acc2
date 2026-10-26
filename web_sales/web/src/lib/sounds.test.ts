import { soundOfWrite } from './sounds';

describe('soundOfWrite', () => {
  it('treats new records and field edits as success', () => {
    expect(soundOfWrite({ 'accounts/12': { name: 'x' } })).toBe('success');
    expect(soundOfWrite({ 'accounts/12/name': 'x', 'accounts/12/phone': '' })).toBe('success');
    expect(soundOfWrite({ 'erp/accountMeta/12/frozen': null })).toBe('success');
    expect(soundOfWrite({ 'erp/settings/shortcuts': null })).toBe('success');
  });

  it('treats record removal and soft delete as delete', () => {
    expect(soundOfWrite({ 'accounts/12': null, 'clientOps/12': null, 'erp/accountMeta/12': null })).toBe('delete');
    expect(soundOfWrite({ 'operations/a/deletedAt': 'now', 'operations/a/updatedByUid': 'u' })).toBe('delete');
    expect(soundOfWrite({ 'products/p1': null, 'productMeta/p1': null })).toBe('delete');
  });

  it('treats replacing entries (remove old + add new) as success', () => {
    expect(soundOfWrite({ 'operations/a/deletedAt': 'now', 'operations/b': { amount: 1 } })).toBe('success');
  });
});
