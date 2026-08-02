import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

interface Props {
  value: string;       // YYYY-MM-DD
  onChange: (v: string) => void;
  className?: string;
}

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const HE_DAYS   = ['א','ב','ג','ד','ה','ו','ש']; // Sun→Sat
const EN_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DatePicker({ value, onChange, className }: Props) {
  const { lang } = useLang();
  const he = lang !== 'en';

  const parsed = value ? new Date(value + 'T12:00:00') : new Date();
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const todayStr = new Date().toISOString().slice(0, 10);
  const selParsed = value ? new Date(value + 'T12:00:00') : null;

  const display = value
    ? (he
        ? `${parsed.getDate()} ב${HE_MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`
        : `${EN_MONTHS[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`)
    : (he ? 'בחר תאריך' : 'Select date');

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(d);
    setOpen(false);
  }

  function openPicker() {
    const base = value ? new Date(value + 'T12:00:00') : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  }

  // Build grid cells: null = empty padding, number = day
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <button
        type="button"
        className={`dp-trigger ${className ?? ''}`}
        onClick={openPicker}
      >
        <Calendar size={15} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        <span>{display}</span>
      </button>

      {open && createPortal(
        <div className="dp-overlay" onClick={() => setOpen(false)}>
          <div className="dp-sheet" dir={he ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}>
            <div className="dp-handle" />

            {/* Month navigation */}
            <div className="dp-nav">
              <button type="button" className="dp-nav-btn" onClick={prevMonth}>
                {he ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <span className="dp-month-lbl">
                {he ? HE_MONTHS[viewMonth] : EN_MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" className="dp-nav-btn" onClick={nextMonth}>
                {he ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>

            {/* Day headers + grid */}
            <div className="dp-grid">
              {(he ? HE_DAYS : EN_DAYS).map((d, i) => (
                <div key={i} className="dp-hdr">{d}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const cellStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isSel   = selParsed
                  ? d === selParsed.getDate() && viewMonth === selParsed.getMonth() && viewYear === selParsed.getFullYear()
                  : false;
                const isToday = cellStr === todayStr && !isSel;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`dp-day${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`}
                    onClick={() => selectDay(d)}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="dp-footer">
              <button type="button" className="dp-footer-btn" onClick={() => setOpen(false)}>
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button
                type="button"
                className="dp-footer-btn dp-today-btn"
                onClick={() => { onChange(todayStr); setOpen(false); }}
              >
                {he ? 'היום' : 'Today'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
