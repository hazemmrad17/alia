import os
import re

downloaded_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'downloaded_site')
html_dir = os.path.join(downloaded_dir, 'html')

# 1. Update all HTML files in html/ to have relative paths so scripts and CSS load properly
if os.path.exists(html_dir):
    for fname in os.listdir(html_dir):
        if fname.endswith('.html'):
            fpath = os.path.join(html_dir, fname)
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace /_next/ with ../_next/
            content_fixed = re.sub(r'(src|href)=["\']/_next/', r'\1="../_next/', content)
            # Replace /images/ with ../images/
            content_fixed = re.sub(r'(src|href)=["\']/images/', r'\1="../images/', content_fixed)
            # Replace /favicon.ico with ../favicon.ico
            content_fixed = re.sub(r'(src|href)=["\']/favicon', r'\1="../favicon', content_fixed)
            
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content_fixed)

print("Updated all HTML files in downloaded_site/html with relative asset paths!")

# 2. Create an index.html at root of downloaded_site
index_path = os.path.join(downloaded_dir, 'index.html')
links_html = ""
if os.path.exists(html_dir):
    for fname in sorted(os.listdir(html_dir)):
        if fname.endswith('.html'):
            name = fname.replace('.html', '').replace('_', ' / ')
            links_html += f'<li><a href="html/{fname}" style="color: #3b82f6; text-decoration: none; font-size: 15px; font-weight: 500;">{name}</a></li>\n'

index_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AdminCN - Downloaded Pro Pages Mirror</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
      margin: 0;
      padding: 40px;
    }}
    .container {{
      max-width: 900px;
      margin: 0 auto;
    }}
    h1 {{
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }}
    p {{
      color: #a1a1aa;
      margin-bottom: 24px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
      list-style: none;
      padding: 0;
    }}
    li {{
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 12px 16px;
      transition: all 0.2s ease;
    }}
    li:hover {{
      border-color: #3b82f6;
      background: #27272a;
      transform: translateY(-2px);
    }}
  </style>
</head>
<body>
  <div class="container">
    <h1>AdminCN Pro Pages Mirror</h1>
    <p>Select any downloaded Pro page below to view the full layout with JS scripts, Recharts, and styling:</p>
    <ul class="grid">
      {links_html}
    </ul>
  </div>
</body>
</html>
"""

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_content)

print(f"Created index directory at: {index_path}")
