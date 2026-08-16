import { useEffect, useMemo, useState } from 'react';
import { listAgencyChatThreads } from '../lib/ops';
import { groupByEmployer } from '../lib/employerAttach';
import { candidateCode, NATION_CODE } from '../../../lib/candidateCode';
import { Icon } from '../components/Icon.jsx';
import { useLang } from '../i18n.jsx';

const flagUrl = (nat) => {
  const cc = NATION_CODE[nat];
  return cc && cc !== 'XX' ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : '';
};

function ago(iso) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'az önce';
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export default function ChatInbox({ agencyId, onOpen }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!agencyId) return undefined;
    let alive = true;
    const load = () => listAgencyChatThreads(agencyId, 120).then((list) => {
      if (alive) setRows(list);
    }).catch(() => { if (alive) setRows([]); });
    load();
    const timer = setInterval(load, 20000);
    return () => { alive = false; clearInterval(timer); };
  }, [agencyId]);

  const sections = useMemo(
    () => groupByEmployer(rows || [], { noneLabel: t('employer_group_none') || 'İşletme atanmamış' }),
    [rows, t],
  );

  if (rows == null) {
    return <div className="opsEmpty"><div className="spinner" /></div>;
  }

  return (
    <div className="inbox">
      <div className="inboxHead">
        <h1>{t('nav_messages') || 'Mesajlar'}</h1>
        <p>{t('agency_chat_inbox_lead') || 'Sözleşme aşamasından sonra adaylarla açılan mesajlar burada — işletmeye göre gruplu.'}</p>
      </div>
      {rows.length === 0 ? (
        <div className="opsEmpty">
          <strong>{t('agency_chat_empty') || 'Henüz sohbet yok'}</strong>
          <span>{t('agency_chat_empty_sub') || 'Sözleşme adımı açılınca buradan yazışabilirsiniz.'}</span>
        </div>
      ) : (
        sections.map((sec) => (
          <div key={sec.key} className="empGroup">
            <div className="empGroupHead">
              <strong>{sec.title}</strong>
              <span>{sec.data.length}</span>
            </div>
            <ul className="opsQueue">
              {sec.data.map((th) => {
                const p = th.profile;
                const code = candidateCode(p.nationality, p.reg_no);
                const photo = p.data?.photoClose || p.data?.photo || p.data?.photoFull;
                const flag = flagUrl(p.nationality);
                const unread = th.count > 0;
                return (
                  <li key={th.candidateId}>
                    <button
                      type="button"
                      className={`opsRow ${unread ? 'tone-info' : 'tone-muted'}`}
                      onClick={() => onOpen({ c: p, st: { _openChat: true } })}
                    >
                      <div className="opsAvatar">
                        {photo ? <img src={photo} alt="" /> : <Icon name="users" size={22} />}
                        {unread ? <span className="opsUnread">{th.count > 9 ? '9+' : th.count}</span> : null}
                      </div>
                      <div className="opsRowMain">
                        <div className="opsRowTop">
                          <span className="opsCode">{code}</span>
                          {unread ? <span className="opsTag tone-info">{th.count} yeni</span> : null}
                        </div>
                        <div className="opsRowSub">
                          {flag ? <img className="flag" src={flag} alt="" /> : null}
                          <span>{p.nationality || '—'}</span>
                          <span className="opsDot">·</span>
                          <span>{ago(th.lastAt)}</span>
                        </div>
                      </div>
                      <span className="opsGo">→</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
