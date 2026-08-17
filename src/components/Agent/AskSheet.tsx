// ── Ask sheet: the offline query agent's UI ───────────────────────────────────
// Everything here answers from local data. The typed path never touches
// SpeechRecognition, so it works with the radio off.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, Send, Sparkles } from 'lucide-react';
import { useExpense } from '../../context/ExpenseContext';
import { useLang } from '../../context/LanguageContext';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { parseExpenseText } from '../../services/expenseHelpers';
import { parseQuery, classifyUtterance, type Query } from '../../services/nlQuery/intentParser';
import { runQuery } from '../../services/nlQuery/queryEngine';
import { renderAnswer, notUnderstood, SUGGESTIONS, type Answer } from '../../services/nlQuery/answerText';
import { toStr } from '../../services/nlQuery/datePhrases';
import { track } from '../../services/analytics';

interface Turn {
  id: string;
  question: string;
  answer: Answer;
}

/** Text that parsed as an expense rather than a question. Never written without
 *  an explicit tap — a misroute should cost one confirmation, never a bad record. */
interface PendingExpense {
  raw: string;
  amount?: number;
  desc?: string;
}

export default function AskSheet({ onClose, onRecord }: {
  onClose: () => void;
  onRecord: (raw: string) => void;
}) {
  const { state, toMainAmt, formatCurrencyDirect } = useExpense();
  const { lang, catName } = useLang();
  const he = lang === 'he';

  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<PendingExpense | null>(null);
  const lastQuery = useRef<Query | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const catLabel = useCallback((id: string) => {
    const c = state.categories.find(x => x.id === id);
    return catName(id, c?.name ?? id, c?.isRenamed);
  }, [state.categories, catName]);

  const answer = useCallback((raw: string, forceQuestion = false) => {
    const text = raw.trim();
    if (!text) return;

    // The ask sheet's prior is 'question'; only an explicit imperative overrides it.
    if (!forceQuestion && classifyUtterance(text, 'question').kind === 'expense') {
      const p = parseExpenseText(text);
      if (p.amount || p.desc) {
        setPending({ raw: text, amount: p.amount, desc: p.desc });
        return;
      }
    }

    const q = parseQuery(text, state.categories, lastQuery.current);
    if (!q) {
      setTurns(t => [...t, { id: `${Date.now()}`, question: text, answer: notUnderstood(lang) }]);
      track('ask_unparsed', { len: text.length });
      return;
    }
    lastQuery.current = q;
    const today = toStr(new Date());
    const result = runQuery(q, state.transactions, toMainAmt, today);

    // A zero result is a dead end unless we can point somewhere. Re-run the same
    // question over the last 12 months and, if that finds something, say so.
    let widened;
    if (result.count === 0 && result.topItems.length === 0) {
      const wide = { ...q, range: { ...q.range, from: `${new Date().getFullYear() - 1}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`, to: today } };
      const wr = runQuery(wide, state.transactions, toMainAmt, today);
      if (wr.count > 0) {
        widened = {
          total: wr.total,
          count: wr.count,
          label: he ? '12 החודשים האחרונים' : 'the last 12 months',
        };
      }
    }

    const a = renderAnswer(result, { lang, fmt: formatCurrencyDirect, catLabel }, widened);
    setTurns(t => [...t, { id: `${Date.now()}`, question: text, answer: a }]);
    track('ask_query', { intent: q.intent, hasCategory: q.categoryIds.length > 0, count: result.count });
  }, [state.categories, state.transactions, toMainAmt, formatCurrencyDirect, catLabel, lang]);

  const voice = useVoiceInput({
    lang,
    onCommit: (raw) => { answer(raw); voice.setText(''); },
    // Anything spoken in this sheet is a complete thought; no parseability gate.
    shouldAutoCommit: () => true,
    onNetworkFallback: () => inputRef.current?.focus(),
  });

  // Keep the newest answer in view.
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); },
    [turns, pending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet ask-sheet">
        <div className="modal-handle" />
        <div className="modal-title">
          <span><Sparkles size={15} style={{ verticalAlign: -2 }} /> {he ? 'שאל אותי' : 'Ask me'}</span>
          <button className="modal-close" onClick={onClose} aria-label={he ? 'סגור' : 'Close'}>
            <X size={14} />
          </button>
        </div>

        <div className="ask-log" ref={logRef}>
          {turns.length === 0 && !pending && (
            <div className="ask-empty">
              <p className="ask-empty-msg">
                {he ? 'שאל אותי כל דבר על ההוצאות שלך — הכל מחושב על המכשיר, גם בלי אינטרנט.'
                    : 'Ask anything about your spending — answered on-device, even offline.'}
              </p>
              <div className="ask-suggest-row">
                {SUGGESTIONS[lang].map(s => (
                  <button key={s} className="ask-chip" onClick={() => answer(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {turns.map(t => (
            <div key={t.id} className="ask-turn">
              <div className="ask-bubble-user">{t.question}</div>
              <div className={`insight-card ask-answer${t.answer.tone === 'empty' ? ' all_clear' : ''}`}>
                <div className="insight-card-body">
                  <div className="insight-line1">{t.answer.headline}</div>
                  {t.answer.detail && <div className="insight-line2">{t.answer.detail}</div>}
                  {t.answer.note && <div className="insight-line3">{t.answer.note}</div>}
                  {t.answer.tone === 'unparsed' && (
                    <div className="ask-suggest-row">
                      {SUGGESTIONS[lang].map(s => (
                        <button key={s} className="ask-chip" onClick={() => answer(s)}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {pending && (
            <div className="insight-card ask-answer">
              <div className="insight-card-body">
                <div className="insight-line1">
                  {he ? 'זו נשמעת כמו הוצאה חדשה' : 'That sounds like a new expense'}
                </div>
                <div className="insight-line2">
                  {pending.amount ? formatCurrencyDirect(pending.amount) : ''}
                  {pending.desc ? ` · ${pending.desc}` : ''}
                </div>
                <div className="ask-suggest-row">
                  <button className="ask-chip ask-chip--primary"
                    onClick={() => { const r = pending.raw; setPending(null); onRecord(r); }}>
                    {he ? 'רשום הוצאה' : 'Record it'}
                  </button>
                  <button className="ask-chip"
                    onClick={() => { const r = pending.raw; setPending(null); answer(r, true); }}>
                    {he ? 'לא — זו שאלה' : 'No — it’s a question'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="voice-field-row ask-input-row">
          <div className={`voice-field-wrap${voice.listening ? ' listening' : ''}`}>
            <input
              ref={inputRef}
              type="text"
              className="voice-field-input"
              aria-label={he ? 'שאל שאלה על ההוצאות' : 'Ask about your spending'}
              placeholder={voice.micUsable
                ? (he ? 'שאל או הקלד…' : 'Ask or type…')
                : (he ? 'הקלד שאלה…' : 'Type a question…')}
              value={voice.text}
              onChange={e => voice.setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); answer(voice.text); voice.setText(''); }
              }}
            />
            {voice.micUsable && (
              <button
                type="button"
                className={`voice-api-btn${voice.listening ? ' listening' : ''}`}
                onClick={voice.listening ? voice.stop : voice.start}
                aria-label={he ? 'שאל בקול' : 'Ask by voice'}
              >
                {voice.listening ? '...' : <Mic size={14} />}
              </button>
            )}
          </div>
          {voice.text && (
            <button type="button" className="voice-parse-btn"
              onClick={() => { answer(voice.text); voice.setText(''); }}
              aria-label={he ? 'שלח' : 'Send'}>
              <Send size={14} />
            </button>
          )}
        </div>
        {voice.error && <p className="voice-error">{voice.error}</p>}
      </div>
    </div>,
    document.body,
  );
}
