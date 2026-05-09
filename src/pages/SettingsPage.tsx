import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useExpense, CATEGORY_COLORS } from '../context/ExpenseContext';
import { suggestIcon } from '../services/iconSuggest';
import { CURRENCIES, CURRENCY_SYMBOL, CURRENCY_NAME, CURRENCY_NAME_EN } from '../services/exchangeRate';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { Plus, Trash2, PiggyBank, Tag, Download, Upload, Sun, Moon, Check, X, RefreshCw, CheckCircle, ChevronRight, Target, BarChart2, BookOpen, GripVertical, RotateCcw, Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import ConfirmModal from '../components/ConfirmModal';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Sortable wrapper for a category row ──────────────────────────────────────
function SortableCatItem({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };
  const handle = (
    <span
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none', cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--text-dim)', padding: '0 4px 0 0', flexShrink: 0 }}
      aria-label="drag to reorder"
    >
      <GripVertical size={17} />
    </span>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}

const SettingsPage: React.FC = () => {
  const { state, dispatch } = useExpense();
  const { t, toggleLang, lang, monthLabel, catName } = useLang();
  const [theme, toggleTheme] = useTheme();
  const { permission, enabled, notifyDays, requestPermission, setEnabled, setNotifyDays } = useNotifications();

  const { transactions, categories, monthlyBudget, savingsGoal, mainCurrency, moneyMode, debtModeEnabled } = state;

  // DnD sensors (pointer for desktop, touch for mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleCatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    dispatch({ type: 'REORDER_CATEGORIES', payload: arrayMove(categories, oldIndex, newIndex) });
  }

  // Toast feedback
  const [toast, setToast] = useState('');
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setToastTimer(setTimeout(() => setToast(''), 2200));
  }

  // Refresh / update check
  const refreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateCheck, setUpdateCheck] = useState<'idle' | 'ok'>('idle');

  async function handleRefresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);

    // Reload the page — localStorage (user data) is never touched by this flow.
    let didReload = false;
    const doReload = () => { if (!didReload) { didReload = true; window.location.reload(); } };

    if (!('serviceWorker' in navigator)) {
      // No SW support — plain reload is the best we can do
      setTimeout(doReload, 200);
      return;
    }

    // When the new service worker takes control, reload to get updated assets
    const onControllerChange = () => doReload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    try {
      const reg = await navigator.serviceWorker.getRegistration();

      if (!reg) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        setTimeout(doReload, 200);
        return;
      }

      // Re-fetch and compare the SW script against the deployed version.
      // If it changed, the browser downloads and installs the new SW.
      // vite-plugin-pwa (autoUpdate mode) generates a SW that calls
      // skipWaiting() automatically on install, which fires 'controllerchange'.
      await reg.update();

      // Edge-case: waiting SW that didn't auto-skip — nudge it
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      if (reg.installing || reg.waiting) {
        // A new version is installing — wait for it to activate (up to 8 s).
        // 'controllerchange' fires first in the normal path and reloads immediately.
        await new Promise<void>(resolve => setTimeout(resolve, 8000));
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        doReload(); // Fallback if controllerchange never fired
        return;
      }

      // No new version found — app is already on the latest build
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (!didReload) {
        setIsRefreshing(false);
        refreshingRef.current = false;
        showToast(t.appUpToDate);
        setUpdateCheck('ok');
        setTimeout(() => setUpdateCheck('idle'), 2500);
      }
    } catch {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (!didReload) setTimeout(doReload, 200);
    }
  }

  // Budget
  const [budgetEdit, setBudgetEdit] = useState(monthlyBudget > 0 ? String(monthlyBudget) : '');
  function saveBudget() {
    const val = parseFloat(budgetEdit);
    if (val > 0) { dispatch({ type: 'SET_BUDGET', payload: val }); showToast(t.savedSettings); }
  }

  // Savings goal
  const [goalEdit, setGoalEdit] = useState(savingsGoal > 0 ? String(savingsGoal) : '');
  function saveGoal() {
    const val = parseFloat(goalEdit);
    dispatch({ type: 'SET_SAVINGS_GOAL', payload: !isNaN(val) && val > 0 ? val : 0 });
    showToast(t.savedSettings);
  }

  // Inline category editing
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingName,  setEditingName]  = useState('');
  const [editingColor, setEditingColor] = useState('');

  function startEdit(id: string, name: string, color: string) {
    setEditingId(id); setEditingName(name); setEditingColor(color);
  }
  function commitEdit() {
    if (editingId && editingName.trim()) {
      const name = editingName.trim();
      dispatch({ type: 'RENAME_CATEGORY', payload: { id: editingId, name, color: editingColor, icon: suggestIcon(name) } });
      showToast(t.categoryUpdated);
    }
    setEditingId(null);
  }

  // New category
  const [newCatName,  setNewCatName]  = useState('');
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; onConfirm: () => void } | null>(null);
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[4]);

  // Full JSON backup/restore
  const backupInputRef = useRef<HTMLInputElement>(null);

  const BACKUP_STORAGE_KEYS = [
    'expense_transactions',
    'expense_recurring',
    'expense_budget',
    'expense_savings_goal',
    'expense_categories_v2',
    'expense_device_id',
    'expense_main_currency',
    'expense_money_mode',
    'expense_category_budgets',
    'expense_debts',
    'expense_streaks',
  ];

  function exportBackup() {
    const data: Record<string, unknown> = { _version: 1, _exportedAt: new Date().toISOString() };
    for (const key of BACKUP_STORAGE_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try { data[key] = JSON.parse(val); } catch { data[key] = val; }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date().toISOString().slice(0, 10);
    a.download = `flowly_backup_${d}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleBackupFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (backupInputRef.current) backupInputRef.current.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        if (!parsed._version) throw new Error('not a backup');
        for (const key of BACKUP_STORAGE_KEYS) {
          if (key in parsed) {
            const v = parsed[key];
            localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v));
          }
        }
        showToast(t.backupImportSuccess);
        setTimeout(() => window.location.reload(), 800);
      } catch {
        showToast(t.backupImportError);
      }
    };
    reader.onerror = () => showToast(t.backupImportError);
    reader.readAsText(file, 'utf-8');
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    dispatch({
      type: 'ADD_CATEGORY',
      payload: { id: `cat_custom_${Date.now()}`, name, color: newCatColor, icon: suggestIcon(name), isCustom: true },
    });
    setNewCatName('');
  }

  return (
    <div className="page" style={{ paddingBottom: 90 }}>

      {/* Header */}
      <div className="aether-header">
        <div className="header-row">
          <div className="header-brand">{t.settings}</div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={lang === 'he' ? 'בדוק עדכונים' : 'Check for updates'}
              title={
                isRefreshing
                  ? (lang === 'he' ? 'בודק…' : 'Checking…')
                  : updateCheck === 'ok'
                  ? (lang === 'he' ? 'האפליקציה מעודכנת' : 'App is up to date')
                  : (lang === 'he' ? 'בדוק עדכונים' : 'Check for updates')
              }
              style={updateCheck === 'ok' ? { color: '#22C55E' } : undefined}
            >
              {updateCheck === 'ok'
                ? <CheckCircle size={16} />
                : <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
              }
            </button>
            <button className="icon-btn lang-btn" onClick={toggleLang} aria-label="Toggle language">
              {lang === 'he' ? 'EN' : 'עב'}
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Money Management Mode ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.moneyModeTitle}</span>
        </div>
        <div className="mode-seg-ctrl">
          <button
            className={`mode-seg-btn${moneyMode === 'savings_based' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_MONEY_MODE', payload: 'savings_based' })}
          >
            <Target size={14} />
            <span>{t.modeTrackSavings}</span>
          </button>
          <button
            className={`mode-seg-btn${moneyMode === 'budget_based' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_MONEY_MODE', payload: 'budget_based' })}
          >
            <BarChart2 size={14} />
            <span>{t.modeTrackBudget}</span>
          </button>
        </div>
        <p className="mode-seg-desc">
          {moneyMode === 'savings_based' ? t.modeTrackSavingsDesc : t.modeTrackBudgetDesc}
        </p>
      </div>

      {/* ── Debt Mode ── */}
      <div className="a-sec">
        <div className="a-sec-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="title-text">{lang === 'he' ? 'מצב חובות' : 'Debt Mode'}</span>
          <button
            className={`debt-mode-toggle${debtModeEnabled ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'SET_DEBT_MODE', payload: !debtModeEnabled })}
            aria-label={lang === 'he' ? 'הפעל/כבה מצב חובות' : 'Toggle debt mode'}
          >
            <span className="debt-mode-thumb" />
          </button>
        </div>
        <p className="mode-seg-desc" style={{ marginTop: 6 }}>
          {lang === 'he'
            ? 'עקוב אחרי חובות שנתת או קיבלת. כשפעיל, חוב יירשם גם כהוצאה/הכנסה.'
            : 'Track debts you gave or received. When on, each debt is also recorded as an expense/income.'}
        </p>
      </div>

      {/* ── Financial Goals (mode-dependent) ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.financialGoals}</span>
        </div>

        {moneyMode === 'savings_based' ? (
          <>
            {/* Savings goal — PRIMARY */}
            <div className="set-row">
              <span className="set-lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PiggyBank size={13} color="#22C55E" />
                {t.savingsGoalLabel} ({CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency})
              </span>
              <input
                type="number" className="set-input"
                placeholder={lang === 'he' ? 'לדוגמה: 5,000' : 'e.g. 5,000'}
                value={goalEdit}
                onChange={e => setGoalEdit(e.target.value)}
                onBlur={saveGoal}
                onKeyDown={e => e.key === 'Enter' && saveGoal()}
                inputMode="numeric"
              />
            </div>

            <p className="settings-helper">{t.savingsHelperText}</p>
          </>
        ) : (
          <>
            {/* Budget — PRIMARY */}
            <div className="set-row">
              <span className="set-lbl">{t.monthlyBudget} ({CURRENCY_SYMBOL[mainCurrency] ?? mainCurrency})</span>
              <input
                type="number" className="set-input"
                placeholder={lang === 'he' ? 'לדוגמה: 10,000' : 'e.g. 10,000'}
                value={budgetEdit}
                onChange={e => setBudgetEdit(e.target.value)}
                onBlur={saveBudget}
                onKeyDown={e => e.key === 'Enter' && saveBudget()}
                inputMode="numeric"
              />
            </div>

            <p className="settings-helper">{t.budgetHelperText}</p>
          </>
        )}

        {/* Main Currency */}
        <div className="set-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span className="set-lbl">{t.mainCurrencyLabel}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CURRENCIES.map(c => (
              <button
                key={c}
                type="button"
                className={`currency-pill${mainCurrency === c ? ' active' : ''}`}
                onClick={() => dispatch({ type: 'SET_MAIN_CURRENCY', payload: c })}
              >
                {CURRENCY_SYMBOL[c]} {c}
                <span style={{ fontSize: 10, opacity: 0.7, marginRight: 2 }}>— {lang === 'he' ? CURRENCY_NAME[c] : CURRENCY_NAME_EN[c]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category Manager ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Tag size={14} />
            {t.categoriesTitle}
          </span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
          <SortableContext items={state.categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {state.categories.map(cat => (
              <SortableCatItem key={cat.id} id={cat.id}>
                {handle => (
                  <div className="set-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                    {editingId === cat.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                        <input
                          autoFocus
                          className="set-input"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                          style={{ width: '100%', textAlign: 'right' }}
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {CATEGORY_COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setEditingColor(c)}
                              style={{
                                width: 22, height: 22, borderRadius: '50%', background: c,
                                border: 'none', cursor: 'pointer', flexShrink: 0,
                                boxShadow: editingColor === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                                transition: 'box-shadow 0.15s',
                              }}
                            />
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                          <button
                            onClick={() => {
                              const affected = transactions
                                .filter(tx => tx.categoryId === editingId)
                                .map(tx => tx.date.slice(0, 7))
                                .filter((m, i, a) => a.indexOf(m) === i)
                                .sort((a, b) => b.localeCompare(a));

                              const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
                              const monthLabels = affected.map(ym => {
                                const [y, m] = ym.split('-');
                                return lang === 'he'
                                  ? `${HE_MONTHS[parseInt(m) - 1]} ${y}`
                                  : new Date(`${ym}-01`).toLocaleDateString('en', { month: 'long', year: 'numeric' });
                              });

                              setConfirm({
                                title: t.confirmDeleteCatTitle,
                                body: affected.length > 0 ? (
                                  <>
                                    <strong>"{editingName}"</strong>
                                    <br /><br />
                                    <span style={{ color: 'var(--danger)', fontSize: 13 }}>
                                      {lang === 'he'
                                        ? `יש ${affected.length === 1 ? 'עסקה אחת' : `${affected.length} עסקאות`} מ: ${monthLabels.join(', ')}`
                                        : `Has ${affected.length} transaction${affected.length !== 1 ? 's' : ''} from: ${monthLabels.join(', ')}`}
                                    </span>
                                    <br />
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                      {lang === 'he' ? 'העסקאות ישמרו ללא קטגוריה.' : 'Transactions will remain uncategorised.'}
                                    </span>
                                  </>
                                ) : <strong>"{editingName}"</strong>,
                                onConfirm: () => {
                                  dispatch({ type: 'DELETE_CATEGORY', payload: editingId! });
                                  setEditingId(null);
                                  setConfirm(null);
                                },
                              });
                            }}
                            style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: 0.85 }}
                          >
                            <Trash2 size={12} /> {t.deleteLabel}
                          </button>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setEditingId(null)}
                              style={{ background: 'none', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                              <X size={12} /> {t.cancel}
                            </button>
                            <button onClick={commitEdit}
                              style={{ background: 'var(--purple)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                              <Check size={12} /> {t.save}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(cat.id, catName(cat.id, cat.name, cat.isRenamed), cat.color)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'start' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {handle}
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                          <span className="set-lbl">{catName(cat.id, cat.name, cat.isRenamed)}</span>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                      </button>
                    )}
                  </div>
                )}
              </SortableCatItem>
            ))}
          </SortableContext>
        </DndContext>

        <form onSubmit={handleAddCategory} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text" className="set-input"
            placeholder={t.newCategoryPlaceholder}
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            maxLength={30}
            style={{ width: '100%', textAlign: 'right' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORY_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewCatColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: c,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  boxShadow: newCatColor === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                  transition: 'box-shadow 0.15s',
                }}
              />
            ))}
          </div>
          <button
            type="submit"
            className={`export-btn${newCatName.trim() ? ' primary' : ''}`}
            disabled={!newCatName.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={13} /> {t.addCategory}
          </button>
        </form>
      </div>

      {/* ── Notifications ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <Bell size={14} />
          <span className="title-text">{lang === 'he' ? 'התראות' : 'Notifications'}</span>
        </div>

        {permission === 'denied' ? (
          <p className="settings-helper" style={{ color: 'var(--text-muted)' }}>
            {lang === 'he'
              ? 'התראות חסומות בדפדפן. אפשר אותן בהגדרות המכשיר.'
              : 'Notifications blocked by browser. Enable in device settings.'}
          </p>
        ) : permission === 'default' ? (
          <button className="export-btn primary" onClick={requestPermission}>
            <Bell size={13} />
            {lang === 'he' ? 'הפעל התראות' : 'Enable notifications'}
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {lang === 'he' ? 'התראות על הוצאות קרובות' : 'Reminders for upcoming bills'}
              </span>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`adv-card-toggle adv-card-toggle--green${enabled ? ' on' : ''}`}
                style={{ flexShrink: 0 }}
              />
            </div>

            {enabled && (
              <>
                <p className="settings-helper">
                  {lang === 'he' ? 'הודעה מוקדמת:' : 'Advance notice:'}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3].map(d => (
                    <button
                      key={d}
                      onClick={() => setNotifyDays(d)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 10, cursor: 'pointer',
                        border: `1.5px solid ${notifyDays === d ? 'var(--purple)' : 'var(--glass-border)'}`,
                        background: notifyDays === d ? 'var(--purple-dim)' : 'var(--bg-input)',
                        color: notifyDays === d ? 'var(--purple)' : 'var(--text-secondary)',
                        fontSize: 13, fontWeight: notifyDays === d ? 700 : 500,
                      }}
                    >
                      {d === 1
                        ? (lang === 'he' ? 'יום אחד' : '1 day')
                        : (lang === 'he' ? `${d} ימים` : `${d} days`)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Tools ── */}
      <div className="a-sec">
        <div className="a-sec-title">
          <span className="title-text">{t.toolsTitle}</span>
        </div>

        <button className="export-btn primary" onClick={exportBackup}
          style={{ background: 'rgba(0,113,227,0.12)', borderColor: 'rgba(0,113,227,0.3)', color: 'var(--purple)' }}>
          <Download size={13} />
          {lang === 'he' ? 'גיבוי מלא' : 'Full Backup'}
        </button>

        <input ref={backupInputRef} type="file" accept=".json,application/json"
          style={{ display: 'none' }} onChange={handleBackupFileChange} />
        <button className="export-btn" onClick={() => backupInputRef.current?.click()} style={{ marginTop: 8 }}>
          <RotateCcw size={13} />
          {lang === 'he' ? 'שחזור מלא' : 'Full Restore'}
        </button>
        <p className="settings-helper" style={{ marginTop: 4, textAlign: 'center', marginBottom: 12 }}>{t.backupImportNote}</p>

        <button className="export-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('finio-show-onboarding'))}
          style={{ marginTop: 2 }}>
          <BookOpen size={13} />
          {t.showOnboardingAgain}
        </button>

        <p className="settings-version">{t.version} v{__APP_VERSION__}</p>
      </div>

      {/* Delete confirmation */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && createPortal(<div className="toast">{toast}</div>, document.body)}

    </div>
  );
};

export default SettingsPage;
