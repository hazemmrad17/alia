"""
ALIA Avatar - Data Pipeline v2
Uses real PPTX-parsed product data for RAG ingestion.
Run: python -m app.products.pipeline_v2
"""
import os
import sys
import json
from loguru import logger

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.ai.rag import rag_pipeline
from app.products.pptx_parser import PPTXProductParser
from app.products.pipeline import SCRIPTS_DATA, OBJECTION_LIBRARY, DOCTOR_PROFILES

CATALOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "Students", "Data vital", "catalogue", "Catalogue vital")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")


def run():
    """Run the full v2 pipeline."""
    logger.info("=" * 60)
    logger.info("ALIA Avatar - Data Pipeline v2 (Parsed Products)")
    logger.info("=" * 60)

    # 1. Parse PPTX files
    parser = PPTXProductParser(CATALOG_DIR)
    gamme_data = parser.parse_all()
    flat_products = parser.to_flat_products(gamme_data)

    # Clean noisy names
    import re
    cleaned = []
    for p in flat_products:
        name = p["name"].strip()
        if re.match(r"^\d+$", name):
            continue
        if name.lower() in ["gélules", "gélule", "sachets", "sachet", "comprimés", "sirop", "spray", "capsules"]:
            continue
        if len(name) < 3:
            continue
        cleaned.append(p)

    logger.info(f"Parsed {len(gamme_data)} gammes -> {len(cleaned)} products")

    # Save parsed data
    parser.save_json(gamme_data, os.path.join(PROCESSED_DIR, "gamme_parsed.json"))
    parser.save_json(cleaned, os.path.join(PROCESSED_DIR, "products_parsed.json"))

    # 2. Initialize RAG and ingest everything
    rag_pipeline.initialize()

    # Ingest each product
    for product in cleaned:
        # Build a rich text chunk for the product
        chunk = _product_to_chunk(product)
        metadata = {
            "type": "product",
            "name": product["name"],
            "gamme": product.get("gamme", ""),
            "presentation": product.get("presentation", ""),
        }

        doc_id = f"product_{product['name'].lower().replace(' ', '_').replace('/', '_')}"
        if rag_pipeline.collection:
            rag_pipeline.collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[metadata],
            )

    logger.info(f"Ingested {len(cleaned)} products into ChromaDB")

    # 3. Ingest cross-product portfolio
    _ingest_portfolio(cleaned)

    # 4. Ingest scripts
    for script in SCRIPTS_DATA:
        rag_pipeline.ingest_script(script)
    logger.info(f"Ingested {len(SCRIPTS_DATA)} scripts")

    # 5. Ingest objection library
    rag_pipeline.ingest_objection_library(OBJECTION_LIBRARY)
    logger.info(f"Ingested {len(OBJECTION_LIBRARY)} objections")

    # 6. Ingest doctor profiles
    for profile in DOCTOR_PROFILES:
        doc_id = f"doctor_{profile['name'].lower().replace(' ', '_').replace('.', '')}"
        text = (
            f"Doctor: {profile['name']}\n"
            f"Specialty: {profile['specialty']}\n"
            f"Style: {profile['style']}\n"
            f"Location: {profile['location']}\n"
            f"Notes: {profile['notes']}"
        )
        if rag_pipeline.collection:
            rag_pipeline.collection.upsert(
                ids=[doc_id],
                documents=[text],
                metadatas={"type": "doctor_profile", "name": profile["name"], "specialty": profile["specialty"], "style": profile["style"]},
            )
    logger.info(f"Ingested {len(DOCTOR_PROFILES)} doctor profiles")

    # 7. Ingest visit process
    rag_pipeline.ingest_visit_process()

    # Summary
    count = rag_pipeline.collection.count() if rag_pipeline.collection else 0
    logger.info("=" * 60)
    logger.info(f"Pipeline v2 complete! ChromaDB: {count} documents")
    logger.info("=" * 60)


def _product_to_chunk(product: dict) -> str:
    """Convert a parsed product into a rich text chunk for vector search."""
    parts = [f"Product: {product['name']}"]

    if product.get("gamme"):
        parts.append(f"Gamme: {product['gamme']}")
    if product.get("presentation"):
        parts.append(f"Presentation: {product['presentation']}")
    if product.get("packaging"):
        parts.append(f"Packaging: {product['packaging']}")
    if product.get("age_range"):
        parts.append(f"Age: {product['age_range']}")
    if product.get("indications"):
        parts.append("Indications:")
        for ind in product["indications"][:10]:
            parts.append(f"  - {ind}")
    if product.get("composition"):
        parts.append("Composition:")
        for comp in product["composition"][:15]:
            q = comp.get("quantity", "")
            i = comp.get("ingredient", "")
            parts.append(f"  - {q} {i}".strip())
    poso = product.get("posologie", {})
    if poso.get("headers"):
        parts.append(f"Posologie: {' / '.join(poso['headers'])}")
        for row in poso.get("rows", [])[:5]:
            parts.append(f"  {' | '.join(str(c) for c in row)}")

    return "\n".join(parts)


def _ingest_portfolio(products: list):
    """Build and ingest cross-product portfolio overview."""
    # Group by gamme
    by_gamme = {}
    for p in products:
        g = p.get("gamme", "Autre")
        if g not in by_gamme:
            by_gamme[g] = []
        by_gamme[g].append(p["name"])

    text = "VITAL SA COMPLETE PRODUCT PORTFOLIO\n\n"
    text += "All products available from VITAL SA, organized by gamme:\n\n"
    for gamme, names in sorted(by_gamme.items()):
        text += f"\n{gamme} ({len(names)} products):\n"
        for name in sorted(set(names)):
            text += f"  - {name}\n"

    text += "\n\nWhen a doctor asks about alternatives, compare within the same gamme or therapeutic area."
    text += "\nNever denigrate competitor products. Position based on patient profile and needs."

    if rag_pipeline.collection:
        rag_pipeline.collection.upsert(
            ids=["cross_product_portfolio"],
            documents=[text],
            metadatas={"type": "cross_product", "name": "VITAL SA Portfolio"},
        )

    logger.info(f"Portfolio: {len(by_gamme)} gammes ingested")


if __name__ == "__main__":
    run()
