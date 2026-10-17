import { useState } from 'react';
import type { MeasurementRecord } from '../core/types';
import { formatNumber } from '../core/numbers';
import { emailBody, mailtoLink, toTSV } from '../data/export';
import { Detail, Icon, Inspection, Result } from './components';
export function History({
  records,
  loading,
  onDelete,
  onClear,
  notify,
}: {
  records: MeasurementRecord[];
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
  onClear: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [opened, setOpened] = useState<MeasurementRecord | null>(null),
    [section, setSection] = useState('result');
  const [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [fallback, setFallback] = useState<{ text: string; kind: 'tsv' | 'email' } | null>(null);
  const [confirm, setConfirm] = useState<'all' | string | null>(null),
    [confirmText, setConfirmText] = useState(''),
    [busy, setBusy] = useState(false);
  const chosen = records.filter((r) => selected.includes(r.id));
  async function copy(text: string, kind: 'tsv' | 'email') {
    try {
      await navigator.clipboard.writeText(text);
      notify(kind === 'tsv' ? 'TSV zkopírováno pro Excel.' : 'Text e-mailu zkopírován.');
    } catch {
      setFallback({ text, kind });
    }
  }
  function sendEmail() {
    const link = mailtoLink(chosen);
    if (link.length > 1800) {
      setFallback({ text: emailBody(chosen), kind: 'email' });
      return;
    }
    window.location.href = link;
  }
  async function remove() {
    setBusy(true);
    try {
      if (confirm === 'all') {
        await onClear();
        setSelected([]);
        setOpened(null);
      } else if (confirm) {
        await onDelete(confirm);
        setSelected((ids) => ids.filter((id) => id !== confirm));
        setOpened(null);
      }
      setConfirm(null);
      notify('Záznamy byly odstraněny.');
    } catch {
      notify('Mazání selhalo. Data zůstala v historii.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {opened ? (
        <>
          <button className="text-button" onClick={() => setOpened(null)}>
            <Icon name="back" /> Zpět na výsledky měření
          </button>
          <div className="page-heading">
            <span className="eyebrow">ULOŽENÉ MĚŘENÍ</span>
            <h1>{opened.input.serial}</h1>
            <p>{opened.localTimestamp}</p>
          </div>
          <div className="segmented" aria-label="Detail uloženého měření">
            {[
              ['result', 'Výsledek'],
              ['inspection', 'Prověřit'],
              ['detail', 'Data / detail'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={section === key ? 'active' : ''}
                onClick={() => setSection(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {section === 'result' ? (
            <Result diagnosis={opened.diagnosis} serial={opened.input.serial} />
          ) : section === 'inspection' ? (
            <Inspection diagnosis={opened.diagnosis} />
          ) : (
            <Detail record={opened} />
          )}
          <button
            className="button danger secondary"
            onClick={() => {
              setConfirm(opened.id);
              setConfirmText('');
            }}
          >
            <Icon name="trash" /> Smazat toto měření
          </button>
        </>
      ) : (
        <>
          <div className="page-heading">
            <span className="eyebrow">LOKÁLNÍ HISTORIE</span>
            <h1>Výsledky měření</h1>
            <p>{records.length} uložených měření · pouze v tomto zařízení</p>
          </div>
          <div className="history-toolbar">
            <button
              className="button secondary"
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
              disabled={!records.length}
            >
              <Icon name="share" />
              {selecting ? 'Zrušit výběr' : 'SDÍLET'}
            </button>
            {records.length > 0 && (
              <button
                className="icon-button danger"
                aria-label="Smazat celou historii"
                onClick={() => {
                  setConfirm('all');
                  setConfirmText('');
                }}
              >
                <Icon name="trash" />
              </button>
            )}
          </div>
          {selecting && (
            <section className="selection-panel">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selected.length === records.length && records.length > 0}
                  onChange={(e) => setSelected(e.target.checked ? records.map((r) => r.id) : [])}
                />{' '}
                Vybrat všechna
              </label>
              <strong>Vybráno: {chosen.length}</strong>
            </section>
          )}
          {loading ? (
            <p role="status">Načítám historii…</p>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <Icon name="list" size={38} />
              <h2>Zatím žádná měření</h2>
              <p>
                Po vyhodnocení zvolte ULOŽIT MĚŘENÍ.
                <br />
                Záznamy zůstanou dostupné i offline.
              </p>
            </div>
          ) : (
            <div className="history-list">
              {records.map((r) => (
                <article
                  key={r.id}
                  className={`history-item ${selected.includes(r.id) ? 'selected' : ''}`}
                >
                  {selecting && (
                    <label className="record-checkbox">
                      <input
                        aria-label={`Vybrat měření ${r.input.serial}`}
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </label>
                  )}
                  <button
                    className="record-open"
                    onClick={() => {
                      setOpened(r);
                      setSection('result');
                    }}
                  >
                    <div className="record-top">
                      <strong>{r.input.serial}</strong>
                      <Icon name="arrow" size={18} />
                    </div>
                    <time dateTime={r.savedAt}>{r.localTimestamp}</time>
                    <div className="record-values">
                      <span>
                        Kyoritsu <b>{formatNumber(r.input.kyoritsu)} kW</b>
                      </span>
                      <span>
                        Energis <b>{formatNumber(r.input.energis)} kW</b>
                      </span>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}
          {selecting && (
            <div className="share-actions card">
              <p className="hint">Sdílí se jen naměřené hodnoty. Diagnostika zůstává v aplikaci.</p>
              <button className="button primary" disabled={!chosen.length} onClick={sendEmail}>
                <Icon name="mail" /> ODESLAT E-MAILEM
              </button>
              <button
                className="button secondary"
                disabled={!chosen.length}
                onClick={() => void copy(toTSV(chosen), 'tsv')}
              >
                <Icon name="copy" /> KOPÍROVAT PRO EXCEL
              </button>
              <p className="hint">
                TSV bez hlavičky, 16 sloupců. Pro zachování počátečních nul nastavte první sloupec
                Excelu jako text.
              </p>
            </div>
          )}
        </>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <Icon name="trash" size={30} />
            <h2 id="delete-title">
              {confirm === 'all' ? 'Smazat celou historii?' : 'Smazat měření?'}
            </h2>
            <p>
              Tuto akci nelze vrátit.{' '}
              {confirm === 'all'
                ? `Odstraníte všech ${records.length} záznamů. Nejdříve si data exportujte.`
                : 'Uložený záznam bude trvale odstraněn z tohoto zařízení.'}
            </p>
            {confirm === 'all' && (
              <label className="field">
                <span>Pro potvrzení napište SMAZAT</span>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            <button
              className="button danger filled"
              disabled={busy || (confirm === 'all' && confirmText !== 'SMAZAT')}
              onClick={() => void remove()}
            >
              {busy ? 'Mažu…' : 'Trvale smazat'}
            </button>
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>
              Zrušit
            </button>
          </section>
        </div>
      )}
      {fallback && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <h2 id="export-title">
              {fallback.kind === 'email' ? 'Text e-mailu' : 'Data pro Excel'}
            </h2>
            <p>
              {fallback.kind === 'email'
                ? 'Pro větší výběr nebo pokud se e-mail neotevře: zkopírujte text, otevřete poštu a vložte jej do těla zprávy. Příjemce vyplníte sami.'
                : 'Automatické kopírování není dostupné. Označte a zkopírujte celý text.'}
            </p>
            <textarea
              aria-label="Text pro ruční zkopírování"
              readOnly
              value={fallback.text}
              onFocus={(e) => e.target.select()}
              rows={9}
            />
            <button
              className="button secondary"
              onClick={() => void copy(fallback.text, fallback.kind)}
            >
              <Icon name="copy" /> Kopírovat text
            </button>
            {fallback.kind === 'email' && (
              <a className="button primary" href="mailto:?subject=Nam%C4%9B%C5%99en%C3%A1%20data">
                Otevřít e-mailovou aplikaci
              </a>
            )}
            <button className="button secondary" onClick={() => setFallback(null)}>
              Zavřít
            </button>
          </section>
        </div>
      )}
      {selecting && chosen.length > 0 && (
        <button
          className="text-button fallback-link"
          onClick={() => setFallback({ text: emailBody(chosen), kind: 'email' })}
        >
          E-mail se neotevřel? Zobrazit text pro ruční vložení
        </button>
      )}
    </>
  );
}
