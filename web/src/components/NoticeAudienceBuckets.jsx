import { useState } from 'react';
import { NATION_CODE } from '../../../lib/candidateCode';

const flagUrl = (nat) => {
  const cc = NATION_CODE[nat];
  return cc && cc !== 'XX' ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : '';
};

function PersonCard({ p, on, mode, onPress, onDrop, dropLabel }) {
  const flag = flagUrl(p.nationality);
  const label = p.name ? `${p.name} · ${p.code}` : p.code;
  const inner = (
    <>
      <div className="opsAvatar">
        {p.photo ? <img src={p.photo} alt="" /> : <span className="audPh">👤</span>}
      </div>
      <div className="opsRowMain">
        <div className="opsRowTop">
          <span className="opsCode">{label}</span>
        </div>
        <div className="opsRowSub">
          {flag ? <img className="flag" src={flag} alt="" /> : null}
          <span>{p.nationality || p.title || '—'}</span>
        </div>
      </div>
      {mode === 'read' ? (
        <span className={`noticeRecMark ${on ? 'ok' : ''}`}>{on ? '✓' : '·'}</span>
      ) : mode === 'pick' ? (
        <span className={`audCheck ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
      ) : (
        <button type="button" className="audDrop" onClick={onDrop} aria-label={dropLabel}>✕</button>
      )}
    </>
  );
  if (mode === 'pick') {
    return (
      <button type="button" className={`opsRow tone-muted audPerson ${on ? 'on' : ''}`} onClick={onPress}>
        {inner}
      </button>
    );
  }
  return <div className="opsRow tone-muted audPerson">{inner}</div>;
}

export function NoticePersonRow(props) {
  return <PersonCard {...props} />;
}

export default function NoticeAudienceBuckets({
  buckets = [],
  mode = 'send',
  picked,
  onToggleGroup,
  onTogglePerson,
  onSendGroup,
  t,
}) {
  const [open, setOpen] = useState({});
  const [dropped, setDropped] = useState({});
  const pickedSet = picked instanceof Set ? picked : new Set(picked || []);
  const visible = (buckets || []).filter((b) => b.id === 'pool' || b.id === 'fav' || (b.people || []).length);
  if (!visible.length) return null;

  const dropOf = (id) => dropped[id] || new Set();
  const remainingOf = (b) => (b.people || []).filter((p) => !dropOf(b.id).has(p.userId));
  const dropOne = (bucketId, userId) => {
    setDropped((prev) => {
      const next = new Set(prev[bucketId] || []);
      next.add(userId);
      return { ...prev, [bucketId]: next };
    });
  };
  const restore = (bucketId) => {
    setDropped((prev) => ({ ...prev, [bucketId]: new Set() }));
  };

  return (
    <div className="audGroups">
      {visible.map((b) => {
        const people = remainingOf(b);
        const total = (b.people || []).length;
        const n = people.length;
        const droppedN = total - n;
        const isPool = b.id === 'pool';
        const expanded = !isPool && !!open[b.id];
        const allOn = n > 0 && people.every((p) => pickedSet.has(p.userId));
        const someOn = people.some((p) => pickedSet.has(p.userId));
        return (
          <div key={b.id} className={`audGroup ${isPool ? 'pool' : ''}`}>
            <div className="audHead">
              {mode === 'pick' ? (
                <button
                  type="button"
                  className={`audCheck ${allOn ? 'on' : ''} ${someOn && !allOn ? 'some' : ''}`}
                  onClick={() => onToggleGroup?.(b)}
                  disabled={!n}
                >
                  {allOn ? '✓' : someOn ? '–' : ''}
                </button>
              ) : null}
              <button
                type="button"
                className="audTitle"
                onClick={() => { if (!isPool) setOpen((p) => ({ ...p, [b.id]: !p[b.id] })); }}
              >
                <strong>{b.id === 'fav' ? '★ ' : ''}{t(b.labelKey)}</strong>
                <em>{droppedN ? `${n}/${total}` : n}</em>
                {isPool ? null : <span>{expanded ? '▴' : '▾'}</span>}
              </button>
              {mode === 'send' ? (
                <button
                  type="button"
                  className="audSend"
                  disabled={!n}
                  onClick={() => n && onSendGroup?.({ ...b, people })}
                >
                  {t('agency_notice_send')}
                </button>
              ) : null}
            </div>
            {isPool ? <p className="audHint">{t('agency_notice_aud_pool_hint')}</p> : null}
            {expanded ? (
              n || droppedN ? (
                <div className="audPeople">
                  {mode === 'send' && droppedN ? (
                    <button type="button" className="audRestore" onClick={() => restore(b.id)}>
                      {t('agency_notice_dropped', { n: String(droppedN) })} · {t('agency_notice_restore')}
                    </button>
                  ) : mode === 'send' ? (
                    <p className="audHint">{t('agency_notice_trim_hint')}</p>
                  ) : null}
                  {people.map((p) => (
                    <PersonCard
                      key={p.userId}
                      p={p}
                      mode={mode}
                      on={pickedSet.has(p.userId)}
                      onPress={() => onTogglePerson?.(p.userId)}
                      onDrop={(e) => { e?.stopPropagation?.(); dropOne(b.id, p.userId); }}
                      dropLabel={t('agency_notice_drop')}
                    />
                  ))}
                </div>
              ) : (
                <p className="audHint">{b.id === 'fav' ? t('fav_empty') : t('agency_notice_need_people')}</p>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
