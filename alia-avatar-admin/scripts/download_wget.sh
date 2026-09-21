#!/usr/bin/env bash

# Mirror the entire live template using wget
TARGET_URL="https://shadcn-nextjs-admincn-admin-template.vercel.app"
DEST_DIR="./downloaded_site"

mkdir -p "$DEST_DIR"

echo "Downloading entire template from $TARGET_URL ..."

wget \
  --mirror \
  --convert-links \
  --adjust-extension \
  --page-requisites \
  --no-parent \
  --directory-prefix="$DEST_DIR" \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  "$TARGET_URL"

echo "Download completed into $DEST_DIR"
