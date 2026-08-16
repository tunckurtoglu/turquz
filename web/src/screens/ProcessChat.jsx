import { useCallback, useEffect, useRef, useState } from 'react';
import { listProcessMessages, sendProcessMessage, syncChatLang, subscribeProcessMessages } from '../lib/processChat';
import { useLang } from '../i18n.jsx';

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ProcessChat({ candidateId, peerLabel, onClose }) {
  const { lang, t } = useLang();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);

  const load = useCallback(async ({ spinner } = { spinner: true }) => {
    if (!candidateId) return;
    if (spinner) setLoading(true);
    setErr('');
    try {
      syncChatLang(lang);
      const data = await listProcessMessages(candidateId, lang);
      setChatId(data.chatId || null);
      setMessages(data.messages || []);
    } catch (e) {
      setErr(e?.message === 'chat_locked' ? (t('chat_locked') || e.message) : (e?.message || 'error'));
    } finally {
      setLoading(false);
    }
  }, [candidateId, lang, t]);

  useEffect(() => { load({ spinner: true }); }, [load]);
  useEffect(() => {
    if (!chatId) return undefined;
    return subscribeProcessMessages(chatId, () => { load({ spinner: false }); });
  }, [chatId, load]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || sending) return;
    const tempId = `local-${Date.now()}`;
    setText('');
    setErr('');
    setMessages((m) => [...m, {
      id: tempId,
      body,
      original: body,
      sourceLang: lang,
      createdAt: new Date().toISOString(),
      mine: true,
    }]);
    setSending(true);
    try {
      const data = await sendProcessMessage(candidateId, body, lang);
      if (data?.message) {
        setMessages((m) => {
          const withoutTemp = m.filter((x) => x.id !== tempId);
          if (withoutTemp.some((x) => x.id === data.message.id)) return withoutTemp;
          return [...withoutTemp, data.message];
        });
      } else {
        setMessages((m) => m.filter((x) => x.id !== tempId));
      }
    } catch (ex) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setText(body);
      setErr(ex?.message || t('chat_send_error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chatOverlay" role="dialog">
      <div className="chatPanel">
        <div className="chatHead">
          <div>
            <div className="chatTitle">{t('chat_title') || 'Messages'}</div>
            {peerLabel ? <div className="chatSub">{peerLabel}</div> : null}
          </div>
          <button type="button" className="chatClose" onClick={onClose}>✕</button>
        </div>
        <div className="chatHint"><span className="chatHintIcon" aria-hidden="true">✨</span>{t('chat_hint')}</div>
        <div className="chatBody">
          {loading && !messages.length ? <div className="chatEmpty">…</div> : null}
          {!loading && !messages.length && !err ? <div className="chatEmpty">{t('chat_empty')}</div> : null}
          {err ? <div className="chatErr">{err}</div> : null}
          {messages.map((m) => (
            <div key={m.id} className={`chatBubble ${m.mine ? 'mine' : 'theirs'}`}>
              <div>{m.body}</div>
              <div className="chatTime">{fmtTime(m.createdAt)}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form className="chatComposer" onSubmit={send}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('chat_placeholder') || ''}
            maxLength={2000}
            rows={2}
          />
          <button type="submit" disabled={!text.trim() || sending}>{t('chat_send')}</button>
        </form>
      </div>
    </div>
  );
}
