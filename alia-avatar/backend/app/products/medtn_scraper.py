"""
ALIA Avatar - Tunisian Doctor Scraper (med.tn)
Scrapes doctor names, specialties, cities, and profile photos from med.tn
Run: python -m app.products.medtn_scraper
"""
import os
import sys
import json
import time
import re
from typing import List, Dict, Any
from loguru import logger

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import requests

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

# Tunisian governorates with their IDs
GOVERNORATES = {
    '16': 'Tunis',
    '23': 'Ariana',
    '12': 'Ben Arous',
    '22': 'Manouba',
    '21': 'Nabeul',
    '31': 'Sousse',
    '32': 'Monastir',
    '33': 'Mahdia',
    '41': 'Sfax',
    '42': 'Sidi Bouzid',
    '51': 'Kairouan',
    '52': 'Kasserine',
    '61': 'Bizerte',
    '62': 'Jendouba',
    '71': 'Le Kef',
    '72': 'Siliana',
    '81': 'Beja',
    '82': 'El Kef',  # sometimes dup
    '91': 'Gafsa',
    '92': 'Tozeur',
    '93': 'Dehiba',  # Tataouine
    '101': 'Gabes',
    '102': 'Medenine',
    '103': 'Tataouine',
    '111': 'Kebili',
    '112': 'Zaghouan',
    '121': 'Kairouan',
}


class MedTNScraper:
    """Scrape Tunisian doctors from med.tn."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        })
        self._initialized = False

    def _init_session(self):
        """Get cookies by visiting a page first."""
        if self._initialized:
            return
        try:
            self.session.get('https://www.med.tn/doctors-directory-tunis', timeout=15)
            self._initialized = True
            logger.info("Session initialized")
        except Exception as e:
            logger.error(f"Session init failed: {e}")

    def scrape_governorate(self, gov_id: str, gov_name: str, max_pages: int = 10) -> List[Dict[str, Any]]:
        """Scrape all doctors from a governorate."""
        self._init_session()
        doctors = []

        for page in range(max_pages):
            start = page * 30
            data = {
                'start': start,
                'spe': '',
                'gov': gov_id,
                'del': '',
                'grandtunis': '0',
                'nearest': '0',
                'speciality': 'doctors',
                'arract': '',
                'city_country': 'tn',
                'geo_country': '',
                'proximity': '0',
                'sponsor': '',
                'act_id': '',
                'nbMainList': '975',
                'is_medinter': '0',
            }

            try:
                r = self.session.post(
                    'https://www.med.tn/pagesmd_load.php',
                    data=data, timeout=15
                )
                if not r.text:
                    break

                page_doctors = self._parse_cards(r.text, gov_name)
                if not page_doctors:
                    break

                doctors.extend(page_doctors)
                logger.info(f"  {gov_name} page {page+1}: {len(page_doctors)} doctors (total: {len(doctors)})")

                time.sleep(2)  # Rate limit

            except Exception as e:
                logger.error(f"  Error on {gov_name} page {page+1}: {e}")
                time.sleep(5)

        return doctors

    def _parse_cards(self, html: str, governorate: str) -> List[Dict[str, Any]]:
        """Parse doctor cards from HTML response."""
        doctors = []

        # Find all doctor links with title attribute
        # Pattern: <a href="URL" title="Dr NAME SPECIALTY">
        pattern = r'<a\s+href="(https://www\.med\.tn/doctor/[^"]+)"\s+title="([^"]*)"'
        matches = re.findall(pattern, html)

        for url, title in matches:
            # Parse title: "Dr Name Specialty" or "Pr Name Specialty"
            title = title.strip()
            if not title:
                continue

            # Extract name and specialty from URL structure
            # URL: /doctor/SPECIALITY/CITY/dr-name-id.html
            url_match = re.match(
                r'https://www\.med\.tn/doctor/([a-z-]+)/([a-z-]+)/([a-z0-9-]+?)(?:-\d+)?',
                url
            )

            specialty_slug = url_match.group(1) if url_match else ''
            city_slug = url_match.group(2) if url_match else ''
            name_slug = url_match.group(3) if url_match else ''

            # Clean up
            specialty = specialty_slug.replace('-', ' ').title()
            city = city_slug.replace('-', ' ').title()
            name = title.split(specialty)[0].strip() if specialty.lower() in title.lower() else title

            # Find profile image
            img_pattern = rf'data-src="(https://image\.medlink\.tn/[^"]*{re.escape(name_slug)}[^"]*)"'
            img_match = re.search(img_pattern, html)
            photo_url = img_match.group(1) if img_match else None

            doctors.append({
                'name': name,
                'specialty': specialty,
                'city': city,
                'governorate': governorate,
                'profile_url': url,
                'photo_url': photo_url,
            })

        return doctors

    def scrape_all(self, governorates: Dict[str, str] = None, max_pages_per_gov: int = 5) -> List[Dict[str, Any]]:
        """Scrape doctors from all governorates."""
        if governorates is None:
            governorates = GOVERNORATES

        all_doctors = []
        for gov_id, gov_name in governorates.items():
            logger.info(f"Scraping {gov_name} (gov={gov_id})...")
            doctors = self.scrape_governorate(gov_id, gov_name, max_pages_per_gov)
            all_doctors.extend(doctors)
            time.sleep(3)  # Pause between governorates

        # Deduplicate by profile_url
        seen = set()
        unique = []
        for d in all_doctors:
            if d['profile_url'] not in seen:
                seen.add(d['profile_url'])
                unique.append(d)

        logger.info(f"Total: {len(unique)} unique doctors from {len(governorates)} governorates")
        return unique

    def scrape_by_specialty(self, specialty_slug: str, max_pages: int = 5) -> List[Dict[str, Any]]:
        """Scrape doctors by specialty across all of Tunisia."""
        self._init_session()
        doctors = []

        for page in range(max_pages):
            start = page * 30
            data = {
                'start': start,
                'spe': specialty_slug,
                'gov': '',
                'del': '',
                'grandtunis': '0',
                'nearest': '0',
                'speciality': 'doctors',
                'arract': '',
                'city_country': 'tn',
                'geo_country': '',
                'proximity': '0',
                'sponsor': '',
                'act_id': '',
                'nbMainList': '975',
                'is_medinter': '0',
            }

            try:
                r = self.session.post(
                    'https://www.med.tn/pagesmd_load.php',
                    data=data, timeout=15
                )
                if not r.text:
                    break
                page_doctors = self._parse_cards(r.text, "Tunisia")
                if not page_doctors:
                    break
                doctors.extend(page_doctors)
                time.sleep(2)
            except Exception as e:
                logger.error(f"Error: {e}")
                break

        return doctors

    def save(self, doctors: List[Dict], path: str):
        """Save scraped doctors."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(doctors, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(doctors)} doctors to {path}")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Med.tn Doctor Scraper - Tunisian Doctors")
    logger.info("=" * 60)

    scraper = MedTNScraper()

    # Scrape all governorates (limit pages to stay reasonable)
    doctors = scraper.scrape_all(max_pages_per_gov=5)

    # Save
    output = os.path.join(OUTPUT_DIR, "doctors_medtn.json")
    scraper.save(doctors, output)

    # Summary
    specialties = {}
    cities = {}
    for d in doctors:
        s = d.get('specialty', 'Unknown')
        c = d.get('city', 'Unknown')
        specialties[s] = specialties.get(s, 0) + 1
        cities[c] = cities.get(c, 0) + 1

    print(f"\nDoctors scraped: {len(doctors)}")
    print(f"\nTop specialties:")
    for s, c in sorted(specialties.items(), key=lambda x: -x[1])[:15]:
        print(f"  {s}: {c}")
    print(f"\nTop cities:")
    for c, n in sorted(cities.items(), key=lambda x: -x[1])[:10]:
        print(f"  {c}: {n}")
