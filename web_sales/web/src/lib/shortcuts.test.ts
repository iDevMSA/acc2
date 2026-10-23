import {
  SHORTCUT_ACTIONS,
  comboFromEvent,
  comboParts,
  findConflicts,
  navActionId,
  resolveBindings,
  toOverrides,
  validateCombo,
} from './shortcuts';

const ev = (code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('shortcuts', () => {
  it('reads the physical key so Arabic and English layouts match', () => {
    expect(comboFromEvent(ev('KeyK', { ctrlKey: true }))).toBe('Ctrl+K');
    expect(comboFromEvent(ev('Digit3', { altKey: true }))).toBe('Alt+3');
    expect(comboFromEvent(ev('F2', { shiftKey: true }))).toBe('Shift+F2');
    expect(comboFromEvent(ev('Slash', { ctrlKey: true }))).toBe('Ctrl+/');
    expect(comboFromEvent(ev('ControlLeft', { ctrlKey: true }))).toBeNull();
  });

  it('rejects browser-reserved and typing keys', () => {
    expect(validateCombo('Ctrl+W')).toMatch(/محجوز/);
    expect(validateCombo('Ctrl+3')).not.toBeNull();
    expect(validateCombo('K')).not.toBeNull();
    expect(validateCombo('Shift+K')).not.toBeNull();
    expect(validateCombo('Esc')).not.toBeNull();
    expect(validateCombo('F2')).toBeNull();
    expect(validateCombo('Ctrl+Shift+K')).toBeNull();
    expect(validateCombo('Alt+1')).toBeNull();
  });

  it('has valid, conflict-free defaults with ids safe for Firebase keys', () => {
    const defaults = resolveBindings(undefined);
    expect(findConflicts(defaults)).toEqual({});
    SHORTCUT_ACTIONS.forEach((a) => expect(a.id).not.toMatch(/[./#$[\]]/));
    const invalid = SHORTCUT_ACTIONS.filter((a) => a.defaultCombo && validateCombo(a.defaultCombo));
    expect(invalid).toEqual([]);
    expect(new Set(SHORTCUT_ACTIONS.map((a) => a.id)).size).toBe(SHORTCUT_ACTIONS.length);
    expect(navActionId('/pos-admin')).toBe('nav_pos_admin');
  });

  it('stores only overrides and detects conflicts', () => {
    const b = { ...resolveBindings(undefined), newSale: 'Ctrl+K', help: '' };
    expect(toOverrides(b)).toEqual({ newSale: 'Ctrl+K', help: '' });
    expect(findConflicts(b)).toEqual({ 'Ctrl+K': ['palette', 'newSale'] });
    expect(resolveBindings({ help: '' }).help).toBe('');
  });

  it('splits combos for display', () => {
    expect(comboParts('Ctrl+Shift+K')).toEqual(['Ctrl', 'Shift', 'K']);
    expect(comboParts('Ctrl++')).toEqual(['Ctrl', '+']);
    expect(comboParts('')).toEqual([]);
  });
});
