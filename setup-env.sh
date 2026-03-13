#!/bin/bash

# Environment Variables Setup Script
# This script helps you set up your .env files

echo "🚀 TechRP Environment Variables Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env files already exist
if [ -f "mobile/.env" ]; then
  echo -e "${YELLOW}⚠️  mobile/.env already exists. Backing up to mobile/.env.backup${NC}"
  cp mobile/.env mobile/.env.backup
fi

if [ -f "web/.env.local" ]; then
  echo -e "${YELLOW}⚠️  web/.env.local already exists. Backing up to web/.env.local.backup${NC}"
  cp web/.env.local web/.env.local.backup
fi

echo ""
echo "Please enter your configuration values:"
echo ""

# Supabase Configuration
read -p "Enter your Supabase Project URL: " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Enter your Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY

# Vapi.ai Configuration
read -p "Enter your Vapi.ai API Key: " VAPI_API_KEY

# Anthropic Configuration
read -p "Enter your Anthropic API Key: " ANTHROPIC_API_KEY

# NextAuth Configuration
read -p "Enter your NextAuth Secret (or press Enter to generate one): " NEXTAUTH_SECRET
if [ -z "$NEXTAUTH_SECRET" ]; then
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  echo -e "${GREEN}✓ Generated NextAuth secret${NC}"
fi

# Create mobile/.env
cat > mobile/.env << EOF
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Vapi.ai Configuration
EXPO_PUBLIC_VAPI_API_KEY=$VAPI_API_KEY
EOF

echo -e "${GREEN}✓ Created mobile/.env${NC}"

# Create web/.env.local
cat > web/.env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Vapi.ai Configuration
VAPI_API_KEY=$VAPI_API_KEY

# Anthropic API (for AI assessments)
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
EOF

echo -e "${GREEN}✓ Created web/.env.local${NC}"

echo ""
echo -e "${GREEN}✅ Environment variables configured!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your .env files contain the correct values"
echo "2. Start your development servers:"
echo "   - Mobile: cd mobile && npm start"
echo "   - Web: cd web && npm run dev"
echo ""




