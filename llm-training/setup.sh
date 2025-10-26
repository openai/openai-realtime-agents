#!/bin/bash
#
# Unsloth + Qwen2.5 Training Setup Script
# ========================================
#
# This script sets up the environment for training 1B parameter models
#
# Usage: bash setup.sh
#

set -e  # Exit on error

echo "========================================================================"
echo "UNSLOTH + QWEN2.5 TRAINING SETUP"
echo "========================================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo -e "\n${YELLOW}[1/6] Checking Python version...${NC}"
PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 9 ] && [ "$PYTHON_MINOR" -lt 14 ]; then
    echo -e "${GREEN}✓ Python $PYTHON_VERSION (supported)${NC}"
else
    echo -e "${RED}✗ Python $PYTHON_VERSION (not supported)${NC}"
    echo "Please use Python 3.9 to 3.13"
    exit 1
fi

# Check CUDA
echo -e "\n${YELLOW}[2/6] Checking CUDA...${NC}"
if command -v nvidia-smi &> /dev/null; then
    CUDA_VERSION=$(nvcc --version 2>/dev/null | grep "release" | awk '{print $5}' | cut -d',' -f1)
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
    GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -n 1)

    echo -e "${GREEN}✓ GPU: $GPU_NAME${NC}"
    echo -e "${GREEN}✓ VRAM: $GPU_MEMORY${NC}"

    if [ -n "$CUDA_VERSION" ]; then
        echo -e "${GREEN}✓ CUDA: $CUDA_VERSION${NC}"
    else
        echo -e "${YELLOW}⚠ CUDA toolkit not found (nvcc)${NC}"
        echo "  You may need to install it for compilation"
    fi
else
    echo -e "${RED}✗ No NVIDIA GPU detected${NC}"
    echo "This setup requires a CUDA-capable GPU"
    exit 1
fi

# Check PyTorch
echo -e "\n${YELLOW}[3/6] Checking PyTorch...${NC}"
if python -c "import torch; print(torch.__version__)" &> /dev/null; then
    TORCH_VERSION=$(python -c "import torch; print(torch.__version__)")
    TORCH_CUDA=$(python -c "import torch; print(torch.version.cuda)")
    echo -e "${GREEN}✓ PyTorch $TORCH_VERSION (CUDA $TORCH_CUDA)${NC}"

    # Test CUDA
    if python -c "import torch; assert torch.cuda.is_available()" &> /dev/null; then
        echo -e "${GREEN}✓ PyTorch can access GPU${NC}"
    else
        echo -e "${RED}✗ PyTorch cannot access GPU${NC}"
        echo "Reinstalling PyTorch..."

        # Detect CUDA version and install appropriate PyTorch
        if [[ "$CUDA_VERSION" == 12.* ]]; then
            echo "Installing PyTorch for CUDA 12.1..."
            pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
        elif [[ "$CUDA_VERSION" == 11.8* ]]; then
            echo "Installing PyTorch for CUDA 11.8..."
            pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
        else
            echo -e "${YELLOW}⚠ Unknown CUDA version, installing default PyTorch${NC}"
            pip install torch torchvision torchaudio
        fi
    fi
else
    echo -e "${YELLOW}⚠ PyTorch not found, installing...${NC}"

    # Install PyTorch based on CUDA version
    if [[ "$CUDA_VERSION" == 12.* ]]; then
        echo "Installing PyTorch for CUDA 12.1..."
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
    elif [[ "$CUDA_VERSION" == 11.8* ]]; then
        echo "Installing PyTorch for CUDA 11.8..."
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    else
        echo "Installing default PyTorch..."
        pip install torch torchvision torchaudio
    fi
fi

# Install Unsloth
echo -e "\n${YELLOW}[4/6] Installing Unsloth...${NC}"
if python -c "from unsloth import FastLanguageModel" &> /dev/null; then
    UNSLOTH_VERSION=$(python -c "from unsloth.models._utils import __version__; print(__version__)" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Unsloth $UNSLOTH_VERSION already installed${NC}"
    read -p "Reinstall/update? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pip install --upgrade --force-reinstall --no-cache-dir unsloth unsloth_zoo
    fi
else
    echo "Installing Unsloth..."
    pip install unsloth
fi

# Install additional dependencies
echo -e "\n${YELLOW}[5/6] Installing additional dependencies...${NC}"
pip install datasets trl transformers accelerate peft -q

# Verify installation
echo -e "\n${YELLOW}[6/6] Verifying installation...${NC}"

# Test Unsloth
if python -c "from unsloth import FastLanguageModel; print('OK')" &> /dev/null; then
    echo -e "${GREEN}✓ Unsloth${NC}"
else
    echo -e "${RED}✗ Unsloth${NC}"
    exit 1
fi

# Test datasets
if python -c "import datasets; print('OK')" &> /dev/null; then
    echo -e "${GREEN}✓ Datasets${NC}"
else
    echo -e "${RED}✗ Datasets${NC}"
    exit 1
fi

# Test TRL
if python -c "from trl import SFTTrainer; print('OK')" &> /dev/null; then
    echo -e "${GREEN}✓ TRL${NC}"
else
    echo -e "${RED}✗ TRL${NC}"
    exit 1
fi

echo ""
echo "========================================================================"
echo -e "${GREEN}✓ SETUP COMPLETE!${NC}"
echo "========================================================================"
echo ""
echo "Next steps:"
echo "  1. Quick test:  python quickstart.py"
echo "  2. Full train:  python train_qwen_1b.py"
echo "  3. Read docs:   cat README.md"
echo ""
echo "System summary:"
echo "  GPU:     $GPU_NAME"
echo "  VRAM:    $GPU_MEMORY"
echo "  Python:  $PYTHON_VERSION"
echo "  PyTorch: $TORCH_VERSION"
echo "  CUDA:    $CUDA_VERSION"
echo ""
echo "Happy training! 🦥"
echo ""
