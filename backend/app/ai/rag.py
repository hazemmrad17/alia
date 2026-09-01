"""
ALIA Avatar - RAG Pipeline
Retrieval-Augmented Generation for product knowledge from VITAL SA catalog.
"""
import os
import json
from typing import List, Optional, Dict, Any
from loguru import logger

from app.config import get_settings

settings = get_settings()

# Try importing ChromaDB
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    HAS_CHROMA = True
except ImportError:
    HAS_CHROMA = False
    logger.warning("ChromaDB not installed. Using fallback RAG.")


class RAGPipeline:
    """Retrieval-Augmented Generation pipeline for ALIA product knowledge."""

    def __init__(self):
        self.collection = None
        self.chroma_client = None
        self._initialized = False
        self._fallback_data: Dict[str, Any] = {}

    def initialize(self):
        """Initialize the vector store."""
        if self._initialized:
            return

        if HAS_CHROMA:
            # Use persistent local storage by default
            # Walk up from this file to find the backend/ directory
            _this_dir = os.path.dirname(os.path.abspath(__file__))
            _backend_dir = _this_dir
            while _backend_dir != os.path.dirname(_backend_dir):
                if os.path.exists(os.path.join(_backend_dir, "requirements.txt")):
                    break
                _backend_dir = os.path.dirname(_backend_dir)
            persist_dir = os.path.join(_backend_dir, "data", "vector_store")
            os.makedirs(persist_dir, exist_ok=True)
            self.chroma_client = chromadb.PersistentClient(path=persist_dir)
            logger.info(f"Using persistent ChromaDB at: {persist_dir}")

            self.collection = self.chroma_client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(f"ChromaDB initialized with collection: {settings.CHROMA_COLLECTION}")
        else:
            self._load_fallback_data()

        self._initialized = True

    def _load_fallback_data(self):
        """Load data from processed JSON files as fallback."""
        processed_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")
        for filename in os.listdir(processed_dir) if os.path.exists(processed_dir) else []:
            if filename.endswith(".json"):
                filepath = os.path.join(processed_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self._fallback_data[filename] = data
                        logger.info(f"Loaded fallback data: {filename}")
                except Exception as e:
                    logger.error(f"Failed to load {filename}: {e}")

    def ingest_product(self, product_data: Dict[str, Any]):
        """Ingest a single product into the vector store."""
        if not self._initialized:
            self.initialize()

        product_name = product_data.get("name", "unknown")
        doc_id = f"product_{product_name.lower().replace(' ', '_')}"

        # Create searchable text
        text = self._product_to_text(product_data)

        # Metadata
        metadata = {
            "type": "product",
            "name": product_name,
            "category": product_data.get("category", ""),
            "therapeutic_area": product_data.get("therapeutic_area", ""),
            "gamme": product_data.get("gamme", ""),
        }

        if self.collection:
            self.collection.upsert(
                ids=[doc_id],
                documents=[text],
                metadatas=[metadata],
            )
        else:
            self._fallback_data[doc_id] = {"text": text, "metadata": metadata, "data": product_data}

    def ingest_script(self, script_data: Dict[str, Any]):
        """Ingest a sales script into the vector store."""
        if not self._initialized:
            self.initialize()

        product_name = script_data.get("product_name", "unknown")
        doc_id = f"script_{product_name.lower().replace(' ', '_')}"

        text = self._script_to_text(script_data)

        metadata = {
            "type": "script",
            "product_name": product_name,
            "category": script_data.get("category", ""),
            "specialties": ",".join(script_data.get("specialties", [])),
        }

        if self.collection:
            self.collection.upsert(
                ids=[doc_id],
                documents=[text],
                metadatas=[metadata],
            )
        else:
            self._fallback_data[doc_id] = {"text": text, "metadata": metadata, "data": script_data}

    def ingest_objection_library(self, objections: List[Dict[str, str]]):
        """Ingest the objection library."""
        if not self._initialized:
            self.initialize()

        text = "OBJECTION LIBRARY:\n\n"
        for obj in objections:
            text += f"Objection: {obj.get('objection', '')}\n"
            text += f"Clarification: {obj.get('clarification', '')}\n"
            text += f"Response: {obj.get('response', '')}\n\n"

        metadata = {"type": "objection_library"}

        if self.collection:
            self.collection.upsert(
                ids=["objection_library"],
                documents=[text],
                metadatas=[metadata],
            )

    def ingest_visit_process(self):
        """Ingest the VITAL SA visit process knowledge."""
        if not self._initialized:
            self.initialize()

        visit_process_text = """
VITAL SA MEDICAL VISIT PROCESS (6 STEPS):

1. INTRODUCTION (Instant Zero):
   - Create favorable climate, get permission
   - Script: "Bonjour Docteur, ALIA - VITAL SA. I'll be very brief: 2 minutes. I wanted to share something practical about [benefit patient]. Is that OK for you?"
   - Rules: respect time, calm tone, clean exit on refusal

2. SONDAGE (Questions + Active Listening):
   - 2-4 questions max depending on time
   - Question types: Situation, Problem, Practice, Criteria, Validation
   - Rule: speaking time ≤ 50%. Use silence. Don't interrupt.

3. SYNTHÈSE (Reformulation / QARE):
   - Validate the need and align understanding
   - "If I summarize: your priority is X for Y, and your main expectation is Z. Is that correct?"

4. OBJECTIONS (A-C-R-V Method):
   - Welcome → Clarify → Respond → Validate
   - Never ignore an objection. Stay calm. Don't counter-argue.

5. ARGUMENTATION (Need → Benefits → Proof → Usage):
   - Refer validated need (1 sentence)
   - 2-3 max benefits (patient/practice oriented)
   - 1 proof or reference (short, prudent)
   - For which patient profile + how to use

6. CONCLUSION & ENGAGEMENT (BIP):
   - BIP Signals: detailed questions, no objections, sample request, usage projection
   - "So we agree on [2 benefits]. Would you try it with 2-3 patients matching [profile]?"

VISIT FORMATS:
- Flash (20-60s): Permission → 1 value → 1 benefit → 1 minimal commitment
- Standard (2-4 min): Permission → 2 questions → Synthèse → 2-3 arguments → 1-2 objections → Closing
- Deep (5-8 min): Rich discovery → Patient segmentation → Evidence → Test plan → Follow-up

DOCTOR STYLES:
- Analysant: Proof-oriented, needs data and studies
- Controlant: Structure-oriented, needs clear process
- Facilitant: Relationship-oriented, values rapport
- Promouvant: Innovation-oriented, likes novelty

SONCAS Framework:
- Sécurité (Security), Orgueil (Pride), Notoriété (Reputation), Confort (Comfort), Argent (Money), Sympathie (Sympathy)

ALIA COMPETENCE LEVELS:
- Débutant: Scripted, basic product knowledge, 1 objection
- Junior: Interactive, 2-4 questions, 2 objections, 5-10 products
- Confirmé: Autonomous, adapts to style, 3 objections, 15-30 products
- Expert: Top performer, difficult visits, coaching ability, full portfolio
"""

        if self.collection:
            self.collection.upsert(
                ids=["visit_process"],
                documents=[visit_process_text],
                metadatas=[{"type": "visit_process"}],
            )

    def retrieve(self, query: str, n_results: int = 5) -> List[str]:
        """Retrieve relevant documents for a query."""
        if not self._initialized:
            self.initialize()

        if self.collection:
            try:
                results = self.collection.query(
                    query_texts=[query],
                    n_results=n_results,
                )
                if results and results.get("documents"):
                    return results["documents"][0]
            except Exception as e:
                logger.error(f"ChromaDB query failed: {e}")

        # Fallback: simple text search
        return self._fallback_search(query, n_results)

    def get_product_context(self, product_name: str) -> Optional[str]:
        """Get full context for a specific product."""
        if not self._initialized:
            self.initialize()

        if self.collection:
            try:
                results = self.collection.query(
                    query_texts=[product_name],
                    n_results=3,
                    where={"name": product_name} if product_name else None,
                )
                if results and results.get("documents"):
                    return "\n\n".join(results["documents"][0])
            except Exception as e:
                logger.error(f"Product context query failed: {e}")

        # Fallback
        for key, data in self._fallback_data.items():
            if product_name.lower() in key.lower():
                return data.get("text", "")
        return None

    def build_rag_context(self, product_focus: Optional[str] = None) -> str:
        """Build RAG context for the current conversation with cross-product awareness."""
        if not self._initialized:
            self.initialize()

        parts = []
        seen = set()  # Avoid duplicates

        def add_if_new(text: str, label: str):
            if text and label not in seen:
                seen.add(label)
                parts.append(text)

        # 1. Always include cross-product portfolio overview
        portfolio_docs = self.retrieve("VITAL SA product portfolio category therapeutic area", n_results=3)
        if portfolio_docs:
            add_if_new("PORTFOLIO OVERVIEW:\n" + "\n".join(portfolio_docs[:1]), "portfolio")

        # 2. Product-specific context
        if product_focus:
            product_docs = self.get_product_context(product_focus)
            if product_docs:
                add_if_new(f"PRODUCT - {product_focus}:\n{product_docs}", f"product_{product_focus}")

            script_docs = self.retrieve(f"script {product_focus}", n_results=2)
            if script_docs:
                add_if_new(f"SCRIPTS for {product_focus}:\n" + "\n".join(script_docs), f"scripts_{product_focus}")

            # Related products (same category)
            related_docs = self.retrieve(f"similar alternative {product_focus}", n_results=3)
            if related_docs:
                add_if_new(f"RELATED/ALTERNATIVE PRODUCTS:\n" + "\n".join(related_docs), "related")

        # 3. Objection library (always available)
        objection_docs = self.retrieve("objections responses", n_results=3)
        if objection_docs:
            add_if_new("OBJECTION LIBRARY:\n" + "\n".join(objection_docs), "objections")

        # 4. Doctor profiles
        doctor_docs = self.retrieve("doctor profile specialty style", n_results=2)
        if doctor_docs:
            add_if_new("DOCTOR PROFILES:\n" + "\n".join(doctor_docs), "doctors")

        # 5. Visit process (last, as reference)
        visit_docs = self.retrieve("medical visit process 6 steps", n_results=1)
        if visit_docs:
            add_if_new("VISIT PROCESS REFERENCE:\n" + "\n".join(visit_docs), "visit")

        return "\n\n---\n\n".join(parts)

    def _product_to_text(self, data: Dict[str, Any]) -> str:
        """Convert product data to searchable text."""
        parts = [f"Product: {data.get('name', '')}"]
        if data.get("category"):
            parts.append(f"Category: {data['category']}")
        if data.get("therapeutic_area"):
            parts.append(f"Therapeutic Area: {data['therapeutic_area']}")
        if data.get("specialties"):
            parts.append(f"Specialties: {', '.join(data['specialties'])}")
        if data.get("key_benefits"):
            parts.append(f"Key Benefits: {'; '.join(data['key_benefits'])}")
        if data.get("dosage"):
            parts.append(f"Dosage: {data['dosage']}")
        if data.get("precautions"):
            parts.append(f"Precautions: {'; '.join(data['precautions'])}")
        if data.get("evidence"):
            parts.append(f"Evidence: {'; '.join(data['evidence'])}")
        return "\n".join(parts)

    def _script_to_text(self, data: Dict[str, Any]) -> str:
        """Convert script data to searchable text."""
        parts = [f"Script for: {data.get('product_name', '')}"]
        if data.get("message_coeur"):
            parts.append(f"Core Message: {data['message_coeur']}")
        if data.get("questions"):
            parts.append(f"Discovery Questions: {'; '.join(data['questions'])}")
        if data.get("argumentation"):
            parts.append(f"Argumentation: {'; '.join(data['argumentation'])}")
        if data.get("objections"):
            for obj in data["objections"]:
                parts.append(f"Objection: {obj.get('objection', '')}")
                parts.append(f"Response: {obj.get('response', '')}")
        return "\n".join(parts)

    def _fallback_search(self, query: str, n_results: int) -> List[str]:
        """Simple keyword search fallback."""
        query_lower = query.lower()
        results = []
        for key, data in self._fallback_data.items():
            text = data.get("text", "")
            if any(word in text.lower() for word in query_lower.split()):
                results.append(text)
                if len(results) >= n_results:
                    break
        return results


# Global instance
rag_pipeline = RAGPipeline()
