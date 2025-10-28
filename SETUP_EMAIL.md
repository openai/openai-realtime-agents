# Configuration de l'envoi d'emails

Ce guide explique comment configurer l'envoi d'emails réels pour les demandes de rappel.

## 📦 Installation de Nodemailer

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## 🔧 Configuration

### Option 1: Gmail (recommandé pour tester)

1. **Créer un App Password Gmail**:
   - Allez sur https://myaccount.google.com/apppasswords
   - Connectez-vous à votre compte Google
   - Sélectionnez "Mail" et "Autre (nom personnalisé)"
   - Entrez "Grand Chasseral Immo Assistant"
   - Copiez le mot de passe généré (16 caractères)

2. **Configurer `.env`**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=votre-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # App Password de l'étape 1
   ```

### Option 2: Outlook/Office365

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=votre-email@outlook.com
SMTP_PASS=votre-mot-de-passe
```

### Option 3: Serveur SMTP personnalisé

```env
SMTP_HOST=smtp.votre-domaine.com
SMTP_PORT=587
SMTP_USER=contact@votre-domaine.com
SMTP_PASS=votre-mot-de-passe
```

## 🚀 Utilisation

Une fois configuré, l'agent `contactHumanAgent` enverra automatiquement des emails réels quand:
- Un client demande à contacter un collaborateur
- Le collaborateur n'est pas disponible
- Le client accepte d'envoyer un email de rappel

### Exemple de flux

```
User: "Je voudrais parler à Sandy Bircher"
Agent: [vérifie disponibilité]
Agent: "Sandy Bircher n'est pas disponible actuellement. 
       Puis-je vous proposer de lui envoyer un email pour qu'elle vous rappelle ?"
User: "Oui, s'il vous plaît"
Agent: "Parfait ! J'ai besoin de votre nom, numéro de téléphone, email et un bref message."
User: "Je m'appelle Jean Dupont, mon numéro est 079 123 45 67, 
       email jean.dupont@example.com, je souhaite discuter d'un appartement à louer"
Agent: [appelle sendCallbackRequest]
       → Email envoyé à sandy.bircher@regiedelatrame.ch
       → Copie envoyée à jean.dupont@example.com
Agent: "Votre demande de rappel a été envoyée par email à Sandy Bircher. 
       Vous serez contacté au 079 123 45 67 dans les plus brefs délais."
```

## 📧 Format de l'email envoyé

**À**: sandy.bircher@regiedelatrame.ch  
**Cc**: jean.dupont@example.com  
**Sujet**: Demande de rappel - Jean Dupont

```
Bonjour Sandy Bircher,

Vous avez reçu une demande de rappel via l'assistant vocal Grand Chasseral Immo SA.

📋 Informations du client:
- Nom: Jean Dupont
- Téléphone: 079 123 45 67
- Email: jean.dupont@example.com

💬 Message:
Je souhaite discuter d'un appartement à louer

Merci de contacter ce client dans les plus brefs délais.
```

## 🔒 Sécurité

- ✅ Ne commitez **JAMAIS** votre fichier `.env` (déjà dans `.gitignore`)
- ✅ Utilisez des App Passwords, pas vos mots de passe principaux
- ✅ Les emails sont envoyés côté serveur (Next.js API), jamais côté client
- ✅ Le client reçoit une copie de l'email pour confirmation

## 🧪 Test

Pour tester l'envoi d'email:

1. Installez les dépendances
2. Configurez `.env` avec vos identifiants SMTP
3. Lancez `npm run dev`
4. Connectez-vous au scénario `realEstate`
5. Demandez à contacter un collaborateur
6. Acceptez d'envoyer un email de rappel
7. Vérifiez votre boîte de réception

## ❌ Dépannage

### Erreur: "Invalid login"
- Vérifiez que vous utilisez un App Password (Gmail)
- Vérifiez que l'authentification à 2 facteurs est activée (Gmail)

### Erreur: "Connection timeout"
- Vérifiez votre pare-feu
- Vérifiez que le port 587 est ouvert

### Email non reçu
- Vérifiez les spams
- Vérifiez que l'email du collaborateur est correct dans `constants.ts`
- Vérifiez les logs de la console Next.js

## 🎯 Prochaines étapes

- [ ] Configurer un vrai service d'email professionnel (SendGrid, Mailgun, AWS SES)
- [ ] Ajouter des templates d'email plus sophistiqués
- [ ] Ajouter un système de suivi des demandes de rappel
- [ ] Intégrer avec un CRM
