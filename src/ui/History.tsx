import { BackButton } from './BackButton';
import { readingSummary } from '../series/grouping';
import { resultRows } from './resultsView';
import { Series } from '../series/Series';
import { createSeriesStore } from '../series/store';
import { emptySeries } from '../series/model';
import { formatIntervalDateTime } from '../core/historyView';
import { Comparisons } from './Comparisons';
import { Info } from './Info';
import { downloadJSONBackup, parseBackup, planImport } from '../data/backup';
import { isIntervalCheck, intervalLabel } from '../core/historyView';
import { IntervalResult } from './Interval';
import { CurrentResult } from './CurrentMeasurement';
import { IdentificationSummary } from './Identification';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryRecord } from '../core/types';
import { shareSubject, emailBody, mailtoLink, toTSV, isCurrent, backupTSV } from '../data/export';
import { Detail, Icon, Inspection, Result } from './components';
export function History({
  records,
  loading,
  onDelete,
  onClear,
  onImport,
  notify,
}: {
  records: HistoryRecord[];
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
  onClear: () => Promise<void>;
  onImport: (records: HistoryRecord[]) => Promise<{ added: number; existing: number }>;
  notify: (text: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<HistoryRecord[] | null>(null);
  const [importError, setImportError] = useState('');
  const seriesCount =
    (pending as import('../data/backup').BackupRecords | null)?.seriesData?.readings.length ?? 0;
  const preview = pending ? planImport(records, pending) : null;
  const [opened, setOpened] = useState<HistoryRecord | null>(null),
    [section, setSection] = useState('result');
  const [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [fallback, setFallback] = useState<{ text: string; kind: 'tsv' | 'email' } | null>(null);
  const [confirm, setConfirm] = useState<'all' | string | null>(null),
    [confirmText, setConfirmText] = useState(''),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [batchDetail, setBatchDetail] = useState('');
  const [meterDetail, setMeterDetail] = useState('');
  const [browseSeries, setBrowseSeries] = useState(false);
  const retainedReading = useRef<{ key: string; detail: string; batch: string } | null>(null);
  const readingActive = !!(meterDetail || batchDetail || browseSeries);
  if (readingActive)
    retainedReading.current = {
      key: meterDetail || batchDetail || 'history',
      detail: meterDetail,
      batch: batchDetail,
    };

  const [series, setSeries] = useState(emptySeries);
  const seriesRepo = useMemo(() => createSeriesStore(), []);
  useEffect(() => {
    const refresh = () => {
      void seriesRepo
        .all()
        .then(setSeries)
        .catch((e) => setImportError(String(e)));
    };
    refresh();
    window.addEventListener('series-updated', refresh);
    return () => {
      window.removeEventListener('series-updated', refresh);
      void seriesRepo.close();
    };
  }, [seriesRepo]);
  const visible = resultRows(records, series, search);
  const groups = [
    { label: 'ODEČTOVÉ SÉRIE', rows: visible.filter((r) => r.batchId) },
    { label: 'SAMOSTATNÉ ODEČTY', rows: visible.filter((r) => r.meterId) },
    { label: 'MĚŘENÍ', rows: visible.filter((r) => r.record) },
  ];
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
    window.location.href = link;
  }
  async function share() {
    if (!navigator.share) {
      setFallback({ text: emailBody(chosen), kind: 'email' });
      return;
    }
    try {
      const file = new File([backupTSV(chosen)], 'mereni.tsv', {
        type: 'text/tab-separated-values',
      });
      if (chosen.length === 1 && 'kind' in chosen[0] && chosen[0].kind === 'interval-check')
        await navigator.share({ title: shareSubject(chosen), text: emailBody(chosen) });
      else if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: 'Naměřená data' });
      else await navigator.share({ title: 'Naměřená data', text: emailBody(chosen) });
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        setFallback({ text: emailBody(chosen), kind: 'email' });
    }
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
      {retainedReading.current && (
        <div hidden={!readingActive}>
          <Series
            key={retainedReading.current.key}
            historyOnly
            initialDetail={retainedReading.current.detail}
            initialBatch={retainedReading.current.batch}
            onBack={() => {
              setMeterDetail('');
              setBatchDetail('');
              setBrowseSeries(false);
            }}
          />
        </div>
      )}
      {readingActive ? null : opened ? (
        <>
          <BackButton onBack={() => setOpened(null)} />
          <div className="page-heading">
            <span className="eyebrow">ULOŽENÉ MĚŘENÍ</span>
            <h1>
              UZEL{' '}
              {(opened.input.identification as { node?: string } | undefined)?.node || 'neuveden'}
            </h1>
            <p>{isIntervalCheck(opened) ? intervalLabel(opened) : opened.localTimestamp}</p>
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
          <IdentificationSummary
            serial={opened.input.serial}
            value={opened.input.identification}
            fallback={opened.localTimestamp}
            temporalLabel={
              isIntervalCheck(opened) ? `Interval: ${intervalLabel(opened)}` : undefined
            }
          />
          {!isIntervalCheck(opened) && !isCurrent(opened) && (
            <>
              <Comparisons record={opened} />
              {section === 'detail' && opened.input.stateCheck && (
                <IntervalResult record={opened.input.stateCheck} section="detail" />
              )}
            </>
          )}
          {isIntervalCheck(opened) ? (
            <IntervalResult record={opened} section={section} />
          ) : isCurrent(opened) ? (
            <CurrentResult record={opened} section={section} />
          ) : section === 'result' ? (
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
            <p>{readingSummary(series)}</p>
          </div>
          <label className="field">
            <span>Hledat ve všech výsledcích a odečtech</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button className="button secondary" onClick={() => setBrowseSeries(true)}>
            Historie odečtů · výběr pro další odečet / export
          </button>
          <div className="history-toolbar">
            <button
              className="button secondary"
              disabled={loading || busy}
              onClick={() =>
                void downloadJSONBackup(records).catch((e) => setImportError((e as Error).message))
              }
            >
              ZÁLOHOVAT DATA
            </button>
            <Info label="záloha dat">
              Uloží kompletní historii měření i odečtové série do souboru. Soubor lze později použít
              k obnovení dat.
            </Info>
            <button
              className="button secondary"
              disabled={loading || busy}
              onClick={() => fileInput.current?.click()}
            >
              IMPORTOVAT / OBNOVIT DATA
            </button>
            <input
              ref={fileInput}
              type="file"
              aria-label="IMPORTOVAT / OBNOVIT DATA"
              accept=".json,application/json"
              disabled={loading || busy}
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                setImportError('');
                setPending(null);
                if (!file) return;
                try {
                  setPending(parseBackup(await file.text()));
                } catch (error) {
                  setImportError((error as Error).message);
                }
              }}
            />
            <Info label="import dat">
              Načte zálohu a doplní chybějící záznamy. Existující měření se automaticky nemažou.
            </Info>
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
          ) : records.length === 0 && series.meters.length === 0 ? (
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
              {visible.length === 0 && <p>Žádné záznamy neodpovídají filtrům.</p>}
              {groups.map(({ label, rows }) => (
                <section key={label} aria-label={label} className="reading-history-section">
                  <h2>{label}</h2>
                  {rows.length === 0 && <p>Žádné položky.</p>}
                  {rows.map((row) => (
                    <article
                      key={row.id}
                      className={`history-item compact-result ${selected.includes(row.id) ? 'selected' : ''}`}
                    >
                      {selecting && row.record && (
                        <label className="record-checkbox">
                          <input
                            aria-label={`Vybrat měření ${row.record.input.serial}`}
                            type="checkbox"
                            checked={selected.includes(row.id)}
                            onChange={(e) =>
                              setSelected((ids) =>
                                e.target.checked
                                  ? [...ids, row.id]
                                  : ids.filter((id) => id !== row.id),
                              )
                            }
                          />
                        </label>
                      )}
                      <button
                        className="record-open"
                        data-serial={row.record?.input.serial}
                        data-type={
                          row.record
                            ? isIntervalCheck(row.record)
                              ? 'Kontrola stavů'
                              : isCurrent(row.record)
                                ? '1f měření'
                                : '3f měření'
                            : 'odečet'
                        }
                        aria-label={`${row.search}`}
                        onClick={() => {
                          if (row.record) {
                            setOpened(row.record);
                            setSection('result');
                          } else if (row.batchId) setBatchDetail(row.batchId);
                          else setMeterDetail(row.meterId!);
                        }}
                      >
                        {row.batchId ? (
                          <>
                            <span>{formatIntervalDateTime(row.at)}</span>
                            <span>{row.location}</span>
                            <span>série {row.meterCount} vývodů</span>
                          </>
                        ) : (
                          <>
                            <span>{row.node || 'UZEL neuveden'}</span>
                            <span>{formatIntervalDateTime(row.at)}</span>
                            <span>
                              {row.location} · {row.placement}
                              {row.meterId && (
                                <> · EM {series.meters.find((m) => m.id === row.meterId)?.serial}</>
                              )}
                            </span>
                          </>
                        )}
                      </button>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
          {selecting && (
            <div className="share-actions card">
              <p className="hint">
                Sdílí se vybrané záznamy. Kontrola stavů obsahuje také výsledek a doporučení.
              </p>
              <button
                className="button primary"
                disabled={!chosen.length}
                onClick={() => void share()}
              >
                SDÍLET SYSTÉMOVĚ
              </button>
              <button className="button secondary" disabled={!chosen.length} onClick={sendEmail}>
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
                TSV bez hlavičky: jeden záznam na řádek. Číslo elektroměru nastavte v Excelu jako
                text pro zachování počátečních nul. Záloha obsahuje společnou hlavičku i pro různé
                režimy.
              </p>
            </div>
          )}
        </>
      )}
      {importError && (
        <p className="notice error" role="alert">
          {importError}
        </p>
      )}
      {preview && pending && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <h2 id="import-title">Obnova historie</h2>
            <p>Soubor obsahuje {preview.total} záznamů</p>
            <p>Odečty v sériích: {seriesCount}</p>
            <p>Nové: {preview.added}</p>
            <p>Již existující: {preview.existing}</p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await onImport(pending);
                  window.dispatchEvent(new Event('series-updated'));
                  setPending(null);
                  notify(
                    `Import dokončen. Přidáno: ${result.added}, již existující: ${result.existing}.`,
                  );
                } catch (error) {
                  setPending(null);
                  setImportError(`Obnova selhala. ${(error as Error).message}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              IMPORTOVAT
            </button>
            <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>
              ZRUŠIT
            </button>
          </section>
        </div>
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
              <a className="button primary" href={mailtoLink(chosen)}>
                Otevřít e-mailovou aplikaci
              </a>
            )}
            <BackButton onBack={() => setFallback(null)} />
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
