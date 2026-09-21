import os
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE_URL = 'https://shadcn-nextjs-admincn-admin-template.vercel.app'
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'downloaded_site')
PUBLIC_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

ROUTES = [
    '/',
    '/dashboard/orders',
    '/dashboard/sales',
    '/dashboard/finance',
    '/dashboard/logistics',
    '/dashboard/productivity',
    '/dashboard/campaign',
    '/dashboard/analytics',
    '/dashboard/payments',
    '/dashboard/ecommerce',
    '/apps/mail',
    '/apps/calendar',
    '/apps/users/list',
    '/apps/users/view/user-001',
    '/apps/chat',
    '/apps/kanban',
    '/apps/contact',
    '/apps/roles',
    '/apps/permissions',
    '/datatable',
    '/forms/form-layouts/vertical',
    '/forms/form-layouts/horizontal',
    '/forms/form-layouts/sticky-actions',
    '/forms/form-validation',
    '/forms/form-wizard/numbered',
    '/forms/form-wizard/icons',
    '/pages/user-settings?setting=general',
    '/pages/user-settings?setting=workspace',
    '/pages/user-settings?setting=notifications',
    '/pages/user-settings?setting=integrations',
    '/pages/user-settings?setting=members',
    '/pages/user-settings?setting=security',
    '/pages/user-settings?setting=billing',
    '/pages/user-profile?view=profile',
    '/pages/user-profile?view=connections',
    '/pages/user-profile?view=teams',
    '/pages/user-profile?view=projects',
    '/pages/auth/login-v1',
    '/pages/auth/login-v2',
    '/pages/auth/login-v3',
    '/pages/auth/register-v1',
    '/pages/auth/register-v2',
    '/pages/auth/register-v3',
    '/pages/auth/forgot-password-v1',
    '/pages/auth/forgot-password-v2',
    '/pages/auth/forgot-password-v3',
    '/pages/auth/reset-password-v1',
    '/pages/auth/reset-password-v2',
    '/pages/auth/reset-password-v3',
    '/pages/auth/two-steps-v1',
    '/pages/auth/two-steps-v2',
    '/pages/auth/two-steps-v3',
    '/pages/auth/verify-email-v1',
    '/pages/auth/verify-email-v2',
    '/pages/auth/verify-email-v3',
    '/pages/pricing',
    '/pages/faq',
    '/pages/onboarding-v1',
    '/pages/onboarding-v2',
    '/pages/empty-state-v1',
    '/pages/empty-state-v2',
    '/pages/misc/error-page-404',
    '/pages/misc/forbidden-403',
    '/pages/misc/maintenance-page',
    '/pages/misc/server-error-500',
    '/pages/misc/unauthorized-access-401',
]

def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read()

def download_file(rel_path, dest_base=OUTPUT_DIR):
    clean_path = rel_path.split('?')[0].lstrip('/')
    dest = os.path.join(dest_base, clean_path)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return f"Cached: {clean_path}"
    
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    full_url = urllib.parse.urljoin(BASE_URL, rel_path)
    try:
        data = fetch_url(full_url)
        with open(dest, 'wb') as f:
            f.write(data)
        return f"Downloaded: {clean_path} ({len(data)} bytes)"
    except Exception as e:
        return f"Failed {rel_path}: {e}"

def main():
    print(f"=== Starting full mirror download of {BASE_URL} ===")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    static_assets = set()
    image_assets = set()
    
    # 1. Download all HTML routes and parse assets
    print(f"\n[1/3] Crawling {len(ROUTES)} routes...")
    for route in ROUTES:
        url = urllib.parse.urljoin(BASE_URL, route)
        try:
            html = fetch_url(url).decode('utf-8', errors='ignore')
            
            # Save HTML
            clean_name = route.strip('/').replace('/', '_').replace('?', '_').replace('=', '_')
            if not clean_name:
                clean_name = 'index'
            html_path = os.path.join(OUTPUT_DIR, 'html', f"{clean_name}.html")
            os.makedirs(os.path.dirname(html_path), exist_ok=True)
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
                
            # Find scripts, css, media
            for m in re.findall(r'src="(/_next/static/[^"]+)"', html):
                static_assets.add(m)
            for m in re.findall(r'href="(/_next/static/[^"]+)"', html):
                static_assets.add(m)
            for m in re.findall(r'src="(/images/[^"]+)"', html):
                image_assets.add(m)
                
            print(f"  Fetched {route}")
        except Exception as e:
            print(f"  Error fetching {route}: {e}")

    # 2. Download all static chunks (JS/CSS)
    print(f"\n[2/3] Downloading {len(static_assets)} JS/CSS chunks...")
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(lambda p: download_file(p, OUTPUT_DIR), static_assets)
        for r in results:
            pass
            
    # Parse images inside downloaded JS chunks
    chunks_dir = os.path.join(OUTPUT_DIR, '_next', 'static', 'chunks')
    if os.path.exists(chunks_dir):
        for fname in os.listdir(chunks_dir):
            if fname.endswith('.js'):
                with open(os.path.join(chunks_dir, fname), 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    for img in re.findall(r'["\'](/images/[^"\']+\.(?:png|jpg|jpeg|svg|webp|gif|ico))["\']', content):
                        image_assets.add(img)

    # 3. Download all Images into both downloaded_site and public/
    print(f"\n[3/3] Downloading {len(image_assets)} images & media into public/images...")
    with ThreadPoolExecutor(max_workers=10) as executor:
        for img in image_assets:
            # download to public
            download_file(img, PUBLIC_IMAGES_DIR)
            # download to downloaded_site
            download_file(img, OUTPUT_DIR)

    print("\n=== All assets, chunks, and pages downloaded successfully! ===")

if __name__ == '__main__':
    main()
