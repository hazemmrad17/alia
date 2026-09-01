"""
VITAL SA CRM Database Schema
Converted from Sequelize (database.js) to SQLAlchemy for ALIA Avatar integration.

Two databases:
- CRM (MySQL): Main operational data (users, visits, prospects, products)
- UNIGES (MSSQL): External ERP data (establishments, postal codes)
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date, Boolean, Text,
    ForeignKey, Table, Enum as SAEnum
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.ext.declarative import declared_attr

Base = declarative_base()


# ─── Association Tables ────────────────────────────────────────────

class Affectation(Base):
    """Many-to-Many: Users ↔ Prospects (who manages whom)"""
    __tablename__ = 'affectation'

    id_deleg = Column(Integer, ForeignKey('users.id'), primary_key=True)
    id_prospect = Column(Integer, ForeignKey('prospects.id'), primary_key=True)
    year = Column(Integer)

    user = relationship('User', back_populates='affectations')
    prospect = relationship('Prospect', back_populates='affectations')


class VisiteProducts(Base):
    """Many-to-Many: Visites ↔ Products (products presented during visit)"""
    __tablename__ = 'visite_products'

    id_visite = Column(Integer, ForeignKey('visites.id'), primary_key=True)
    produits = Column(Integer, ForeignKey('products.id'), primary_key=True)

    visite = relationship('Visite', back_populates='visite_products')
    product = relationship('Product', back_populates='visite_products')


# ─── Core Models ───────────────────────────────────────────────────

class User(Base):
    """Sales reps, managers, supervisors."""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    login = Column(String(50))
    password = Column(String(255))
    pwd_hashed = Column(String(255))
    nom = Column(String(100))
    prenom = Column(String(100))
    email = Column(String(150))
    tel = Column(String(20))
    type = Column(Integer, ForeignKey('user_types.id'))
    role = Column(String(20))  # admin, user
    sup = Column(Integer, ForeignKey('users.id'))  # hierarchical superior
    zone = Column(Integer)
    zone2 = Column(Integer)

    # Relationships
    visites = relationship('Visite', back_populates='visiteur', foreign_keys='Visite.id_visiteur')
    affectations = relationship('Affectation', back_populates='user')
    prospects = relationship('Prospect', secondary='affectation', back_populates='users')
    user_type = relationship('UserType', back_populates='users')


class UserType(Base):
    """User roles: commercial, délégué, superviseur, etc."""
    __tablename__ = 'user_types'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50))

    users = relationship('User', back_populates='user_type')


class Prospect(Base):
    """Doctors, pharmacies, healthcare professionals (the people we visit)."""
    __tablename__ = 'prospects'

    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String(100))
    prenom = Column(String(100))
    spec = Column(Integer, ForeignKey('specialites.id'))
    gouvernorat = Column(Integer, ForeignKey('gouvernorats.id'))
    delegation = Column(Integer, ForeignKey('delegations.id'))
    potentiel = Column(Integer, ForeignKey('potentiels.id'))
    activite = Column(Integer, ForeignKey('activites.id'))
    etablissement = Column(Integer, ForeignKey('etablissements.id'))
    cree_par = Column(Integer, ForeignKey('users.id'))

    # Relationships
    specialite = relationship('Specialite', back_populates='prospects')
    gouvernorat_ref = relationship('Gouvernerat', back_populates='prospects')
    delegation_ref = relationship('Delegation', back_populates='prospects')
    activite_ref = relationship('Activite', back_populates='prospects')
    potentiel_ref = relationship('Potentiel', back_populates='prospects')
    etablissement_ref = relationship('Etablissement', back_populates='prospects')
    user_creator = relationship('User', foreign_keys=[cree_par])
    visites = relationship('Visite', back_populates='prospect')
    affectations = relationship('Affectation', back_populates='prospect')
    users = relationship('User', secondary='affectation', back_populates='prospects')


class Visite(Base):
    """A visit interaction between a sales rep and a doctor."""
    __tablename__ = 'visites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    id_pros = Column(Integer, ForeignKey('prospects.id'))
    id_visiteur = Column(Integer, ForeignKey('users.id'))
    date_visite = Column(DateTime)
    type = Column(Integer, ForeignKey('type_visites.id'))
    commentaire = Column(Text)

    # Relationships
    prospect = relationship('Prospect', back_populates='visites')
    visiteur = relationship('User', back_populates='visites', foreign_keys=[id_visiteur])
    type_visite = relationship('TypeVisite', back_populates='visites')
    visite_products = relationship('VisiteProducts', back_populates='visite')
    products = relationship('Product', secondary='visite_products', back_populates='visites')


class TypeVisite(Base):
    """Visit types: Flash, Standard, Approfondie."""
    __tablename__ = 'type_visites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50))

    visites = relationship('Visite', back_populates='type_visite')


class Product(Base):
    """Products from the VITAL SA catalog."""
    __tablename__ = 'products'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code_article = Column(String(50))
    name = Column(String(200))
    gamme_id = Column(Integer, ForeignKey('prod_categories.id'))
    aire = Column(Integer, ForeignKey('aires.id'))

    # Relationships
    gamme = relationship('ProdCategorie', back_populates='products')
    aire_ref = relationship('Aire', back_populates='products')
    visite_products = relationship('VisiteProducts', back_populates='product')
    visites = relationship('Visite', secondary='visite_products', back_populates='products')


class ProdCategorie(Base):
    """Product categories/gammes."""
    __tablename__ = 'prod_categories'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))

    products = relationship('Product', back_populates='gamme')


class Aire(Base):
    """Therapeutic areas."""
    __tablename__ = 'aires'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))

    products = relationship('Product', back_populates='aire_ref')


# ─── Geography ─────────────────────────────────────────────────────

class Gouvernerat(Base):
    __tablename__ = 'gouvernorats'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))

    prospects = relationship('Prospect', back_populates='gouvernorat_ref')
    delegations = relationship('Delegation', back_populates='gouvernorat')


class Delegation(Base):
    __tablename__ = 'delegations'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))
    gouvernorat_id = Column(Integer, ForeignKey('gouvernorats.id'))

    gouvernorat = relationship('Gouvernerat', back_populates='delegations')
    prospects = relationship('Prospect', back_populates='delegation_ref')


class Zone(Base):
    __tablename__ = 'zones'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))


# ─── Business Metadata ────────────────────────────────────────────

class Specialite(Base):
    """Medical specialties: MG, Cardiologue, Pédiatre, etc."""
    __tablename__ = 'specialites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))

    prospects = relationship('Prospect', back_populates='specialite')


class Activite(Base):
    """Activity types."""
    __tablename__ = 'activites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))

    prospects = relationship('Prospect', back_populates='activite_ref')


class Potentiel(Base):
    """Commercial potential: high, medium, low."""
    __tablename__ = 'potentiels'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50))

    prospects = relationship('Prospect', back_populates='potentiel_ref')


class Etablissement(Base):
    """Healthcare establishments: clinics, hospitals, cabinets."""
    __tablename__ = 'etablissements'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200))

    prospects = relationship('Prospect', back_populates='etablissement_ref')


# ─── Planning & Reporting ─────────────────────────────────────────

class ProgVisite(Base):
    """Scheduled/programmed visits."""
    __tablename__ = 'prog_visites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    pros_id = Column(Integer, ForeignKey('prospects.id'))
    date_prevue = Column(DateTime)

    user = relationship('User')
    prospect = relationship('Prospect')


class Rapport(Base):
    """Daily/monthly reports from sales reps."""
    __tablename__ = 'rapports'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    date_rapport = Column(Date)
    contenu = Column(Text)

    user = relationship('User')


class Demande(Base):
    """Purchase requests."""
    __tablename__ = 'demandes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(Integer, ForeignKey('type_demandes.id'))
    id_user = Column(Integer, ForeignKey('users.id'))
    contenu = Column(Text)

    type_demande = relationship('TypeDemande')
    user = relationship('User')


class TypeDemande(Base):
    __tablename__ = 'type_demandes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))

    demandes = relationship('Demande', back_populates='type_demande')


# ─── Helper: Get all models ───────────────────────────────────────

def get_all_models():
    """Return all CRM models for inspection."""
    return {
        'User': User,
        'UserType': UserType,
        'Prospect': Prospect,
        'Visite': Visite,
        'TypeVisite': TypeVisite,
        'Product': Product,
        'ProdCategorie': ProdCategorie,
        'Aire': Aire,
        'Specialite': Specialite,
        'Activite': Activite,
        'Potentiel': Potentiel,
        'Etablissement': Etablissement,
        'Gouvernerat': Gouvernerat,
        'Delegation': Delegation,
        'Zone': Zone,
        'Affectation': Affectation,
        'VisiteProducts': VisiteProducts,
        'ProgVisite': ProgVisite,
        'Rapport': Rapport,
        'Demande': Demande,
        'TypeDemande': TypeDemande,
    }
