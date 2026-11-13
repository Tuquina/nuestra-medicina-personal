import type { ToolEntriesStore } from '../../hooks/useToolEntries';

interface SaveStatusProps {
  store: ToolEntriesStore;
  /** When the shown entry was last saved (ISO). Nothing is shown before the first save. */
  at?: string;
}

const timeFormat = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Guardado en tu cuenta a las 19:52", "Guardando…", or an unsaved warning. */
export function SaveStatus({ store, at }: SaveStatusProps) {
  if (!at) return null;
  if (store.saveStatus === 'error') {
    return (
      <>
        {store.mode === 'account'
          ? 'Sin guardar todavía: reintentando'
          : 'Sin guardar: descargalo antes de cerrar la página'}
      </>
    );
  }
  if (store.mode === 'account' && store.saveStatus === 'saving') return <>Guardando…</>;
  const where = store.mode === 'account' ? 'en tu cuenta' : 'en este navegador';
  return (
    <>
      Guardado {where} a las {timeFormat.format(new Date(at))}
    </>
  );
}
