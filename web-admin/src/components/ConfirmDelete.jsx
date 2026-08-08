export default function ConfirmDelete({ title, text, busy, onCancel, onConfirm }) {
  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="modalActions">
          <button type="button" className="ghostBtn" onClick={onCancel} disabled={busy}>Vazgeç</button>
          <button type="button" className="dangerBtn" onClick={onConfirm} disabled={busy}>
            {busy ? 'Siliniyor…' : 'Evet, sil'}
          </button>
        </div>
      </div>
    </div>
  );
}
