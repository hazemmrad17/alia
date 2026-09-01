"""
ALIA Avatar - LLM Product Extraction v2
Batch extracts structured product data from all PPTX slides via Groq.
"""
import os
import sys
import json
import time
import re
from typing import List, Dict, Any, Optional
from loguru import logger

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.ai.llm_engine import LLMEngine
from app.products.pptx_parser import PPTXProductParser

CATALOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "Students", "Data vital", "catalogue", "Catalogue vital")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

EXTRACTION_PROMPT = """Extract structured product data from this VITAL SA pharmaceutical product catalog slide.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "name": "product name as shown on slide",
  "presentation": "form: Sirop, Gelules, Creme, Gel, Spray, Comprime, Solution, Savon, etc.",
  "packaging": "e.g. 150 ML, 30 Gelules, 90 g",
  "age_range": "e.g. Adulte, Enfant, Dès la naissance, or null",
  "indications": ["list of what the product treats/does"],
  "composition": [
    {"quantity": "e.g. 20 mg", "ingredient": "e.g. Extrait sec de Tilleul (Tilia cordata)"}
  ],
  "posologie": {
    "note": "free-text dosage instructions",
    "table": [["AGE", "MATIN", "MIDI", "SOIR"], ["Adulte", "10 ml", "-", "-"]] or null
  }
}

RULES:
- Extract ONLY what is in the text. Do NOT invent.
- Ignore headers: INDICATIONS, COMPOSITION, POSOLOGIE, CONSEILS D UTILISATION
- The product name is usually the most prominent text or near COMPOSITION
- Separate quantity from ingredient properly
- If no table, put dosage in "note" and set "table" to null

RAW TEXT:
---
{raw_text}
---

JSON:"""


class LLMProductExtractorV2:
    """Batch LLM extraction for all PPTX slides."""

    def __init__(self):
        self.llm = LLMEngine()
        self.parser = PPTXProductParser(CATALOG_DIR)

    def extract_all(self) -> List[Dict[str, Any]]:
        """Parse all PPTX files and extract via LLM."""
        gamme_data = self.parser.parse_all()
        all_products = []
        total_slides = sum(len(g["products"]) for g in gamme_data)
        processed = 0
        errors = 0

        for gamme in gamme_data:
            gamme_name = gamme["gamme"]
            logger.info(f"--- {gamme_name} ({len(gamme['products'])} slides) ---")

            for product in gamme["products"]:
                processed += 1
                raw_text = product.get("raw_text", "").strip()
                if not raw_text or len(raw_text) < 20:
                    continue

                extracted = self._extract(raw_text, gamme_name)
                if extracted:
                    extracted["gamme"] = gamme_name
                    all_products.append(extracted)
                else:
                    errors += 1

                if processed % 20 == 0:
                    logger.info(f"  Progress: {processed}/{total_slides} ({errors} errors)")

                time.sleep(0.15)  # Rate limit

        logger.info(f"Done: {len(all_products)} products extracted, {errors} errors")
        return all_products

    def _extract(self, raw_text: str, gamme_name: str) -> Optional[Dict[str, Any]]:
        """Extract one slide via LLM."""
        prompt = EXTRACTION_PROMPT.replace("{raw_text}", raw_text[:3000])

        for attempt in range(2):
            try:
                resp = self.llm._chat_completion([
                    {"role": "system", "content": "You extract pharmaceutical product data. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt},
                ], temperature=0.1, max_tokens=1500)

                if not resp:
                    continue

                # Clean response
                resp = resp.strip()
                if resp.startswith("```"):
                    resp = resp.split("\n", 1)[1] if "\n" in resp else resp[3:]
                if resp.endswith("```"):
                    resp = resp[:-3]
                resp = resp.strip()

                # Sometimes the model puts "<think>" blocks - extract JSON after them
                if "<think>" in resp:
                    # Find JSON start
                    json_start = resp.rfind("{")
                    if json_start >= 0:
                        resp = resp[json_start:]

                data = json.loads(resp)

                # Validate
                if not data.get("name"):
                    data["name"] = gamme_name

                # Ensure lists
                for key in ["indications", "composition"]:
                    if not isinstance(data.get(key), list):
                        data[key] = []

                # Ensure posologie
                if not isinstance(data.get("posologie"), dict):
                    data["posologie"] = {"note": "", "table": None}

                return data

            except json.JSONDecodeError:
                logger.debug(f"JSON parse attempt {attempt+1} failed")
                continue
            except Exception as e:
                logger.debug(f"Extract error: {e}")
                continue

        return None

    def deduplicate(self, products: List[Dict]) -> List[Dict]:
        """Deduplicate products by name+gamme."""
        seen = {}
        result = []
        for p in products:
            key = f"{p['name'].lower().strip()}|{p.get('gamme', '').lower()}"
            if key in seen:
                existing = seen[key]
                # Keep the one with more data
                if len(p.get("indications", [])) + len(p.get("composition", [])) > \
                   len(existing.get("indications", [])) + len(existing.get("composition", [])):
                    seen[key] = p
            else:
                seen[key] = p
                result.append(p)
        return result

    def save(self, products: List[Dict], path: str):
        """Save extracted products."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(products)} products to {path}")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("LLM Product Extraction - All 21 Gamme Files")
    logger.info("=" * 60)

    extractor = LLMProductExtractorV2()
    products = extractor.extract_all()

    # Deduplicate
    products = extractor.deduplicate(products)
    logger.info(f"After dedup: {len(products)} unique products")

    # Save
    output = os.path.join(OUTPUT_DIR, "products_llm.json")
    extractor.save(products, output)

    # Quick summary
    print(f"\nExtracted {len(products)} products:")
    for p in products[:10]:
        ind = len(p.get("indications", []))
        comp = len(p.get("composition", []))
        print(f"  {p['name']} ({p.get('gamme', '?')}): {ind} ind, {comp} comp")
