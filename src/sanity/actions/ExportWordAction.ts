import type { DocumentActionComponent } from 'sanity';

export const ExportWordAction: DocumentActionComponent = (props) => {
  const { type, draft, published } = props;

  // Der Button erscheint nur bei Seminaren
  if (type !== 'seminar') {
    return null;
  }

  return {
    label: '📄 Als Word exportieren',
    onHandle: () => {
      // We need the published ID (or draft if we want to preview it, but strictly we use published slug or raw ID)
      // Since our API queries by `slug.current`, we need to get the slug from the document.
      // `published` or `draft` hold the document fields!
      const doc = published || draft;
      const slug = doc?.slug?.current;
      
      if (!slug) {
         window.alert("Fehler: Dokument muss erst gespeichert und ein gültiger Slug generiert werden!");
         return;
      }

      // 1. Wir rufen einfach die URL mit target="_blank" auf, da der Browser
      // die Datei dank "Content-Disposition: attachment" direkt herunterlädt, 
      // anstatt eine neue Seite zu öffnen. Das ist super minimalistisch.
      window.open(`/api/admin/export-word?id=${slug}`, '_blank');
      
      // Optional: Give UI feedback if desired, but Sanity auto-closes the menu when action handles.
      props.onComplete();
    }
  };
};
