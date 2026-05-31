#!/bin/bash
set -e

echo "Setting up JobRadar..."

# Backend
cd backend
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r ../requirements.txt
playwright install chromium
mkdir -p ../logs

# Frontend
cd ../frontend
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Before running:"
echo "  1. Add your Gemini API key to config.yaml (llm.api_key)"
echo "  2. Get a free key at: https://aistudio.google.com/apikey"
echo ""
echo "To run:"
echo "  Terminal 1: cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "  Terminal 2: cd frontend && npm run dev"
