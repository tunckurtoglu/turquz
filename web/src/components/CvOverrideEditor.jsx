// web/src/components/CvOverrideEditor.jsx
// Acentenin aday CV'sini kendi kopyasında düzenleyebildiği yan panel.
// Değişiklikler YALNIZCA bu acentenin görünümüne ve dışa aktarımına yansır.
// Havuz, diğer acenteler ve adayın profilinden tamamen bağımsız.
import { useState, useRef } from 'react';

const INK = '#1b2533';
const GOLD = '#c2a25a';

// Chip listesi: ekle/çıkar
function ChipList({ items, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item) => (
          <span key={item} style={chipStyle}>
            {item}
            <button onClick={() => onChange(items.filter((x) => x !== item))} style={chipXStyle}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          style={inputStyle}
        />
        <button onClick={add} style={addBtnStyle}>Ekle</button>
      </div>
    </div>
  );
}

// İş deneyimi listesi
function ExpList({ items, onChange }) {
  const add = () => onChange([...items, { date: '', company: '', position: '' }]);
  const update = (i, patch) => onChange(items.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((exp, i) => (
        <div key={i} style={{ background: '#f4f5f7', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, position: 'relative' }}>
          <button onClick={() => remove(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#a32d2d', fontWeight: 700, fontSize: 14 }}>✕</button>
          <input value={exp.date || ''} onChange={(e) => update(i, { date: e.target.value })} placeholder="Tarih (ör. 04.2024 – 10.2024)" style={inputStyle} />
          <input value={exp.company || ''} onChange={(e) => update(i, { company: e.target.value })} placeholder="Şirket / Otel" style={inputStyle} />
          <input value={exp.position || ''} onChange={(e) => update(i, { position: e.target.value })} placeholder="Pozisyon" style={inputStyle} />
        </div>
      ))}
      <button onClick={add} style={{ ...addBtnStyle, alignSelf: 'flex-start' }}>+ Deneyim Ekle</button>
    </div>
  );
}

export default function CvOverrideEditor({ base, overrides, onChange, onClear, onClose, hasOverrides }) {
  // Tüm alanlar: override varsa override, yoksa base'den al
  const merged = { ...base, ...overrides };

  const set = (patch) => onChange({ ...overrides, ...patch });

  // Alan bazlı reset (sadece o alanı override'dan sil)
  const resetField = (field) => {
    const next = { ...overrides };
    delete next[field];
    onChange(next);
  };

  const fieldChanged = (field) => field in overrides;

  return (
    <div style={panelStyle}>
      {/* Başlık */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>CV Düzenle</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Yalnızca sizin görünümünüzü etkiler</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasOverrides && (
            <button onClick={onClear} style={clearBtnStyle} title="Orijinale dön">Orijinale dön</button>
          )}
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
      </div>
      <div style={{ height: 2, background: GOLD }} />

      {/* İçerik */}
      <div style={bodyStyle}>

        {/* Ünvan */}
        <Section label="Ünvan / Alan" changed={fieldChanged('title')} onReset={() => resetField('title')}>
          <input
            value={merged.title || ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="ör. Misafir İlişkileri · Resepsiyon"
            style={inputStyle}
          />
        </Section>

        {/* Profil özeti */}
        <Section label="Profil Özeti" changed={fieldChanged('profile')} onReset={() => resetField('profile')}>
          <textarea
            value={merged.profile || ''}
            onChange={(e) => set({ profile: e.target.value })}
            placeholder="Aday hakkında kısa bir özet..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Section>

        {/* Pozisyonlar */}
        <Section label="Pozisyonlar" changed={fieldChanged('positions')} onReset={() => resetField('positions')}>
          <ChipList
            items={merged.positions || []}
            onChange={(v) => set({ positions: v })}
            placeholder="Yeni pozisyon..."
          />
        </Section>

        {/* Beceriler */}
        <Section label="Beceriler" changed={fieldChanged('skills')} onReset={() => resetField('skills')}>
          <ChipList
            items={merged.skills || []}
            onChange={(v) => set({ skills: v })}
            placeholder="Yeni beceri..."
          />
        </Section>

        {/* Sertifikalar */}
        <Section label="Sertifikalar" changed={fieldChanged('certificates')} onReset={() => resetField('certificates')}>
          <ChipList
            items={merged.certificates || []}
            onChange={(v) => set({ certificates: v })}
            placeholder="ör. ServSafe — 2024"
          />
        </Section>

        {/* İş Deneyimi */}
        <Section label="İş Deneyimi" changed={fieldChanged('experience')} onReset={() => resetField('experience')}>
          <ExpList
            items={merged.experience || []}
            onChange={(v) => set({ experience: v })}
          />
        </Section>

      </div>
    </div>
  );
}

function Section({ label, changed, onReset, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontWeight: 700, fontSize: 13, color: INK, display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {changed && <span style={{ fontSize: 11, background: GOLD, color: INK, borderRadius: 6, padding: '1px 7px', fontWeight: 700 }}>düzenlendi</span>}
        </label>
        {changed && (
          <button onClick={onReset} style={{ fontSize: 11, color: '#a32d2d', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            geri al
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// --- Stiller ---
const panelStyle = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
  background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.13)',
  display: 'flex', flexDirection: 'column', zIndex: 300,
  fontFamily: 'Inter, system-ui, sans-serif',
};
const headerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px', borderBottom: '1px solid #eee',
};
const bodyStyle = {
  flex: 1, overflowY: 'auto', padding: '20px',
};
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #ddd', borderRadius: 9, padding: '9px 12px',
  fontSize: 13.5, color: INK, outline: 'none', background: '#fafafa',
};
const addBtnStyle = {
  background: INK, color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
};
const clearBtnStyle = {
  background: '#fff3f3', color: '#a32d2d', border: '1px solid #f5c6c6',
  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const closeBtnStyle = {
  background: '#f4f5f7', border: 'none', borderRadius: 8,
  padding: '6px 12px', fontSize: 15, cursor: 'pointer', fontWeight: 700, color: INK,
};
const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: '#eef0f4', borderRadius: 20, padding: '4px 10px',
  fontSize: 13, color: INK, fontWeight: 600,
};
const chipXStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#888', fontSize: 12, padding: 0, lineHeight: 1,
};
