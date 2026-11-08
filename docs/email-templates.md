# Testi delle email di YouCount (Supabase → Authentication → Emails)

Si incollano dopo aver attivato l'SMTP. In ogni modello: **Subject** nel campo dell'oggetto, il blocco HTML nel corpo.

Il link punta all'app (`https://youcount-gold.vercel.app/auth/callback?token_hash=…&type=…`), non all'indirizzo
`…supabase.co`: i filtri antispam non lo scambiano per phishing, e il link viene confermato solo quando la persona apre
davvero la pagina (l'app lo verifica con JavaScript), quindi un antispam che "apre" i link per controllarli non lo consuma.
Un solo link, niente immagini: meno probabilità di finire in spam. Bilingue (italiano e francese).

## Invite user

**Subject:** `Invito a YouCount · Invitation à YouCount`

```html
<div style="font-family:Arial,sans-serif;font-size:15px;color:#16324F;max-width:520px">
  <p>YouCount · YouSud ODV</p>
  <p>Ciao, sei stato invitato a usare YouCount, la contabilità di YouSud. Apri il link e scegli la tua password.</p>
  <p>Bonjour, vous êtes invité à utiliser YouCount, la comptabilité de YouSud. Ouvrez le lien et choisissez votre mot de passe.</p>
  <p><a href="https://youcount-gold.vercel.app/auth/callback?token_hash={{ .TokenHash }}&type=invite">https://youcount-gold.vercel.app · Accetta l'invito / Accepter l'invitation</a></p>
  <p style="color:#5B6472;font-size:13px">Il link si usa una sola volta. Se non funziona, chiedi un nuovo invito. · Le lien ne sert qu'une fois. S'il ne marche pas, demandez une nouvelle invitation.</p>
</div>
```

## Reset password

**Subject:** `Nuova password YouCount · Nouveau mot de passe YouCount`

```html
<div style="font-family:Arial,sans-serif;font-size:15px;color:#16324F;max-width:520px">
  <p>YouCount · YouSud ODV</p>
  <p>Hai chiesto di cambiare la password. Apri il link e scegline una nuova.</p>
  <p>Vous avez demandé à changer de mot de passe. Ouvrez le lien et choisissez-en un nouveau.</p>
  <p><a href="https://youcount-gold.vercel.app/auth/callback?token_hash={{ .TokenHash }}&type=recovery">https://youcount-gold.vercel.app · Nuova password / Nouveau mot de passe</a></p>
  <p style="color:#5B6472;font-size:13px">Se non l'hai chiesto tu, ignora questa email. · Si ce n'est pas vous, ignorez cet e-mail.</p>
</div>
```

## Nota

Il mittente Gmail resta un ripiego: la soluzione definitiva è un mittente con dominio yousud.it (SPF/DKIM),
da fare dopo i test (vedi DEPLOY.md, "Da fare prima del lancio al team").
