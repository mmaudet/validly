# Phase 10: Améliorer gestion demandes et UX - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the workflow management experience and overall UX of Validly: better action confirmation flow for validators, enriched workflow detail page, improved dashboard with filters and notifications, initiator email notifications, deadline reminders, workflow cancellation, and user/role administration (CRUD).

</domain>

<decisions>
## Implementation Decisions

### Page de confirmation action (validateur)
- Résumé complet avant soumission : titre workflow, document(s), étape, initiateur, puis champ commentaire + bouton confirmer
- Commentaire obligatoire pour approuver ET refuser
- Pages d'erreur (token expiré/utilisé/invalide) : message clair + lien vers le dashboard

### Suivi des workflows (page détail)
- Stepper horizontal pour visualiser la progression phase par phase, avec détail au clic
- Détail complet par étape : validateurs, qui a agi, commentaires, date d'action, règle de quorum, deadline
- Actions initiateur : annuler un workflow en cours + relancer les notifications manuellement
- Documents attachés : liste avec preview en ligne (PDF.js) et lien de téléchargement

### Dashboard et navigation
- Organisation en deux onglets : « Mes demandes » et « À valider » (amélioration de l'existant)
- Vue tableau structuré avec colonnes (titre, statut, date, étape courante) et tri/filtre
- Filtres complets : statut + date + recherche texte (titre) + initiateur
- Badge numérique sur l'onglet « À valider » + icône notification dans le header

### Emails et notifications
- Email à l'initiateur à chaque action d'un validateur (approbation ou refus)
- Email dédié à l'initiateur quand le workflow est terminé (approuvé ou refusé globalement)
- Contenu des emails validateur : actuel OK (titre workflow, étape, initiateur, boutons)
- Activer les relances automatiques avant deadline (ex: 24h avant expiration)

### Gestion des utilisateurs et rôles
- 3 rôles : admin (gère les utilisateurs), initiateur (crée des workflows), validateur (reçoit les demandes)
- Admin crée/modifie/supprime les utilisateurs et affecte les rôles
- Tous les utilisateurs peuvent voir la liste des utilisateurs (pour choisir des validateurs)
- CRUD complet pour la gestion des comptes utilisateur

### Claude's Discretion
- Comportement après soumission de l'action (message inline vs redirection)
- Design exact du stepper horizontal
- Exact loading states et skeleton screens
- Implémentation technique des relances (BullMQ scheduler)

</decisions>

<specifics>
## Specific Ideas

- L'annulation d'un workflow doit être confirmée (dialog de confirmation)
- La relance de notifications = renvoyer les emails aux validateurs en attente sur l'étape courante
- Les relances automatiques doivent respecter le fuseau horaire configuré

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-am-liorer-gestion-demandes-et-ux*
*Context gathered: 2026-02-19*
