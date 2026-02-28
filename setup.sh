#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# setup.sh — Chạy script này 1 lần trên GitHub Codespaces
# để khởi tạo repo với git push đúng cách
#
# Cách chạy:
#   1. Vào repo GitHub của bạn
#   2. Nhấn nút xanh "Code" → tab "Codespaces" → "Create codespace on main"
#   3. Đợi ~30s cho terminal mở ra
#   4. Paste lệnh sau vào terminal:
#        bash setup.sh
# ═══════════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   MEMESLOTS — Git Init Setup             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Kiểm tra git đã init chưa
if [ ! -d ".git" ]; then
  echo "📁 Khởi tạo git repo..."
  git init -b main
  git add -A
  git commit -m "initial commit: memeslots dapp"
  echo "✅ Git repo initialized"
else
  # Đảm bảo tất cả file đã được track
  echo "📝 Staging all files..."
  git add -A

  if ! git diff --staged --quiet; then
    git commit -m "fix: ensure workflow files are tracked"
    echo "✅ Changes committed"
  else
    echo "✅ Repo up to date"
  fi
fi

# Kiểm tra workflow file tồn tại
if [ -f ".github/workflows/deploy-factory.yml" ]; then
  echo "✅ Workflow file exists: .github/workflows/deploy-factory.yml"
else
  echo "❌ Workflow file missing!"
  exit 1
fi

echo ""
echo "✨ Done! Giờ vào tab Actions → 'Deploy Factory to OP_NET' → Run workflow"
