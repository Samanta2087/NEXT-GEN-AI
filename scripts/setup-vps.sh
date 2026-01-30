#!/bin/bash

# VPS Setup Script for Creative-Audio-Forge
# This script installs all required dependencies on Ubuntu/Debian VPS

set -e

echo "=================================="
echo "Creative-Audio-Forge VPS Setup"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Warning: Running without root. Some installations may require sudo.${NC}"
fi

echo -e "${GREEN}[1/6] Updating package lists...${NC}"
sudo apt-get update -qq

echo -e "${GREEN}[2/6] Installing Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

echo -e "${GREEN}[3/6] Installing FFmpeg...${NC}"
if ! command -v ffmpeg &> /dev/null; then
    sudo apt-get install -y ffmpeg
else
    echo "FFmpeg already installed: $(ffmpeg -version 2>&1 | head -n1)"
fi

echo -e "${GREEN}[4/6] Installing Python3 and pip...${NC}"
sudo apt-get install -y python3 python3-pip

echo -e "${GREEN}[5/6] Installing yt-dlp...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    pip3 install --user yt-dlp
    # Add to PATH if not already
    export PATH="$HOME/.local/bin:$PATH"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
else
    echo "yt-dlp already installed: $(yt-dlp --version)"
    echo "Updating yt-dlp to latest version..."
    pip3 install --user --upgrade yt-dlp
fi

echo -e "${GREEN}[6/6] Installing Deno (optional, for better YouTube support)...${NC}"
if ! command -v deno &> /dev/null; then
    curl -fsSL https://deno.land/install.sh | sh
    # Add to PATH
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
    echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
    echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
else
    echo "Deno already installed: $(deno --version | head -n1)"
fi

echo ""
echo "=================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Install npm dependencies:  npm install"
echo "2. Build the application:     npm run build"
echo "3. Start the server:          npm start"
echo ""
echo "Optional: Add cookies.txt file for YouTube authentication"
echo "Place it in the project root directory."
echo ""
echo -e "${YELLOW}Note: You may need to restart your terminal or run:${NC}"
echo "source ~/.bashrc"
echo ""

# Verify installations
echo "Verifying installations..."
echo ""

if command -v node &> /dev/null; then
    echo -e "✓ Node.js: ${GREEN}$(node --version)${NC}"
else
    echo -e "✗ Node.js: ${RED}Not found${NC}"
fi

if command -v npm &> /dev/null; then
    echo -e "✓ npm: ${GREEN}$(npm --version)${NC}"
else
    echo -e "✗ npm: ${RED}Not found${NC}"
fi

if command -v ffmpeg &> /dev/null; then
    echo -e "✓ FFmpeg: ${GREEN}Installed${NC}"
else
    echo -e "✗ FFmpeg: ${RED}Not found${NC}"
fi

# Check yt-dlp with updated PATH
export PATH="$HOME/.local/bin:$PATH"
if command -v yt-dlp &> /dev/null; then
    echo -e "✓ yt-dlp: ${GREEN}$(yt-dlp --version)${NC}"
else
    echo -e "✗ yt-dlp: ${RED}Not found${NC}"
fi

# Check deno with updated PATH
export PATH="$HOME/.deno/bin:$PATH"
if command -v deno &> /dev/null; then
    echo -e "✓ Deno: ${GREEN}Installed${NC}"
else
    echo -e "○ Deno: ${YELLOW}Not installed (optional)${NC}"
fi

echo ""
