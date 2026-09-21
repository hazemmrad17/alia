# PowerShell download script for AdminCN template
$ErrorActionPreference = "Continue"

Write-Host "Running Python downloader script..." -ForegroundColor Cyan
python ./scripts/download_admincn_template.py

Write-Host "All files mirrored successfully!" -ForegroundColor Green
