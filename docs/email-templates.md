# Testi delle email di YouCount (Supabase → Authentication → Emails)

Si incollano dopo aver attivato l'SMTP. In ogni modello: **Subject** nel campo dell'oggetto, il blocco HTML nel corpo.
Il link `{{ .ConfirmationURL }}` va lasciato così: l'app lo gestisce su `/auth/callback`.
Bilingue (italiano e francese), perché all'invio non si sa ancora la lingua di chi riceve.

## Invite user

**Subject:** `Invito a YouCount · Invitation à YouCount`

```html
<div style="font-family:Arial,sans-serif;font-size:15px;color:#16324F;max-width:520px">
  <p><b>YouCount</b> · YouSud ODV</p>
  <p>Ciao, sei stato invitato a usare YouCount, la contabilità di YouSud. Apri il link e scegli la tua password.</p>
  <p>Bonjour, vous êtes invité à utiliser YouCount, la comptabilité de YouSud. Ouvrez le lien et choisissez votre mot de passe.</p>
  <p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#44546A;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Accetta l'invito · Accepter l'invitation</a></p>
  <p style="color:#5B6472;font-size:13px">Il link si usa una sola volta e scade dopo un po': se non funziona, chiedi un nuovo invito. · Le lien ne sert qu'une fois et expire : s'il ne marche pas, demandez une nouvelle invitation.</p>
</div>
```

## Reset password

**Subject:** `Nuova password YouCount · Nouveau mot de passe YouCount`

```html
<div style="font-family:Arial,sans-serif;font-size:15px;color:#16324F;max-width:520px">
  <p><b>YouCount</b> · YouSud ODV</p>
  <p>Hai chiesto di cambiare la password. Apri il link e scegline una nuova.</p>
  <p>Vous avez demandé à changer de mot de passe. Ouvrez le lien et choisissez-en un nouveau.</p>
  <p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#44546A;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Scegli la nuova password · Choisir le nouveau mot de passe</a></p>
  <p style="color:#5B6472;font-size:13px">Se non l'hai chiesto tu, ignora questa email. · Si ce n'est pas vous, ignorez cet e-mail.</p>
</div>
```
