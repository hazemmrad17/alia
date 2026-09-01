"""
Complete Data Ingestion Pipeline for ALIA Avatar
Ingests: products, doctors, markdown docs, scripts, objections, visit process
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.ai.rag import rag_pipeline

DATA_DIR = os.path.join(os.getcwd(), "data", "processed")
DOCS_DIR = os.path.join(os.getcwd(), "..", "docs")


def ingest_products(collection):
    """Ingest LLM-extracted product data."""
    path = os.path.join(DATA_DIR, "products_llm.json")
    if not os.path.exists(path):
        print("  [SKIP] products_llm.json not found")
        return 0

    with open(path, "r", encoding="utf-8") as f:
        products = json.load(f)

    count = 0
    for i, p in enumerate(products):
        name = p.get("name", f"Product_{i}")
        gamme = p.get("gamme", "Unknown")
        indications = p.get("indications", [])
        composition = p.get("composition", [])
        posologie = p.get("posologie", {})
        presentation = p.get("presentation", "")
        packaging = p.get("packaging", "")
        age_range = p.get("age_range", "")

        # Build rich text for retrieval
        parts = [f"Produit: {name}", f"Gamme: {gamme}"]
        if presentation:
            parts.append(f"Présentation: {presentation}")
        if packaging:
            parts.append(f"Packaging: {packaging}")
        if age_range:
            parts.append(f"Public cible: {age_range}")
        if indications:
            parts.append("Indications:\n" + "\n".join(f"- {ind}" for ind in indications))
        if composition:
            comp_items = []
            for c in composition:
                qty = c.get("quantity", "")
                ing = c.get("ingredient", "")
                if ing:
                    comp_items.append(f"- {ing}" + (f" ({qty})" if qty else ""))
            if comp_items:
                parts.append("Composition:\n" + "\n".join(comp_items))
        if posologie:
            note = posologie.get("note", "")
            table = posologie.get("table")
            if note:
                parts.append(f"Posologie: {note}")
            if table:
                parts.append(f"Posologie tableau: {json.dumps(table, ensure_ascii=False)}")

        text = "\n".join(parts)
        doc_id = f"product_{gamme.lower().replace(' ', '_')}_{i}"
        metadata = {
            "type": "product",
            "name": name,
            "gamme": gamme,
            "presentation": presentation,
        }

        collection.upsert(ids=[doc_id], documents=[text], metadatas=[metadata])
        count += 1

    print(f"  Ingested {count} products")
    return count


def ingest_doctors(collection):
    """Ingest scraped doctor profiles from med.tn."""
    path = os.path.join(DATA_DIR, "doctors_medtn.json")
    if not os.path.exists(path):
        print("  [SKIP] doctors_medtn.json not found")
        return 0

    with open(path, "r", encoding="utf-8") as f:
        doctors = json.load(f)

    count = 0
    for d in doctors:
        name = d.get("name", "")
        specialty = d.get("specialty", "")
        city = d.get("city", "")
        governorate = d.get("governorate", "")
        profile_url = d.get("profile_url", "")
        photo_url = d.get("photo_url", "")

        text = (
            f"Docteur: {name}\n"
            f"Spécialité: {specialty}\n"
            f"Ville: {city}\n"
            f"Gouvernorat: {governorate}\n"
            f"Profil med.tn: {profile_url}"
        )
        doc_id = f"dr_{name.lower().replace(' ', '_').replace('.', '').replace('Dr_', '')}"
        metadata = {
            "type": "real_doctor",
            "name": name,
            "specialty": specialty,
            "city": city,
            "governorate": governorate,
        }

        collection.upsert(ids=[doc_id], documents=[text], metadatas=[metadata])
        count += 1

    print(f"  Ingested {count} doctors from med.tn")
    return count


def ingest_curated_doctors(collection):
    """Ingest curated doctor profiles with behavioral notes."""
    path = os.path.join(DATA_DIR, "doctor_profiles.json")
    if not os.path.exists(path):
        print("  [SKIP] doctor_profiles.json not found")
        return 0

    with open(path, "r", encoding="utf-8") as f:
        doctors = json.load(f)

    count = 0
    for d in doctors:
        name = d.get("name", "")
        specialty = d.get("specialty", "")
        style = d.get("style", "")
        city = d.get("city", "")
        notes = d.get("notes", "")
        notes_fr = d.get("notes_fr", notes)
        products = d.get("products_interested", [])
        soncas = d.get("soncas_profile", [])

        text = (
            f"Docteur: {name}\n"
            f"Spécialité: {specialty}\n"
            f"Style relationnel: {style}\n"
            f"Ville: {city}\n"
            f"Profil SONCAS: {', '.join(soncas) if soncas else 'Non défini'}\n"
            f"Notes comportementales: {notes_fr}\n"
            f"Produits d'intérêt: {', '.join(products) if products else 'Non défini'}"
        )
        doc_id = f"dr_profile_{name.lower().replace(' ', '_').replace('.', '')}"
        metadata = {
            "type": "curated_doctor",
            "name": name,
            "specialty": specialty,
            "style": style,
            "city": city,
        }

        collection.upsert(ids=[doc_id], documents=[text], metadatas=[metadata])
        count += 1

    print(f"  Ingested {count} curated doctor profiles")
    return count


def ingest_scripts(collection):
    """Ingest top seller scripts."""
    path = os.path.join(DATA_DIR, "scripts.json")
    if not os.path.exists(path):
        print("  [SKIP] scripts.json not found")
        return 0

    with open(path, "r", encoding="utf-8") as f:
        scripts = json.load(f)

    count = 0
    for s in scripts:
        product = s.get("product", "")
        text_content = s.get("text", s.get("content", ""))
        category = s.get("category", "")
        targets = s.get("targets", [])

        text = f"Script vendeur: {product}\n"
        if category:
            text += f"Catégorie: {category}\n"
        if targets:
            text += f"Cibles: {', '.join(targets)}\n"
        text += f"\n{text_content}"

        doc_id = f"script_{product.lower().replace(' ', '_')}"
        metadata = {"type": "script", "product": product}

        collection.upsert(ids=[doc_id], documents=[text], metadatas=[metadata])
        count += 1

    print(f"  Ingested {count} scripts")
    return count


def ingest_objections(collection):
    """Ingest objection library."""
    path = os.path.join(DATA_DIR, "objections.json")
    if not os.path.exists(path):
        print("  [SKIP] objections.json not found")
        return 0

    with open(path, "r", encoding="utf-8") as f:
        objections = json.load(f)

    count = 0
    for o in objections:
        objection_text = o.get("objection", "")
        response = o.get("response", o.get("answer", ""))
        context = o.get("context", "")

        text = f"Objection: {objection_text}\n"
        if context:
            text += f"Contexte: {context}\n"
        text += f"Réponse recommandée (A-C-R-V): {response}"

        doc_id = f"objection_{count}"
        metadata = {"type": "objection"}

        collection.upsert(ids=[doc_id], documents=[text], metadatas=[metadata])
        count += 1

    print(f"  Ingested {count} objections")
    return count


def ingest_markdown_docs(collection):
    """Ingest the 5 reference markdown docs."""
    if not os.path.exists(DOCS_DIR):
        print(f"  [SKIP] docs directory not found at {DOCS_DIR}")
        return 0

    count = 0
    for fname in os.listdir(DOCS_DIR):
        if not fname.endswith(".md"):
            continue

        fpath = os.path.join(DOCS_DIR, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        # Split into chunks of ~1500 chars at paragraph boundaries
        paragraphs = content.split("\n\n")
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) > 1500 and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        # Ingest each chunk
        for i, chunk in enumerate(chunks):
            if len(chunk) < 50:  # Skip tiny chunks
                continue
            doc_id = f"doc_{fname.replace('.md', '').replace('-', '_')}_{i}"
            metadata = {
                "type": "reference_doc",
                "source_file": fname,
                "chunk_index": i,
            }
            collection.upsert(ids=[doc_id], documents=[chunk], metadatas=[metadata])
            count += 1

        print(f"  {fname}: {len(chunks)} chunks")

    print(f"  Ingested {count} document chunks total")
    return count


def ingest_visit_process(collection):
    """Ingest the VITAL SA visit process methodology."""
    visit_process = """
PROCESS VITAL SA - Les 6 étapes de la visite médicale

ÉTAPE 1: INTRODUCTION (Instant Zéro)
Objectif: Créer un climat favorable et obtenir la permission.
Script: "Bonjour Docteur, [Nom] - VITAL SA. Je fais très court : 2 minutes. Je voulais partager un point pratique sur [bénéfice patient]. C'est OK pour vous?"
Règles: Respect du temps, ton calme, sortie propre en cas de refus.

ÉTAPE 2: SONDAGE (questions + écoute active)
Objectif: Comprendre le besoin avant d'argumenter. 2 à 4 questions maximum.
Questions: Situation, Problème, Pratique, Critère, Validation.
Règle: Ratio parole ≤ 50%. Utiliser le silence. Ne pas interrompre.

ÉTAPE 3: SYNTHÈSE (reformulation / QARE)
Objectif: Valider le besoin et aligner message exprimé / message reçu.
Phrase: "Si je résume : votre priorité c'est X chez Y, et votre attente principale c'est Z. C'est bien ça?"

ÉTAPE 4: OBJECTIONS (A-C-R-V)
Objectif: Transformer une résistance en progression.
A-C-R-V: Accueillir → Clarifier → Répondre → Valider.
Règle: Ne jamais ignorer une objection. Rester calme. Ne pas contrer.

ÉTAPE 5: ARGUMENTATION
Objectif: Convaincre sans surcharger.
Structure: Besoins validés → 2-3 avantages patient → 1 preuve → Pour qui + comment.
Règles: Pas de surpromesse, pas de flou, pas de superlatifs.

ÉTAPE 6: CONCLUSION & ENGAGEMENT (BIP)
Objectif: Obtenir une micro-engagement au bon moment.
Signaux BIP: Questions détaillées, disparition objections, demande de support.
Closing: "On est d'accord sur [2 bénéfices]. Seriez d'accord pour l'essayer chez 2-3 patients?"
"""

    doc_id = "visit_process_vital"
    metadata = {"type": "visit_process"}
    collection.upsert(ids=[doc_id], documents=[visit_process.strip()], metadatas=[metadata])
    print("  Ingested visit process (1 document)")
    return 1


def main():
    print("=" * 60)
    print("ALIA Avatar - Complete Data Ingestion Pipeline")
    print("=" * 60)

    # Initialize RAG pipeline
    rag_pipeline.initialize()
    collection = rag_pipeline.collection

    # Clear old data
    print("\nClearing old ChromaDB data...")
    try:
        collection.delete(where={})
    except Exception:
        pass  # Collection might be empty

    total = 0

    print("\n[1/7] Products (LLM-extracted)")
    total += ingest_products(collection)

    print("\n[2/7] Doctors (med.tn scraped)")
    total += ingest_doctors(collection)

    print("\n[3/7] Curated Doctor Profiles")
    total += ingest_curated_doctors(collection)

    print("\n[4/7] Top Seller Scripts")
    total += ingest_scripts(collection)

    print("\n[5/7] Objection Library")
    total += ingest_objections(collection)

    print("\n[6/7] Reference Documents (5 markdown docs)")
    total += ingest_markdown_docs(collection)

    print("\n[7/7] Visit Process Methodology")
    total += ingest_visit_process(collection)

    print("\n" + "=" * 60)
    print(f"TOTAL: {total} documents ingested into ChromaDB")
    print("=" * 60)

    # Summary by type
    results = collection.get(include=["metadatas"])
    types = {}
    for m in results["metadatas"]:
        t = m.get("type", "unknown")
        types[t] = types.get(t, 0) + 1

    print("\nBy type:")
    for t, c in sorted(types.items()):
        print(f"  {t}: {c}")

    # Test retrieval
    print("\n--- Retrieval Tests ---")
    for query in [
        "produit pour la toux enfant sirop",
        "docteur cardiologue Tunis",
        "comment traiter objection pas de temps",
        "étapes visite médicale process",
    ]:
        docs = rag_pipeline.retrieve(query, n_results=1)
        if docs:
            print(f"\nQ: '{query}'")
            print(f"A: {docs[0][:150]}...")


if __name__ == "__main__":
    main()
