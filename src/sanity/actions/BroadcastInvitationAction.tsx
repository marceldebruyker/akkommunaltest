import { useState } from 'react';
import type { DocumentActionComponent } from 'sanity';

export const BroadcastInvitationAction: DocumentActionComponent = (props) => {
  const [isSending, setIsSending] = useState(false);
  const { type, draft, published } = props;

  // Der Button erscheint nur bei Seminaren
  if (type !== 'seminar') {
    return null;
  }

  return {
    label: isSending ? '✉️ Sende Mails...' : '✉️ Formelle Einladung senden',
    onHandle: async () => {
      // 1. Password Protection directly in Studio
      const pw = window.prompt("Sicherheitsabfrage: Bitte das Admin-Passwort für den Massenversand eingeben:");
      if (!pw) return; // User cancelled
      
      if (pw !== 'kommunal-einladung-2026!') {
        window.alert("Zugriff verweigert: Falsches Administratoren-Passwort.");
        return;
      }

      const rawId = published?._id || draft?._id;
      if (!rawId) {
         window.alert("Fehler: Dokument muss erst gespeichert werden!");
         return;
      }
      const validId = rawId.replace('drafts.', '');

      setIsSending(true);

      try {
        const response = await fetch('/api/admin/broadcast-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            seminarId: validId,
            password: pw,
            emailType: 'ticket_invitation' // Hier spezifizieren wir den E-Mail Typ!
          }),
        });

        const data = await response.json();

        if (response.ok) {
          window.alert("✅ Erfolgreich: " + (data.message || "Die formellen Einladungen wurden versendet."));
        } else {
          window.alert("❌ Fehler beim Versand: " + (data.error || "Unbekannter Fehler"));
        }
      } catch (err: any) {
        window.alert("❌ Netzwerkfehler: " + err.message);
      } finally {
        setIsSending(false);
      }
    }
  };
};
