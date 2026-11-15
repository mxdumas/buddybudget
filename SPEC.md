# BuddyBudget — Spec

Petite PWA, inspirée de TravelSpend, pour suivre le budget de voyage de mon fils. Vocabulaire : voir [GLOSSARY.md](GLOSSARY.md).

## Utilisation

- Un seul utilisateur (le parent), sur un téléphone Android. Pas de compte, pas de synchro.
- PWA installable, qui marche hors-ligne. Données stockées sur l'appareil (localStorage).
- Hébergée sur GitHub Pages (HTTPS, nécessaire pour l'installation).

## Démarrer un Voyage

Il faut saisir les éléments suivants :
- les dates de départ et de retour ;
- le Budget initial, en devise locale ;
- la devise locale et la devise étrangère, parmi CAD, USD et EUR (liste facile à étendre) ;
- le Taux : récupéré automatiquement si on a du réseau, sinon saisi à la main.

## Écran principal

- **Balance** dans les deux devises, l'étrangère en grand. En rouge si elle est négative.
- **Budget/jour prévu** et **Reste/jour**. Le Reste/jour s'affiche en rouge s'il est sous le budget/jour prévu, sans alerte ni blocage.
- Avant le départ : on affiche le budget/jour prévu. Après le retour : on affiche le bilan final (reste ou dépassement).
- La liste des Achats et des Recharges, du plus récent au plus ancien. On peut modifier ou supprimer chacun.
- Le Taux courant, avec la date de sa dernière récupération et un bouton pour le forcer à la main.
- Un bouton pour terminer le Voyage (après confirmation).

## Ajouter un Achat / une Recharge

- Il faut saisir un montant, une devise (étrangère par défaut pour un Achat, locale pour une Recharge) et une note facultative.
- La date est automatique.
- L'entrée garde le Taux courant au moment de la saisie. Elle n'est jamais recalculée ensuite.

## Taux de change

- Source : l'API Frankfurter (taux BCE, gratuite, sans clé).
- On essaie de récupérer le taux au démarrage de l'app, s'il y a du réseau. En cas d'échec, on garde le dernier Taux connu.
- Un Taux forcé à la main remplace le courant jusqu'à la prochaine récupération réussie.

## Calculs

- Montant d'une entrée en devise locale : il est converti avec le Taux de l'entrée.
- Balance (locale) = Budget initial + Σ Recharges − Σ Achats. La Balance étrangère = Balance locale × Taux courant.
- Nombre de jours = (retour − départ) + 1.
- Budget/jour prévu = (Budget initial + Σ Recharges) ÷ nombre de jours.
- Reste/jour = Balance ÷ jours restants (aujourd'hui inclus ; avant le départ, on compte tous les jours).

## Hors périmètre

Catégories, plusieurs Voyages ou historique, synchro entre appareils, frais bancaires, export.
