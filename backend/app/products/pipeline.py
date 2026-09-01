"""
ALIA Avatar - Data Ingestion Pipeline
Parses all VITAL SA data sources and ingests into the RAG vector store.
Run: python -m app.products.pipeline
"""
import os
import sys
import json
import shutil
import re
from typing import List, Dict, Any, Optional
from loguru import logger

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.config import get_settings
from app.ai.rag import rag_pipeline

settings = get_settings()

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
STUDENTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "Students")
CATALOG_DIR = os.path.join(STUDENTS_DIR, "Data vital", "catalogue", "Catalogue vital")
SCRIPTS_PDF = os.path.join(STUDENTS_DIR, "Data vital", "avatar", "Annexe_V2_Scripts_TOP_SELLERS_VITAL.pdf")
MANUAL_PDF = os.path.join(STUDENTS_DIR, "Data vital", "avatar", "Manuel_FINAL_ALIA_AVATAR_VM_VITAL_V1.pdf")
DATA_RAW = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")
DATA_PROCESSED = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

# ──────────────────────────────────────────────
# Product metadata (manually curated from PDFs)
# ──────────────────────────────────────────────
PRODUCT_CATALOG = {
    "BACTOL": {
        "name": "BACTOL",
        "category": "Antiseptique / Hygiène buccale",
        "therapeutic_area": "Hygiène buccale",
        "specialties": ["MG", "ORL", "Dentiste"],
        "description": "Gamme d'hygiène buccale pour prévention et soins.",
        "key_benefits": ["Protection buccale", "Prévention des infections", "Utilisation quotidienne"],
        "target_profiles": ["Adultes", "Enfants"],
        "dosage": "Selon produit, 2-3 fois/jour",
        "precautions": ["Usage externe", "Enfants sous supervision"],
    },
    "CALMOSS": {
        "name": "CALMOSS",
        "category": "Phytothérapie - Calme / Sommeil",
        "therapeutic_area": "Stress, anxiété, troubles du sommeil",
        "specialties": ["MG", "Neurologue", "Médecin du sommeil"],
        "description": "Gamme phytothérapeutique pour le stress et le sommeil naturellement.",
        "key_benefits": ["Action naturelle sur le stress", "Améliore la qualité du sommeil", "Sans accoutumance", "Bien toléré"],
        "target_profiles": ["Adultes stressés", "Personnes avec troubles du sommeil", "Seniors"],
        "dosage": "1-2 gélules/jour le soir",
        "precautions": ["Ne pas conduire après prise", "Interactions possibles avec sédatifs"],
        "evidence": ["Plantes médicinales avec études de pharmacovigilance"],
    },
    "COSMOPHARMA": {
        "name": "COSMOPHARMA",
        "category": "Cosmétique / Dermatologie",
        "therapeutic_area": "Soins dermatologiques",
        "specialties": ["Dermatologue", "MG", "Pharmacien"],
        "description": "Gamme cosmétique à visée dermatologique.",
        "key_benefits": ["Tolérance cutanée", "Composants actifs certifiés", "Résultats visibles"],
        "target_profiles": ["Peaux sensibles", "Peaux matures", "Peaux problematiques"],
        "dosage": "Application topique 1-2 fois/jour",
        "precautions": ["Test de tolérance recommandé", "Usage externe uniquement"],
    },
    "FERBIOTIC": {
        "name": "FERBIOTIC",
        "category": "Fer / Énergie - Adulte",
        "therapeutic_area": "Carence en fer, fatigue liée",
        "specialties": ["MG", "Gynécologue", "Hématologue"],
        "description": "Gamme fer pour couvrir les besoins en fer chez l'adulte avec observance optimisée.",
        "key_benefits": ["Prise simple + routine facile", "Tolérance digestive améliorée", "Conseils de prise pour observance", "Couverture des besoins en fer"],
        "target_profiles": ["Femmes en période d'activité", "Personnes fatiguées", "Végétariens", "Sportifs"],
        "dosage": "1 gélule/jour, de préférence le matin à jeun",
        "precautions": ["Possibilité de coloration des selles", "Prendre avec vitamine C pour absorption"],
        "evidence": ["Besoins en fer selon profil patient", "Conseils observance"],
    },
    "HEALTHCARE": {
        "name": "HEALTHCARE",
        "category": "Santé générale",
        "therapeutic_area": "Bien-être général",
        "specialties": ["MG"],
        "description": "Gamme pour la santé générale et le bien-être.",
        "key_benefits": ["Approche globale de la santé", "Compléments essentiels"],
        "target_profiles": ["Adultes"],
    },
    "HYDRA": {
        "name": "HYDRA",
        "category": "Hydratation cutanée",
        "therapeutic_area": "Hydratation cutanée",
        "specialties": ["Dermatologue", "MG"],
        "description": "Gamme d'hydratation pour peaux sèches et déshydratées.",
        "key_benefits": ["Hydratation longue durée", "Renforcement barrière cutanée", "Texture agréable"],
        "target_profiles": ["Peaux sèches", "Peaux déshydratées", "Seniors"],
        "dosage": "Application topique 1-2 fois/jour",
        "precautions": ["Usage externe"],
    },
    "LABORATOIRE VITAL": {
        "name": "LABORATOIRE VITAL",
        "category": "Pharmaceutique général",
        "therapeutic_area": "Polyvalent",
        "specialties": ["MG", "Spécialiste"],
        "description": "Gamme principale du laboratoire VITAL SA.",
        "key_benefits": ["Large portefeuille produits", "Qualité pharmaceutique", "Innovation continue"],
        "target_profiles": ["Tous patients"],
    },
    "MINCILIGNE": {
        "name": "MINCILIGNE",
        "category": "Perte de poids",
        "therapeutic_area": "Poids / Métabolisme",
        "specialties": ["MG", "Nutritionniste", "Endocrinologue"],
        "description": "Gamme minceur et gestion du poids.",
        "key_benefits": ["Aide à la gestion du poids", "Soutien métabolique", "Approche naturelle"],
        "target_profiles": ["Adultes en surpoids", "Personnes en régime"],
        "dosage": "Selon produit, 1-2 fois/jour",
        "precautions": ["Complément alimentaire, pas substitut médical", "Associer à alimentation équilibrée"],
    },
    "MINCIVIT": {
        "name": "MINCIVIT",
        "category": "Complément alimentaire / Minceur",
        "therapeutic_area": "Poids / Énergie",
        "specialties": ["MG"],
        "description": "Complément pour soutenir la minceur et l'énergie.",
        "key_benefits": ["Soutien énergétique", "Aide à la minceur"],
        "target_profiles": ["Adultes actifs"],
    },
    "OLIGOVIT": {
        "name": "OLIGOVIT",
        "category": "Vitamines / Minéraux",
        "therapeutic_area": "Carences vitaminiques, soutien immunitaire",
        "specialties": ["MG", "Pédiatre"],
        "description": "Gamme de vitamines et oligo-éléments pour couvrir les carences.",
        "key_benefits": ["Cure simple de vitamine C", "Soutien immunitaire", "Messages hygiène de vie", "1 prise/jour"],
        "target_profiles": ["Fatigue ressentie", "Saisons de demande immunité", "Adultes", "Enfants"],
        "dosage": "1 gélule/jour",
        "precautions": ["Ne remplace pas une prise en charge médicale", "Complément alimentaire"],
    },
    "OMEVIE": {
        "name": "OMEVIE",
        "category": "Omega-3",
        "therapeutic_area": "Cardiovasculaire / Bien-être",
        "specialties": ["MG", "Cardiologue"],
        "description": "Gamme omega-3 pour la santé cardiovasculaire et le bien-être.",
        "key_benefits": ["Santé cardiovasculaire", "Acides gras essentiels", "Soutien cognitif"],
        "target_profiles": ["Adultes", "Seniors", "Personnes avec risques cardiovasculaires"],
        "dosage": "1-2 gélules/jour avec le repas",
        "precautions": ["Anticoagulants: avis médical"],
    },
    "PEDIAKIDS": {
        "name": "PEDIAKIDS",
        "category": "Pédiatrie",
        "therapeutic_area": "Santé infantile",
        "specialties": ["Pédiatre", "MG"],
        "description": "Gamme complète pour la santé des enfants.",
        "key_benefits": ["Formules pédiatriques", "Goût apprécié des enfants", "Dosage adapté", "Sécurité prouvée"],
        "target_profiles": ["Enfants 0-12 ans", "Bébés", "Adolescents"],
        "dosage": "Selon âge, 1-3 cuillères/jour",
        "precautions": ["Usage pédiatrique", "Tenir hors de portée des enfants"],
    },
    "PHYTOL": {
        "name": "PHYTOL",
        "category": "Phytothérapie",
        "therapeutic_area": "Bien-être / Naturel",
        "specialties": ["MG"],
        "description": "Gamme phytothérapeutique pour le bien-être naturel.",
        "key_benefits": ["Approche naturelle", "Bien toléré"],
        "target_profiles": ["Adultes"],
    },
    "PHYTOPHANE": {
        "name": "PHYTOPHANE",
        "category": "Phytothérapie - Cheveux / Ongles",
        "therapeutic_area": "Cheveux / Ongles",
        "specialties": ["Dermatologue", "MG"],
        "description": "Gamme pour la santé des cheveux et ongles.",
        "key_benefits": ["Renforcement capillaire", "Soin des ongles", "Action ciblée"],
        "target_profiles": ["Chute de cheveux", "Ongles fragiles"],
        "dosage": "1 gélule/jour",
        "precautions": ["Résultats progressifs (3-6 mois)"],
    },
    "PHYTOTHERA": {
        "name": "PHYTOTHERA",
        "category": "Phytothérapie / Médical",
        "therapeutic_area": "Thérapeutique naturelle",
        "specialties": ["MG", "Spécialiste"],
        "description": "Gamme phytothérapeutique à usage médical.",
        "key_benefits": ["Efficacité prouvée", "Origine naturelle", "Spécialistes recommandent"],
        "target_profiles": ["Patients avec pathologies spécifiques"],
    },
    "PLANTHERAPIE": {
        "name": "PLANTHERAPIE",
        "category": "Phytothérapie",
        "therapeutic_area": "Thérapeutique par les plantes",
        "specialties": ["MG"],
        "description": "Gamme thérapeutique basée sur les plantes.",
        "key_benefits": ["Héritage phyto", "Formulation experte"],
        "target_profiles": ["Patients sensibles aux traitements classiques"],
    },
    "TC2000": {
        "name": "TC2000 et SPS ARNICA",
        "category": "Homéopathie / Phyto",
        "therapeutic_area": "Douleurs / Contusions",
        "specialties": ["MG", "Rhumatologue", "Ostéopathe"],
        "description": "Gamme pour les douleurs et contusions.",
        "key_benefits": ["Soulagement des douleurs", "Action Arnica", "Usage sportif"],
        "target_profiles": ["Sportifs", "Personnes avec douleurs musculaires", "Contusions"],
        "dosage": "Selon produit",
        "precautions": ["Consultation médicale si douleur persistante"],
    },
    "Tidol": {
        "name": "Tidol",
        "category": "Anti-douleur",
        "therapeutic_area": "Douleurs légères à modérées",
        "specialties": ["MG"],
        "description": "Gamme anti-douleur pour soulager les douleurs courantes.",
        "key_benefits": ["Soulagement rapide", "Bien toléré", "Usage simple"],
        "target_profiles": ["Adultes avec douleurs courantes"],
        "dosage": "Selon posologie",
        "precautions": ["Ne pas dépasser la dose recommandée", "Consultation si douleur persiste"],
    },
    "UNIDERM": {
        "name": "UNIDERM",
        "category": "Dermatologie",
        "therapeutic_area": "Soins dermatologiques",
        "specialties": ["Dermatologue", "MG"],
        "description": "Gamme dermatologique pour le soin de la peau.",
        "key_benefits": ["Efficacité dermatologique", "Tolérance testée", "Formulation précise"],
        "target_profiles": ["Peaux problematiques", "Dermatoses légères"],
        "dosage": "Application topique 1-2 fois/jour",
        "precautions": ["Usage externe", "Éviter le contact oculaire"],
    },
    "VITONIC": {
        "name": "VITONIC",
        "category": "Vitamines",
        "therapeutic_area": "Énergie / Métabolisme",
        "specialties": ["MG", "Gynécologue"],
        "description": "Gamme de vitamines pour l'énergie et le métabolisme.",
        "key_benefits": ["Énergie naturelle", "Soutien métabolique", "Formules spécifiques (allaitement)", "Facile à intégrer au quotidien"],
        "target_profiles": ["Femmes allaitantes", "Femmes actives", "Personnes fatiguées"],
        "dosage": "1 gélule/jour",
        "precautions": ["Alimentation + hydratation + suivi médical"],
    },
    "Vitosine": {
        "name": "Vitosine",
        "category": "Complément alimentaire",
        "therapeutic_area": "Bien-être général",
        "specialties": ["MG"],
        "description": "Complément pour le bien-être général.",
        "key_benefits": ["Soutien quotidien", "Formule équilibrée"],
        "target_profiles": ["Adultes"],
    },
}

# ──────────────────────────────────────────────
# Curated scripts data (extracted from PDF)
# ──────────────────────────────────────────────
SCRIPTS_DATA = [
    {
        "product_name": "LV Fersang",
        "category": "Fer / Énergie",
        "gamme": "FERBIOTIC",
        "specialties": ["MG", "Gynécologue"],
        "message_coeur": "Aider à couvrir les besoins en fer chez l'adulte selon profil, avec une approche pratique d'observance.",
        "target_situations": [
            "Fatigue ressentie liée à des carences suspectées",
            "Périodes de besoins augmentés (selon profil)",
        ],
        "questions": [
            "Sur vos patients, le frein principal c'est plutôt tolérance digestive ou observance ?",
            "Vous cherchez plutôt une prise simple ou une correction progressive ?",
        ],
        "argumentation": [
            "Bénéfice pratique : prise simple + routine facile",
            "Tolérance/observance : conseils de prise pour améliorer l'adhésion",
            "Positionnement : profils où l'apport en fer est pertinent selon le contexte",
        ],
        "objections": [
            {"objection": "J'ai mes habitudes", "clarification": "Sur quels patients vous êtes le moins satisfait ?", "response": "Justement, positionnement en plan B sur ce profil + test + suivi J+7/J+14."},
            {"objection": "Trop d'intolérance", "clarification": "C'est plutôt nausées, constipation, ou cours ?", "response": "Conseils de prise + adaptation du schéma ; si besoin je vous partage les astuces."},
            {"objection": "Pas convaincu", "clarification": "Il vous manque plutôt preuve, tolerance, ou profil patient ?", "response": "Reponse factuelle + preuve courte + proposition de test sur 2-3 patients."},
        ],
    },
    {
        "product_name": "LV Tétra B",
        "category": "Vitamines B",
        "gamme": "VITONIC",
        "specialties": ["MG"],
        "message_coeur": "Simplifier la couverture en vitamines du groupe B, surtout quand l'observance est un enjeu.",
        "target_situations": ["Patients actifs / stressés", "Routines nutritionnelles irrégulières"],
        "questions": [
            "Dans votre pratique, vous le recommandez plutôt en cure courte ou au long cours ?",
            "Le besoin principal est plutôt tonus ressenti ou récupération ?",
        ],
        "argumentation": [
            "Bénéfice routine : cure simple, facile à expliquer",
            "Confort : format gélule, prise quotidienne",
            "Approche responsable : messages hygiène de vie + complément",
        ],
        "objections": [
            {"objection": "Je n'aime pas les compléments", "clarification": "Sur quels cas vous acceptez une aide nutritionnelle ?", "response": "Positionnement 'support' + rappel limites + suivi."},
            {"objection": "Ils ne prennent pas régulièrement", "clarification": "Quel est le frein : oubli ou motivation ?", "response": "Astuce observance (rituel, rappel) + cure courte test."},
        ],
    },
    {
        "product_name": "PULMAX antitussif",
        "category": "Toux - Sirop",
        "gamme": "PHYTOTHERA",
        "specialties": ["MG", "Pédiatre", "ORL"],
        "message_coeur": "Apporter une option antitussive avec messages clairs d'usage et de sélection patient.",
        "target_situations": ["Toux gênante", "Patients cherchant confort nocturne"],
        "questions": [
            "Votre difficulté principale, c'est plutôt la toux nocturne ou l'irritation ?",
            "Vous voyez plus de toux sèche ou productive en ce moment ?",
        ],
        "argumentation": [
            "Clarté d'usage : quand l'utiliser / quand réévaluer",
            "Conseils pratiques : hydratation, environnement, observance",
            "Différenciation : simplicité de conseil + tolérance selon fiche produit",
        ],
        "objections": [
            {"objection": "Je préfère traiter la cause", "clarification": "Vous avez raison. Dans quel cas vous positionnez un 'confort' pour le patient en attente ?", "response": "Positionnement en 'confort' + rappel que c'est pas pour l'étiologie."},
            {"objection": "Les patients s'auto-médiquent", "clarification": "Vous le constatez souvent ?", "response": "Message sécurité : bon usage + durée + consulter si persistance."},
            {"objection": "Pas le temps", "clarification": "20 secondes ?", "response": "1 indication de bon usage + je laisse une fiche et je repasse."},
        ],
    },
    {
        "product_name": "Oligovit Vitamine C",
        "category": "Vitamine C",
        "gamme": "OLIGOVIT",
        "specialties": ["MG"],
        "message_coeur": "Cure simple de vitamine C avec messages d'hygiène de vie et limites.",
        "target_situations": ["Périodes de fatigue perçue", "Saisons où les patients demandent 'immunité'"],
        "questions": [
            "Vos patients la demandent surtout pour énergie ou 'immunité' ?",
            "Vous préférez une cure courte ou fractionnée ?",
        ],
        "argumentation": [
            "Simplicité : cure facile à expliquer",
            "Responsabilité : ne remplace pas une prise en charge médicale",
            "Observance : 1 prise/jour",
        ],
        "objections": [
            {"objection": "Tout le monde en demande", "clarification": "Quel profil vous voulez prioriser ?", "response": "Segmentation patient + cure courte + suivi."},
            {"objection": "Pas d'intérêt", "clarification": "Sur quels cas vous voyez un bénéfice potentiel ?", "response": "Positionnement 'support' + prudence."},
        ],
    },
    {
        "product_name": "Vitonic Allaitement",
        "category": "Allaitement - Support nutritionnel",
        "gamme": "VITONIC",
        "specialties": ["Gynécologue", "MG"],
        "message_coeur": "Accompagner la période d'allaitement avec une approche 'support' et messages de sécurité.",
        "target_situations": ["Femmes allaitantes fatiguées", "Besoin de routine nutritionnelle"],
        "questions": [
            "Vos patientes ont surtout un problème de fatigue ou d'organisation ?",
            "Vous cherchez plutôt une cure post-partum ou durant l'allaitement ?",
        ],
        "argumentation": [
            "Routine : formule dédiée + cure claire",
            "Confort : facile à intégrer au quotidien",
            "Message responsable : alimentation + hydratation + suivi médical si symptôme",
        ],
        "objections": [
            {"objection": "Je suis prudent en allaitement", "clarification": "Votre vigilance porte sur quoi ?", "response": "Réponse prudente + renvoi fiche/notice + proposition plan B."},
            {"objection": "Trop de produits post-partum", "clarification": "Quel besoin prioritaire chez vos patientes ?", "response": "Cibler 1 besoin + micro-test."},
        ],
    },
    {
        "product_name": "Pédiakids Crème Change",
        "category": "Dermite du siège - Topique",
        "gamme": "PEDIAKIDS",
        "specialties": ["Pédiatre", "MG"],
        "message_coeur": "Conseils de prévention et protection cutanée + positionnement en routine quotidienne.",
        "target_situations": ["Irritations légères du siège", "Prévention chez bébé sensible"],
        "questions": [
            "Le frein principal, c'est irritation fréquente ou épisodes plus sévères ?",
            "Les parents suivent-ils bien les mesures d'hygiène ?",
        ],
        "argumentation": [
            "Routine : barrière protectrice + conseils d'application",
            "Éducation parents : fréquence, aération, hygiène",
            "Suivi : signes d'alerte si persistance/extension",
        ],
        "objections": [
            {"objection": "Ça ne marche pas toujours", "clarification": "Sur quel contexte : mycose, irritation, allergie ?", "response": "Clarifier + orienter si besoin + positionner en prévention."},
        ],
    },
]

# ──────────────────────────────────────────────
# Objection library (curated from all products)
# ──────────────────────────────────────────────
OBJECTION_LIBRARY = [
    {"objection": "Je n'ai pas le temps", "clarification": "Vous avez 20 secondes ou je repasse ?", "response": "Je fais très court : 1 bénéfice + 1 cas patient + je reviens.", "category": "time"},
    {"objection": "J'ai mes habitudes", "clarification": "Sur quel profil vous êtes le moins satisfait ?", "response": "Justement, positionnement en plan B sur ce profil + test.", "category": "habits"},
    {"objection": "Pas convaincu", "clarification": "Il vous manque plutôt preuve, tolérance, ou profil patient ?", "response": "Réponse factuelle + preuve courte + proposition de test.", "category": "conviction"},
    {"objection": "Trop cher", "clarification": "Dans quels cas le coût bloque le plus ?", "response": "Positionnement sur profil à forte valeur + conseil d'usage + suivi.", "category": "price"},
    {"objection": "Trop d'intolérance", "clarification": "C'est plutôt nausées, constipation, ou cours ?", "response": "Conseils de prise + adaptation du schéma ; si besoin je vous partage les astuces.", "category": "tolerance"},
    {"objection": "Je n'aime pas les compléments", "clarification": "Sur quels cas vous acceptez une aide nutritionnelle ?", "response": "Positionnement 'support' + rappel limites + suivi.", "category": "preferences"},
    {"objection": "Ils ne prennent pas régulièrement", "clarification": "Quel est le frein : oubli ou motivation ?", "response": "Astuce observance (rituel, rappel) + cure courte test.", "category": "compliance"},
    {"objection": "Je préfère traiter la cause", "clarification": "Dans quel cas vous positionnez un 'confort' pour le patient en attente ?", "response": "Positionnement en 'confort' + rappel que c'est pas pour l'étiologie.", "category": "approach"},
    {"objection": "Les patients s'auto-médiquent", "clarification": "Vous le constatez souvent ?", "response": "Message sécurité : bon usage + durée + consulter si persistance.", "category": "safety"},
    {"objection": "Ça ne marche pas toujours", "clarification": "Sur quel contexte : mycose, irritation, allergie ?", "response": "Clarifier + orienter si besoin + positionner en prévention.", "category": "efficacy"},
    {"objection": "Tout le monde en demande", "clarification": "Quel profil vous voulez prioriser ?", "response": "Segmentation patient + cure courte + suivi.", "category": "market"},
    {"objection": "Pas d'intérêt", "clarification": "Sur quels cas vous voyez un bénéfice potentiel ?", "response": "Positionnement 'support' + prudence.", "category": "interest"},
    {"objection": "Trop de produits post-partum", "clarification": "Quel besoin prioritaire chez vos patientes ?", "response": "Cibler 1 besoin + micro-test.", "category": "saturation"},
    {"objection": "Je suis prudent en allaitement", "clarification": "Votre vigilance porte sur quoi ?", "response": "Réponse prudente + renvoi fiche/notice + proposition plan B.", "category": "safety"},
]


# ──────────────────────────────────────────────
# Doctor profiles knowledge base
# ──────────────────────────────────────────────
DOCTOR_PROFILES = [
    {"name": "Dr. Ahmed Ben Salah", "specialty": "Médecine Générale", "style": "analysant", "location": "Tunis", "notes": "Demande toujours des preuves et des études. Préfère les données chiffrées."},
    {"name": "Dr. Fatma Trabelsi", "specialty": "Gynécologie", "style": "facilitant", "location": "Sfax", "notes": "Apprécie le relationnel et la confiance. Écoute attentivement."},
    {"name": "Dr. Mohamed Amine Khelifi", "specialty": "Pédiatrie", "style": "promouvant", "location": "Sousse", "notes": "Aime les nouveautés et les innovations. Ouvert aux nouvelles approches."},
    {"name": "Dr. Habib Mansour", "specialty": "Cardiologie", "style": "controlant", "location": "Tunis", "notes": "Très structuré, veut des processus clairs. N'aime pas l'improvisation."},
    {"name": "Dr. Nadia Bouazizi", "specialty": "Dermatologie", "style": "analysant", "location": "Monastir", "notes": "Exige des données scientifiques précises. Très pointilleuse."},
    {"name": "Dr. Sami Ferchiou", "specialty": "Médecine Générale", "style": "facilitant", "location": "Tunis", "notes": "Très accessible, aime discuter. Bon relationnel avec les VM."},
    {"name": "Dr. Leila Bouchama", "specialty": "Neurologie", "style": "controlant", "location": "Sfax", "notes": "Veut des protocoles clairs. Pas de place pour le vague."},
    {"name": "Dr. Walid Hamdi", "specialty": "ORL", "style": "promouvant", "location": "Sousse", "notes": "Curieux, pose beaucoup de questions sur les nouveautés."},
    {"name": "Dr. Asma Ghodbane", "specialty": "Médecine Générale", "style": "analysant", "location": "Kairouan", "notes": "Exige des preuves. Très analytique dans ses décisions."},
    {"name": "Dr. Ridha Ben Amor", "specialty": "Rhumatologie", "style": "facilitant", "location": "Tunis", "notes": "Bon relationnel, fidélise facilement. Apprécie la régularité des visites."},
]


class DataPipeline:
    """Full data ingestion pipeline."""

    def __init__(self):
        os.makedirs(DATA_RAW, exist_ok=True)
        os.makedirs(DATA_PROCESSED, exist_ok=True)

    def run(self):
        """Run the full pipeline."""
        logger.info("=" * 60)
        logger.info("🚀 ALIA Avatar - Data Ingestion Pipeline")
        logger.info("=" * 60)

        # Step 1: Copy PPTX files to data/raw
        self._copy_catalog_files()

        # Step 2: Parse and ingest product catalogs
        products = self._parse_and_ingest_products()

        # Step 3: Parse and ingest scripts
        scripts = self._parse_and_ingest_scripts()

        # Step 4: Ingest objection library
        self._ingest_objection_library()

        # Step 5: Ingest doctor profiles
        self._ingest_doctor_profiles()

        # Step 6: Ingest visit process
        rag_pipeline.ingest_visit_process()

        # Step 7: Save processed data
        self._save_processed_data(products, scripts)

        logger.info("=" * 60)
        logger.info(f"✅ Pipeline complete!")
        logger.info(f"   Products: {len(products)}")
        logger.info(f"   Scripts: {len(scripts)}")
        logger.info(f"   Objections: {len(OBJECTION_LIBRARY)}")
        logger.info(f"   Doctor profiles: {len(DOCTOR_PROFILES)}")
        logger.info("=" * 60)

    def _copy_catalog_files(self):
        """Copy PPTX files from Students directory to data/raw."""
        logger.info("📁 Copying catalog files...")

        if not os.path.exists(CATALOG_DIR):
            logger.warning(f"Catalog directory not found: {CATALOG_DIR}")
            return

        for filename in os.listdir(CATALOG_DIR):
            if filename.endswith(".pptx"):
                src = os.path.join(CATALOG_DIR, filename)
                dst = os.path.join(DATA_RAW, filename)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)
                    logger.info(f"  Copied: {filename}")

    def _parse_and_ingest_products(self) -> List[Dict[str, Any]]:
        """Parse and ingest all products."""
        logger.info("📦 Parsing and ingesting product catalogs...")

        products = []
        for gamme_name, info in PRODUCT_CATALOG.items():
            product_data = {
                **info,
                "source": "vital_catalog",
            }
            products.append(product_data)

            # Ingest into RAG
            rag_pipeline.ingest_product(product_data)
            logger.info(f"  ✅ Ingested: {gamme_name} ({info.get('category', 'N/A')})")

        # Build cross-product context
        self._ingest_cross_product_context(products)

        return products

    def _parse_and_ingest_scripts(self) -> List[Dict[str, Any]]:
        """Parse and ingest scripts."""
        logger.info("📝 Parsing and ingesting scripts...")

        for script in SCRIPTS_DATA:
            rag_pipeline.ingest_script(script)
            logger.info(f"  ✅ Script: {script['product_name']}")

        return SCRIPTS_DATA

    def _ingest_objection_library(self):
        """Ingest the objection library."""
        logger.info("🚫 Ingesting objection library...")
        rag_pipeline.ingest_objection_library(OBJECTION_LIBRARY)
        logger.info(f"  ✅ {len(OBJECTION_LIBRARY)} objections ingested")

    def _ingest_doctor_profiles(self):
        """Ingest doctor profiles into the vector store."""
        logger.info("👨‍⚕️ Ingesting doctor profiles...")

        for profile in DOCTOR_PROFILES:
            doc_id = f"doctor_{profile['name'].lower().replace(' ', '_').replace('.', '')}"
            text = (
                f"Doctor: {profile['name']}\n"
                f"Specialty: {profile['specialty']}\n"
                f"Style: {profile['style']}\n"
                f"Location: {profile['location']}\n"
                f"Notes: {profile['notes']}"
            )
            metadata = {
                "type": "doctor_profile",
                "name": profile["name"],
                "specialty": profile["specialty"],
                "style": profile["style"],
            }

            if rag_pipeline.collection:
                rag_pipeline.collection.upsert(
                    ids=[doc_id],
                    documents=[text],
                    metadatas=[metadata],
                )
            else:
                rag_pipeline._fallback_data[doc_id] = {"text": text, "metadata": metadata}

        logger.info(f"  ✅ {len(DOCTOR_PROFILES)} doctor profiles ingested")

    def _ingest_cross_product_context(self, products: List[Dict[str, Any]]):
        """Create cross-product context for comparison awareness."""
        logger.info("🔗 Building cross-product awareness...")

        # Group by category
        by_category = {}
        for p in products:
            cat = p.get("category", "Autre")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(p["name"])

        # Group by therapeutic area
        by_area = {}
        for p in products:
            area = p.get("therapeutic_area", "Autre")
            if area not in by_area:
                by_area[area] = []
            by_area[area].append(p["name"])

        # Ingest cross-product document
        cross_text = "VITAL SA PRODUCT PORTFOLIO OVERVIEW\n\n"
        cross_text += "=== PRODUCTS BY CATEGORY ===\n"
        for cat, names in by_category.items():
            cross_text += f"\n{cat}:\n"
            for name in names:
                cross_text += f"  - {name}\n"

        cross_text += "\n=== PRODUCTS BY THERAPEUTIC AREA ===\n"
        for area, names in by_area.items():
            cross_text += f"\n{area}:\n"
            for name in names:
                cross_text += f"  - {name}\n"

        cross_text += "\n=== CROSS-PRODUCT KNOWLEDGE ===\n"
        cross_text += "When a doctor asks about alternatives or comparisons:\n"
        cross_text += "- Compare within the same therapeutic area\n"
        cross_text += "- Highlight differentiating factors (composition, format, evidence level)\n"
        cross_text += "- Never denigrate other products\n"
        cross_text += "- Position based on patient profile and needs\n"

        # Ingest the cross-product document
        if rag_pipeline.collection:
            rag_pipeline.collection.upsert(
                ids=["cross_product_portfolio"],
                documents=[cross_text],
                metadatas=[{"type": "cross_product", "name": "VITAL SA Portfolio"}],
            )

        logger.info(f"  ✅ Cross-product context ingested ({len(by_category)} categories, {len(by_area)} therapeutic areas)")

    def _save_processed_data(self, products: List[Dict[str, Any]], scripts: List[Dict[str, Any]]):
        """Save processed data as JSON files."""
        logger.info("💾 Saving processed data...")

        # Save products
        products_path = os.path.join(DATA_PROCESSED, "products.json")
        with open(products_path, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        logger.info(f"  Saved: {products_path}")

        # Save scripts
        scripts_path = os.path.join(DATA_PROCESSED, "scripts.json")
        with open(scripts_path, "w", encoding="utf-8") as f:
            json.dump(scripts, f, ensure_ascii=False, indent=2)
        logger.info(f"  Saved: {scripts_path}")

        # Save objections
        objections_path = os.path.join(DATA_PROCESSED, "objections.json")
        with open(objections_path, "w", encoding="utf-8") as f:
            json.dump(OBJECTION_LIBRARY, f, ensure_ascii=False, indent=2)
        logger.info(f"  Saved: {objections_path}")

        # Save doctor profiles
        doctors_path = os.path.join(DATA_PROCESSED, "doctor_profiles.json")
        with open(doctors_path, "w", encoding="utf-8") as f:
            json.dump(DOCTOR_PROFILES, f, ensure_ascii=False, indent=2)
        logger.info(f"  Saved: {doctors_path}")


if __name__ == "__main__":
    pipeline = DataPipeline()
    pipeline.run()
