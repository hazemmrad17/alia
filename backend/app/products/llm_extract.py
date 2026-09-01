"""
ALIA Avatar - LLM-Powered Product Extraction
Uses Groq/Claude to extract structured product data from raw PPTX text.
Instead of brittle regex, let the LLM understand the natural language.

Usage:
  python -m app.products.llm_extract
"""
import os
import sys
import json
import time
from typing import List, Dict, Any, Optional
from loguru import logger

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.config import get_settings
from app.ai.llm_engine import LLMEngine
from app.products.pptx_parser import PPTXProductParser

settings = get_settings()

CATALOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "Students", "Data vital", "catalogue", "Catalogue vital")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")


EXTRACTION_PROMPT = """You are a pharmaceutical data extraction assistant. Extract structured product data from the raw text below.

The text comes from a VITAL SA product catalog PowerPoint slide. It may contain:
- Product name
- Indications (what it treats)
- Composition (ingredients with quantities)
- Posologie (dosage)
- Packaging info
- Age range

IMPORTANT RULES:
1. Extract ONLY what is actually present in the text. Do NOT invent data.
2. The product name is often the most prominent text or appears near "COMPOSITION" or "INDICATIONS".
3. Ignore section headers like "INDICATIONS", "COMPOSITION", "POSOLOGIE", "CONSEILS D'UTILISATION" — these are NOT ingredients or product names.
4. For composition, separate quantity from ingredient name properly.
5. If a field is not present in the text, use null or empty array.
6. If the slide contains a TABLE, parse the table data into posologie.

Return ONLY valid JSON with this exact schema:
{
  "name": "string — the product name",
  "presentation": "string — form: Sirop, Gélules, Crème, Gel, Spray, etc.",
  "packaging": "string — e.g. '150 ML', '30 Gélules'",
  "age_range": "string — e.g. 'Adulte', 'Enfant dès la naissance', null",
  "indications": ["array of strings — what the product treats"],
  "composition": [
    {"quantity": "string like '80 mg'", "ingredient": "string like 'Vitamine C'"}
  ],
  "posologie": {
    "note": "string — free-text dosage instructions if no table",
    "table": [["header1", "header2"], ["row1col1", "row1col2"]] or null
  }
}

RAW TEXT FROM SLIDE:
---
{raw_text}
---

JSON:"""


class LLMProductExtractor:
    """Extract structured product data using LLM."""

    def __init__(self):
        self.llm = LLMEngine()
        self.parser = PPTXProductParser(CATALOG_DIR)

    def extract_all(self) -> List[Dict[str, Any]]:
        """Parse all PPTX files and extract structured data via LLM."""
        # Step 1: Parse PPTX to get raw slide text
        gamme_data = self.parser.parse_all()

        all_products = []
        for gamme in gamme_data:
            logger.info(f"Processing {gamme['gamme']} ({len(gamme['products'])} slides)...")
            for i, product in enumerate(gamme["products"]):
                raw_text = product.get("raw_text", "")
                if not raw_text.strip():
                    continue

                # Extract via LLM
                extracted = self._extract_from_text(raw_text, gamme["gamme"])
                if extracted:
                    extracted["gamme"] = gamme["gamme"]
                    all_products.append(extracted)
                    logger.info(f"  [{i+1}] {extracted['name']}: {len(extracted.get('indications', []))} indications, {len(extracted.get('composition', []))} ingredients")

                # Small delay to respect rate limits
                time.sleep(0.2)

        return all_products

    def _extract_from_text(self, raw_text: str, gamme_name: str) -> Optional[Dict[str, Any]]:
        """Send raw text to LLM for structured extraction."""
        prompt = EXTRACTION_PROMPT.format(raw_text=raw_text[:3000])  # Limit length

        messages = [
            {"role": "system", "content": "You are a precise data extraction assistant. Return ONLY valid JSON, no markdown, no explanation."},
            {"role": "user", "content": prompt},
        ]

        try:
            response = self.llm._chat_completion(messages, temperature=0.1, max_tokens=2048)
            if not response:
                return None

            # Clean up response - remove markdown code blocks if present
            response = response.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[1] if "\n" in response else response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()

            # Parse JSON
            data = json.loads(response)

            # Validate required fields
            if not data.get("name"):
                data["name"] = gamme_name

            return data

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse failed: {e}")
            logger.debug(f"Raw response: {response[:200]}")
            return None
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return None

    def save(self, products: List[Dict], output_path: str):
        """Save extracted products."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(products)} products to {output_path}")


def run_extraction():
    """Main extraction pipeline."""
    logger.info("=" * 60)
    logger.info("LLM-Powered Product Extraction")
    logger.info("=" * 60)

    extractor = LLMProductExtractor()
    products = extractor.extract_all()

    # Save
    output_path = os.path.join(OUTPUT_DIR, "products_llm_extracted.json")
    extractor.save(products, output_path)

    # Summary
    logger.info(f"\nExtracted {len(products)} products")
    for p in products[:5]:
        logger.info(f"  {p['name']} ({p.get('gamme', '?')}): "
                     f"{len(p.get('indications', []))} indications, "
                     f"{len(p.get('composition', []))} ingredients")


if __name__ == "__main__":
    run_extraction()
