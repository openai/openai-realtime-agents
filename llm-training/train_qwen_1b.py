#!/usr/bin/env python3
"""
Qwen2.5-0.5B/1B Training Script using Unsloth
==============================================

This script fine-tunes Qwen2.5 1B parameter models using Unsloth for:
- 2x faster training
- 70% less VRAM usage
- Support for QLoRA, LoRA, and full fine-tuning

Requirements:
- GPU with at least 6GB VRAM (8GB+ recommended)
- Python 3.9+
- CUDA toolkit

Model options:
- unsloth/Qwen2.5-0.5B-bnb-4bit (smallest, 0.5B params)
- unsloth/Qwen2.5-1.5B-bnb-4bit (1.5B params)
- Qwen/Qwen2.5-0.5B-Instruct (base 0.5B)
- Qwen/Qwen2.5-1.5B-Instruct (base 1.5B)
"""

from unsloth import FastLanguageModel
import torch
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig

# ============================================================================
# Configuration
# ============================================================================

# Model Configuration
MODEL_NAME = "unsloth/Qwen2.5-0.5B-bnb-4bit"  # Change to Qwen2.5-1.5B for larger model
MAX_SEQ_LENGTH = 2048  # Context window (Qwen supports up to 32K)
LOAD_IN_4BIT = True    # Use 4-bit quantization (recommended for efficiency)
LOAD_IN_8BIT = False   # Alternative: 8-bit quantization
FULL_FINETUNING = False  # Set True for full parameter fine-tuning (requires more VRAM)

# LoRA Configuration (for efficient fine-tuning)
LORA_R = 16               # LoRA rank (8, 16, 32, 64)
LORA_ALPHA = 16           # LoRA alpha (typically same as rank)
LORA_DROPOUT = 0          # LoRA dropout (0 is optimized for Unsloth)
TARGET_MODULES = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]

# Training Configuration
OUTPUT_DIR = "./outputs/qwen-finetuned"
LOGGING_STEPS = 1
SAVE_STEPS = 100
MAX_STEPS = 500          # Total training steps (-1 for full dataset)
PER_DEVICE_BATCH_SIZE = 2
GRADIENT_ACCUMULATION_STEPS = 4  # Effective batch size = 2 * 4 = 8
LEARNING_RATE = 2e-4
WARMUP_STEPS = 10
WEIGHT_DECAY = 0.01
LR_SCHEDULER_TYPE = "linear"
OPTIM = "adamw_8bit"     # 8-bit Adam optimizer for efficiency

# Dataset Configuration
DATASET_NAME = "yahma/alpaca-cleaned"  # Change to your dataset
DATASET_TEXT_FIELD = "text"  # Field containing training text

# ============================================================================
# Load Model and Tokenizer
# ============================================================================

print(f"Loading model: {MODEL_NAME}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,  # Auto-detect (Float16 for Tesla T4, V100, Bfloat16 for Ampere+)
    load_in_4bit=LOAD_IN_4BIT,
    load_in_8bit=LOAD_IN_8BIT,
    # token="hf_...",  # Uncomment if using gated models
)

# ============================================================================
# Apply LoRA/PEFT
# ============================================================================

if not FULL_FINETUNING:
    print("Applying LoRA for efficient fine-tuning...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_R,
        target_modules=TARGET_MODULES,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        bias="none",  # "none" is optimized
        use_gradient_checkpointing="unsloth",  # Use Unsloth's optimized checkpointing
        random_state=3407,
        max_seq_length=MAX_SEQ_LENGTH,
        use_rslora=False,  # Rank stabilized LoRA
        loftq_config=None,  # LoftQ quantization
    )

# ============================================================================
# Prepare Dataset
# ============================================================================

print(f"Loading dataset: {DATASET_NAME}")

# Load dataset
dataset = load_dataset(DATASET_NAME, split="train")

# Format dataset for Alpaca-style prompts
alpaca_prompt = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{}

### Input:
{}

### Response:
{}"""

def formatting_prompts_func(examples):
    """Format examples into Alpaca prompt template"""
    instructions = examples.get("instruction", [""] * len(examples["instruction"]))
    inputs = examples.get("input", [""] * len(examples["instruction"]))
    outputs = examples.get("output", [""] * len(examples["instruction"]))

    texts = []
    for instruction, input_text, output in zip(instructions, inputs, outputs):
        text = alpaca_prompt.format(instruction, input_text, output) + tokenizer.eos_token
        texts.append(text)
    return {"text": texts}

# Apply formatting
dataset = dataset.map(formatting_prompts_func, batched=True)

# ============================================================================
# Training
# ============================================================================

print("Starting training...")

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    tokenizer=tokenizer,
    args=SFTConfig(
        # Training parameters
        per_device_train_batch_size=PER_DEVICE_BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
        warmup_steps=WARMUP_STEPS,
        max_steps=MAX_STEPS,
        learning_rate=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
        lr_scheduler_type=LR_SCHEDULER_TYPE,

        # Logging and saving
        logging_steps=LOGGING_STEPS,
        save_steps=SAVE_STEPS,
        output_dir=OUTPUT_DIR,

        # Optimization
        optim=OPTIM,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        seed=3407,

        # Dataset configuration
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_text_field=DATASET_TEXT_FIELD,
        packing=False,  # Can pack short sequences for efficiency

        # Report to (optional)
        # report_to=["tensorboard"],  # or "wandb"
    ),
)

# Train the model
trainer.train()

# ============================================================================
# Save Model
# ============================================================================

print("Saving model...")

# Save LoRA adapter
model.save_pretrained(f"{OUTPUT_DIR}/lora_model")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/lora_model")

# Save merged model (LoRA + base model)
model.save_pretrained_merged(
    f"{OUTPUT_DIR}/merged_model",
    tokenizer,
    save_method="merged_16bit",  # or "merged_4bit", "lora"
)

print(f"Model saved to {OUTPUT_DIR}")

# ============================================================================
# Inference Example
# ============================================================================

print("\nTesting inference...")

# Enable inference mode
FastLanguageModel.for_inference(model)

# Test prompt
test_prompt = alpaca_prompt.format(
    "Write a Python function to calculate factorial",  # instruction
    "",  # input
    "",  # output (to be generated)
)

inputs = tokenizer([test_prompt], return_tensors="pt").to("cuda")

# Generate
outputs = model.generate(
    **inputs,
    max_new_tokens=256,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)

result = tokenizer.decode(outputs[0], skip_special_tokens=True)
print("\n" + "="*80)
print("GENERATED OUTPUT:")
print("="*80)
print(result)
print("="*80)

print("\nTraining complete!")
print(f"\nTo use your model:")
print(f"1. LoRA adapter: {OUTPUT_DIR}/lora_model")
print(f"2. Merged model: {OUTPUT_DIR}/merged_model")
