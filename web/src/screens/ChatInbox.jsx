import { useEffect, useMemo, useRef, useState } from 'react';
import { listAgencyChatThreads } from '../lib/ops';
import { groupByEmployer } from '../lib/employerAttach';
import { candidateCode, maskedName, NATION_CODE } from '../../../lib/candidateCode';
import { Icon } from '../components/Icon.jsx';
import { useLang } from '../i18n.jsx';

const flagUrl = (nat) => {
  const cc = NATION_CODE[nat];
  return cc && cc !== 'XX' ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : '';
};

function ago(iso, t) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t('chat_just_now');
  const m = Math.floor(s / 60); if (m < 60) return t('chat_min_ago', { n: m });
  const h = Math.floor(m / 60); if (h < 24) return t('chat_hour_ago', { n: h });
  return t('chat_day_ago', { n: Math.floor(h / 24) });
}

function matchThread(th, term) {
  if (!term) return true;
  const p = th.profile || {};
  const code = (candidateCode(p.nationality, p.reg_no) || '').toLocaleLowerCase('tr');
  const name = (maskedName(p.data) || '').toLocaleLowerCase('tr');
  const full = [p.data?.firstName, p.data?.lastName, p.data?.passportFirstName, p.data?.passportLastName]
    .filter(Boolean).join(' ').toLocaleLowerCase('tr');
  const hotel = (th.employerLabel || '').toLocaleLowerCase('tr');
  return code.includes(term) || name.includes(term) || full.includes(term) || hotel.includes(term);
}

export default function ChatInbox({ agencyId, onOpen }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const seeded = useRef(false);

  useEffect(() => {
    if (!agencyId) return undefined;
    let alive = true;
    const load = () => listAgencyChatThreads(agencyId, 250).then((list) => {
      if (alive) setRows(list);
    }).catch(() => { if (alive) setRows([]); });
    load();
    const timer = setInterval(load, 20000);
    return () => { alive = false; clearInterval(timer); };
  }, [agencyId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr');
    return (rows || []).filter((th) => matchThread(th, term));
  }, [rows, query]);

  const sections = useMemo(() => {
    const active = filtered.filter((r) => !r.closed);
    const history = filtered.filter((r) => r.closed);
    const activeSecs = groupByEmployer(active, { noneLabel: t('employer_group_none') || 'İşletme atanmamış' });
    if (!history.length) return activeSecs;
    return [
      ...activeSecs,
      { key: 'history', title: t('agency_chat_history') || 'Süreci sonlanan adaylar', data: history },
    ];
  }, [filtered, t]);

  useEffect(() => {
    if (!rows || seeded.current) return;
    const active = rows.filter((r) => !r.closed);
    const secs = groupByEmployer(active, { noneLabel: 'x' });
    const withUnread = secs.filter((s) => s.data.some((th) => th.count > 0)).map((s) => s.key);
    if (withUnread.length) setOpenKeys(new Set(withUnread));
    else if (secs[0]) setOpenKeys(new Set([secs[0].key]));
    seeded.current = true;
  }, [rows]);

  const searching = !!query.trim();
  const toggle = (key) => {
    if (searching) return;
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (rows == null) {
    return <div className="opsEmpty"><div className="spinner" /></div>;
  }

  return (
    <div className="inbox">
      <div className="inboxHead">
        <h1>{t('nav_messages') || 'Mesajlar'}</h1>
        <p>{t('agency_chat_inbox_lead') || 'Sözleşme aşamasından sonra adaylarla açılan mesajlar burada — işletmeye göre gruplu.'}</p>
        <div className="inboxSearch">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('agency_chat_search_ph') || 'İsim veya aday no ile ara'}
          />
          {query ? (
            <button type="button" className="inboxSearchClear" onClick={() => setQuery('')} aria-label="Temizle">✕</button>
          ) : null}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="opsEmpty">
          <strong>{t('agency_chat_empty') || 'Henüz sohbet yok'}</strong>
          <span>{t('agency_chat_empty_sub') || 'Sözleşme adımı açılınca buradan yazışabilirsiniz.'}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="opsEmpty">
          <strong>{t('agency_chat_search_empty') || 'Sonuç bulunamadı'}</strong>
          <span>{t('agency_chat_search_empty_sub') || 'Başka bir isim veya kod deneyin.'}</span>
        </div>
      ) : (
        sections.map((sec) => {
          const open = searching || openKeys.has(sec.key);
          const unreadN = sec.data.reduce((n, th) => n + (th.closed ? 0 : (th.count || 0)), 0);
          return (
            <div key={sec.key} className={`empGroup ${sec.key === 'history' ? 'empGroupHistory' : ''}`}>
              <button
                type="button"
                className={`empGroupHead empGroupToggle ${open ? 'open' : ''}`}
                onClick={() => toggle(sec.key)}
              >
                <span className="empGroupChev">{open ? '▾' : '▸'}</span>
                <strong>{sec.title}</strong>
                {unreadN > 0 ? <span className="empGroupUnread">{unreadN}</span> : null}
                <span>{sec.data.length}</span>
              </button>
              {open ? (
                <ul className="opsQueue">
                  {sec.data.map((th) => {
                    const p = th.profile;
                    const code = candidateCode(p.nationality, p.reg_no);
                    const name = maskedName(p.data);
                    const photo = p.data?.photoClose || p.data?.photo || p.data?.photoFull;
                    const flag = flagUrl(p.nationality);
                    const unread = !th.closed && th.count > 0;
                    const hist = sec.key === 'history' || th.closed;
                    return (
                      <li key={th.candidateId}>
                        <button
                          type="button"
                          className={`opsRow ${unread ? 'tone-info' : 'tone-muted'}${hist ? ' history' : ''}`}
                          onClick={() => onOpen({ c: p, st: { _openChat: true } })}
                        >
                          <div className="opsAvatar">
                            {photo ? <img src={photo} alt="" /> : <Icon name="users" size={22} />}
                            {unread ? <span className="opsUnread">{th.count > 9 ? '9+' : th.count}</span> : null}
                          </div>
                          <div className="opsRowMain">
                            <div className="opsRowTop">
                              <span className="opsCode">{name ? `${name} · ${code}` : code}</span>
                              {unread ? <span className="opsTag tone-info">{th.count} yeni</span> : null}
                              {hist ? <span className="opsTag tone-muted">{t('agency_chat_ended') || 'Süreç sonlandı'}</span> : null}
                            </div>
                            <div className="opsRowSub">
                              {flag ? <img className="flag" src={flag} alt="" /> : null}
                              <span>{p.nationality || '—'}</span>
                              <span className="opsDot">·</span>
                              <span>{ago(th.lastAt, t)}</span>
                            </div>
                          </div>
                          <span className="opsGo">→</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
