import { useCallback, useEffect, useState } from 'react';
import {
  addEmployerNote, formatNoteDate, listEmployerNotes, removeEmployerNote,
} from '../lib/agencyNotes';
import { useLang } from '../i18n.jsx';

/** Otel/işletme yapışkan notları — favori departman adımının üstü */
export default function EmployerNotes({ agencyId, employerId }) {
  const { t } = useLang();
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!agencyId || !employerId) return;
    setNotes(await listEmployerNotes(agencyId, employerId));
  }, [agencyId, employerId]);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const row = await addEmployerNote(agencyId, employerId, text);
      if (row) {
        setNotes((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
        setDraft('');
      }
    } catch (err) {
      window.alert(err?.message || t('ops_notes_err') || 'Not kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await removeEmployerNote(agencyId, employerId, id);
    } catch {
      load();
    }
  };

  if (!agencyId || !employerId) return null;

  return (
    <div className="opsNotes" style={{ marginTop: 0, marginBottom: 16 }}>
      <p className="opsSection" style={{ marginBottom: 8 }}>
        {t('fav_hotel_notes_title') || 'Otel notları'}
      </p>
      <form onSubmit={add} className="opsNoteComposer" style={{ marginBottom: 10 }}>
        <textarea
          rows={2}
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          placeholder={t('fav_hotel_notes_ph') || 'Kontenjan, görüşme notu…'}
          maxLength={400}
        />
        <button type="submit" disabled={!draft.trim() || busy}>
          {busy ? '…' : (t('ops_notes_add') || 'Ekle')}
        </button>
      </form>
      {!notes.length ? (
        <p className="opsNotesHint">{t('fav_hotel_notes_empty') || 'Bu otel için henüz not yok.'}</p>
      ) : notes.map((n, i) => (
        <div key={n.id} className={`opsPaper tone-${i % 4}`}>
          <div className="opsPaperTop">
            <span>{formatNoteDate(n.created_at)}</span>
            <button type="button" className="opsPaperX" onClick={() => drop(n.id)} aria-label="remove">✕</button>
          </div>
          <p>{n.body}</p>
        </div>
      ))}
    </div>
  );
}
