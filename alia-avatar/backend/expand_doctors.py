"""
Expanded doctor scraper - gets ALL doctors from med.tn
Run: python expand_doctors.py
"""
import os, sys, io, json, time, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
})
session.get('https://www.med.tn/doctors-directory-tunis', timeout=15)

# Key governorates with their IDs
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
    '61': 'Bizerte',
    '62': 'Jendouba',
    '71': 'Le Kef',
    '81': 'Beja',
    '91': 'Gafsa',
    '101': 'Gabes',
    '102': 'Medenine',
}

MAX_PAGES = 20  # 20 pages × 30 = 600 per governorate

all_doctors = []
seen_urls = set()

for gov_id, gov_name in GOVERNORATES.items():
    print(f'Scraping {gov_name}...', end=' ', flush=True)
    count = 0
    
    for page in range(MAX_PAGES):
        start = page * 30
        data = {
            'start': start, 'spe': '', 'gov': gov_id, 'del': '',
            'grandtunis': '0', 'nearest': '0', 'speciality': 'doctors',
            'arract': '', 'city_country': 'tn', 'geo_country': '',
            'proximity': '0', 'sponsor': '', 'act_id': '',
            'nbMainList': '975', 'is_medinter': '0',
        }
        
        try:
            r = session.post('https://www.med.tn/pagesmd_load.php', data=data, timeout=15)
            matches = re.findall(
                r'<a\s+href="(https://www\.med\.tn/doctor/[^"]+)"\s+title="([^"]*)"',
                r.text
            )
            if not matches:
                break
            
            for url, title in matches:
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                
                url_match = re.match(
                    r'https://www\.med\.tn/doctor/([a-z-]+)/([a-z-]+)/([a-z0-9-]+?)(?:-\d+)?',
                    url
                )
                specialty = url_match.group(1).replace('-', ' ').title() if url_match else ''
                city = url_match.group(2).replace('-', ' ').title() if url_match else ''
                
                all_doctors.append({
                    'name': title.strip(),
                    'specialty': specialty,
                    'city': city,
                    'governorate': gov_name,
                    'profile_url': url,
                })
                count += 1
            
            time.sleep(1.5)
        except Exception as e:
            print(f'Error: {e}')
            time.sleep(5)
    
    print(f'{count} doctors')

# Deduplicate
unique = []
seen = set()
for d in all_doctors:
    if d['profile_url'] not in seen:
        seen.add(d['profile_url'])
        unique.append(d)

# Save
output = 'data/processed/doctors_medtn.json'
with open(output, 'w', encoding='utf-8') as f:
    json.dump(unique, f, ensure_ascii=False, indent=2)

print(f'\nTotal: {len(unique)} unique doctors saved to {output}')

# Stats
specs = {}
cities = {}
for d in unique:
    s = d['specialty']
    c = d['city']
    specs[s] = specs.get(s, 0) + 1
    cities[c] = cities.get(c, 0) + 1

print(f'\nTop specialties:')
for s, c in sorted(specs.items(), key=lambda x: -x[1])[:15]:
    print(f'  {s}: {c}')
print(f'\nTop cities:')
for c, n in sorted(cities.items(), key=lambda x: -x[1])[:10]:
    print(f'  {c}: {n}')
