# Trainable LLM AI - Qwen2.5 1B Model Training

Complete setup for training 1 billion parameter models using **Unsloth** - the fastest and most memory-efficient LLM training framework.

## Features

- **2x faster** training than Hugging Face
- **70% less VRAM** usage
- **Single GPU** training (6-8GB VRAM minimum)
- **QLoRA, LoRA, and full fine-tuning** support
- **Multi-capability**: Code, math, reasoning, multilingual

## Quick Start

### 1. System Requirements

**Minimum:**
- GPU: 6GB VRAM (e.g., RTX 2060, GTX 1660 Ti)
- Python: 3.9 - 3.13
- CUDA: 11.8 or 12.1+

**Recommended:**
- GPU: 12GB+ VRAM (e.g., RTX 3060, RTX 4060 Ti)
- Python: 3.11
- CUDA: 12.1

**Check your system:**
```bash
python --version
nvidia-smi
nvcc --version  # Check CUDA version
```

### 2. Installation

#### Step 1: Install PyTorch (if not installed)

```bash
# For CUDA 12.1 (recommended)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# For CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

#### Step 2: Install Unsloth

```bash
pip install unsloth
```

**Or install from requirements file:**
```bash
cd llm-training
pip install -r requirements.txt
```

#### Step 3: Verify Installation

```bash
python -c "from unsloth import FastLanguageModel; print('Unsloth installed successfully!')"
```

### 3. Train Your First Model

```bash
cd llm-training
python train_qwen_1b.py
```

**Training will:**
1. Download Qwen2.5-0.5B model (smallest 1B-class model)
2. Apply QLoRA for efficient training
3. Fine-tune on Alpaca dataset
4. Save LoRA adapter and merged model
5. Run inference test

**Expected VRAM usage:**
- Qwen2.5-0.5B: ~4-6GB
- Qwen2.5-1.5B: ~6-8GB

## Configuration

Edit `train_qwen_1b.py` to customize:

### Model Selection

```python
# Smallest (0.5B parameters) - Fastest training
MODEL_NAME = "unsloth/Qwen2.5-0.5B-bnb-4bit"

# Medium (1.5B parameters) - Better quality
MODEL_NAME = "unsloth/Qwen2.5-1.5B-bnb-4bit"

# Or use base models (non-quantized)
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"
MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"
```

### Training Mode

```python
# QLoRA (recommended - most efficient)
LOAD_IN_4BIT = True
FULL_FINETUNING = False

# 8-bit training (alternative)
LOAD_IN_8BIT = True
LOAD_IN_4BIT = False
FULL_FINETUNING = False

# Full fine-tuning (requires 16GB+ VRAM)
LOAD_IN_4BIT = False
FULL_FINETUNING = True
```

### LoRA Parameters

```python
LORA_R = 16              # Rank: 8, 16, 32, 64 (higher = more capacity, more VRAM)
LORA_ALPHA = 16          # Alpha: typically same as rank
TARGET_MODULES = [       # Which layers to train
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]
```

### Dataset Options

#### Use Built-in Datasets

```python
# Alpaca (general instruction following)
DATASET_NAME = "yahma/alpaca-cleaned"

# Code training
DATASET_NAME = "iamtarun/python_code_instructions_18k_alpaca"

# Chat/conversation
DATASET_NAME = "OpenAssistant/oasst1"

# Medical
DATASET_NAME = "medalpaca/medical_meadow_medical_flashcards"
```

#### Use Custom Dataset

```python
from datasets import load_dataset

# From local JSON/CSV
dataset = load_dataset("json", data_files="your_data.json")
dataset = load_dataset("csv", data_files="your_data.csv")

# From Hugging Face Hub
dataset = load_dataset("your-username/your-dataset")
```

**Your dataset should have this format:**
```json
[
  {
    "instruction": "Write a function to...",
    "input": "",
    "output": "def function():\n    ..."
  }
]
```

## Advanced Usage

### 1. Multi-GPU Training

```python
# In train_qwen_1b.py, add to SFTConfig:
args = SFTConfig(
    # ... other args ...
    ddp_find_unused_parameters=False,  # For multi-GPU
)
```

```bash
# Run with torchrun
torchrun --nproc_per_node=2 train_qwen_1b.py
```

### 2. Save to GGUF (for llama.cpp)

```python
# Add after training
model.save_pretrained_gguf(
    "outputs/qwen-gguf",
    tokenizer,
    quantization_method="q4_k_m",  # or "q8_0", "q5_k_m"
)
```

### 3. Export to GPTQ (for vLLM)

```python
model.save_pretrained_merged(
    "outputs/qwen-gptq",
    tokenizer,
    save_method="gptq",
    quantization_method="gptq_4bit",
)
```

### 4. Inference Only

```python
from unsloth import FastLanguageModel

# Load your trained model
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="./outputs/qwen-finetuned/merged_model",
    max_seq_length=2048,
    dtype=None,
    load_in_4bit=True,
)

# Enable inference mode
FastLanguageModel.for_inference(model)

# Generate
inputs = tokenizer("Your prompt here", return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_new_tokens=256)
print(tokenizer.decode(outputs[0]))
```

### 5. Continue Training from Checkpoint

```python
# In train_qwen_1b.py, add to SFTConfig:
args = SFTConfig(
    # ... other args ...
    resume_from_checkpoint="./outputs/qwen-finetuned/checkpoint-500",
)
```

### 6. Experiment Tracking

**Weights & Biases:**
```bash
pip install wandb
wandb login
```

```python
# In train_qwen_1b.py, add to SFTConfig:
args = SFTConfig(
    # ... other args ...
    report_to=["wandb"],
)
```

**TensorBoard:**
```bash
pip install tensorboard
tensorboard --logdir=./outputs/qwen-finetuned
```

```python
args = SFTConfig(
    # ... other args ...
    report_to=["tensorboard"],
)
```

## Model Comparison

| Model | Params | VRAM (4-bit) | Speed | Quality | Best For |
|-------|--------|--------------|-------|---------|----------|
| Qwen2.5-0.5B | 0.5B | 4-6GB | Fastest | Good | Testing, simple tasks |
| Qwen2.5-1.5B | 1.5B | 6-8GB | Fast | Better | General use, code |
| Qwen2.5-3B | 3B | 10-12GB | Medium | Great | Complex reasoning |
| Qwen2.5-7B | 7B | 16-20GB | Slower | Excellent | Production |

## Troubleshooting

### Out of Memory (OOM)

1. **Reduce batch size:**
   ```python
   PER_DEVICE_BATCH_SIZE = 1
   GRADIENT_ACCUMULATION_STEPS = 8
   ```

2. **Reduce sequence length:**
   ```python
   MAX_SEQ_LENGTH = 1024  # or 512
   ```

3. **Use smaller LoRA rank:**
   ```python
   LORA_R = 8
   ```

4. **Enable gradient checkpointing:**
   ```python
   use_gradient_checkpointing = "unsloth"  # Already enabled
   ```

### Slow Training

1. **Check GPU utilization:**
   ```bash
   watch -n 1 nvidia-smi
   ```

2. **Enable packing (for short sequences):**
   ```python
   packing = True  # In SFTConfig
   ```

3. **Increase batch size:**
   ```python
   PER_DEVICE_BATCH_SIZE = 4  # If you have VRAM
   ```

### Installation Issues

**Windows users:**
- Install Visual Studio C++
- Install CUDA Toolkit
- Use `pip install unsloth` (requires PyTorch pre-installed)

**Linux/Mac:**
- Use `pip install unsloth` directly

**CUDA version mismatch:**
```bash
# Check your CUDA version
nvcc --version

# Install matching PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

## Resources

- **Unsloth Docs**: https://docs.unsloth.ai
- **Unsloth GitHub**: https://github.com/unslothai/unsloth
- **Qwen Models**: https://huggingface.co/Qwen
- **Example Notebooks**: https://github.com/unslothai/notebooks
- **Discord Support**: https://discord.com/invite/unsloth

## Performance Benchmarks

**Training Speed (vs Hugging Face + Flash Attention):**
- Qwen2.5-1.5B: **2x faster**, 70% less VRAM
- Context length: **12x longer** on same GPU

**Single GPU Training Capacity:**

| GPU | VRAM | Max Model | Max Context |
|-----|------|-----------|-------------|
| RTX 2060 | 6GB | 1.5B (4-bit) | 4K |
| RTX 3060 | 12GB | 3B (4-bit) | 16K |
| RTX 4090 | 24GB | 7B (4-bit) | 64K |
| A100 | 80GB | 70B (4-bit) | 128K |

## Example: Train a Code Assistant

```python
# In train_qwen_1b.py, modify:

# Use code dataset
DATASET_NAME = "iamtarun/python_code_instructions_18k_alpaca"

# Adjust for code generation
MAX_SEQ_LENGTH = 4096  # Longer for code
MAX_STEPS = 1000       # More steps

# Run training
# python train_qwen_1b.py
```

## License

This training setup uses:
- **Unsloth**: Apache 2.0 License
- **Qwen2.5 Models**: Apache 2.0 License (check specific model cards)

## Citation

If you use this in your research:

```bibtex
@software{unsloth,
  author = {Daniel Han, Michael Han and Unsloth team},
  title = {Unsloth},
  url = {http://github.com/unslothai/unsloth},
  year = {2023}
}
```

## Contributing

Found a bug or want to improve the training script? Open an issue or PR!

---

**Happy Training! 🦥**
