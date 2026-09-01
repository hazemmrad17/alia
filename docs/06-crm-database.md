# Documentation de la Base de Données CRM — VITAL SA

> Source : `Students/Data vital/Documentation de la Base de Données CRM.pdf`
> ORM : Sequelize (Node.js) → converted to SQLAlchemy (Python) in `backend/app/crm/schema.py`

---

## 1. Architecture Générale

Le projet utilise **Sequelize** comme ORM et se connecte à **deux bases de données** :

| Base | Type | Usage |
|------|------|-------|
| **CRM** | MySQL | Données opérationnelles (utilisateurs, visites, prospects, produits) |
| **UNIGES** | MSSQL | Base externe (ERP) pour données synchronisées (établissements, codes postaux) |

---

## 2. Entités Principales

### 2.1 Utilisateurs (Users)

Représente les acteurs du système : commerciaux, délégués, superviseurs.

| Champ | Type | Description |
|-------|------|-------------|
| id | PK | Clé primaire |
| login | String | Identifiant de connexion |
| password / pwd_hashed | String | Authentification |
| Nom, Prenom | String | Identité |
| Email, Tel | String | Contact |
| type | FK → User_Type | Type d'utilisateur |
| role | String | Rôle (admin, user) |
| sup | FK → Users | Supérieur hiérarchique |
| zone, zone2 | Integer | Affectation géographique |

### 2.2 Prospects (Prospect)

Les clients potentiels ou existants : Médecins, Pharmacies, etc.

| Champ | Type | Description |
|-------|------|-------------|
| id | PK | Clé primaire |
| nom, prenom | String | Identité |
| spec | FK → Specialite | Spécialité médicale |
| gouvernorat | FK → Gouvernerat | Localisation |
| delegation | FK → Delegation | Délégation |
| potentiel | FK → Potentiel | Potentiel commercial |
| etablissement | FK → Etablissement | Structure de rattachement |
| activite | FK → Activite | Type d'activité |
| cree_par | FK → Users | Créé par |

### 2.3 Visites (Visite)

Interactions entre un utilisateur et un prospect.

| Champ | Type | Description |
|-------|------|-------------|
| id | PK | Clé primaire |
| id_pros | FK → Prospect | Prospect visité |
| id_visiteur | FK → Users | Utilisateur |
| date_visite | DateTime | Date de l'interaction |
| type | FK → TypeVisite | Type de visite |
| commentaire | Text | Rapport de visite |

### 2.4 Produits (Products)

Catalogue des produits VITAL SA.

| Champ | Type | Description |
|-------|------|-------------|
| id | PK | Clé primaire |
| code_article | String | Code unique |
| name | String | Nom du produit |
| gamme_id | FK → Prod_categorie | Gamme |
| aire | FK → Aire | Aire thérapeutique |

---

## 3. Relations Clés

### Affectation (Users ↔ Prospects)
- **Many-to-Many** via table `Affectation`
- Un délégué est affecté à un prospect pour une année donnée
- Gère le **portefeuille client**

### VisiteProducts (Visite ↔ Products)
- **Many-to-Many** via table `VisiteProducts`
- Détaille quels produits ont été présentés lors d'une visite

### Hiérarchie Users
- Un user peut avoir un **supérieur** (`sup` → FK Users)
- Permet la gestion des équipes

---

## 4. Autres Tables

| Catégorie | Tables |
|-----------|--------|
| **Géographie** | Gouvernerat, Delegation, Zone, PostalCode |
| **Planification** | ProgVisite (programme prévisionnel), ProgTours (tournées) |
| **Rapports** | Rapport (journalier/mensuel), ObjectifGroBu (objectifs) |
| **Achats** | Ba (bons d'achat), Demande, TypeDemande, TypePay |
| **Métier** | Specialite, Activite, Potentiel, Etablissement |

---

## 5. Utilisation dans ALIA

Le schéma CRM est converti en SQLAlchemy dans `backend/app/crm/schema.py` pour :

1. **Enrichir les profils médecins** — Croiser les données med.tn avec les vrais prospects du CRM
2. **Analyser l'historique des visites** — Étudier les patterns de visite pour entraîner l'avatar
3. **Auto-générer les comptes rendus** — ALIA produit des rapports CRM conformes au format existant
4. **Segmenter les profils** — Utiliser le potentiel, l'activité, la spécialité pour adapter le discours
5. **Suivi commercial** — Planifier les relances J+7, J+14 automatiquement
