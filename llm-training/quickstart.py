#!/usr/bin/env python3
"""
Quickstart: Train Qwen2.5 in 5 Minutes
=======================================

Minimal example to get started with Unsloth training.

Run: python quickstart.py
"""

from unsloth import FastLanguageModel
import torch

print("="*80)
print("QWEN 2.5 QUICKSTART TRAINING")
print("="*80)

# Step 1: Check GPU
print("\n[1/6] Checking GPU...")
if not torch.cuda.is_available():
    print("ERROR: No GPU detected. This script requires a CUDA-capable GPU.")
    exit(1)
print(f"✓ GPU: {torch.cuda.get_device_name(0)}")
print(f"✓ VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

# Step 2: Load Model
print("\n[2/6] Loading model (this may take a few minutes)...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-0.5B-bnb-4bit",  # Smallest model
    max_seq_length=512,  # Short for fast training
    dtype=None,
    load_in_4bit=True,
)
print("✓ Model loaded")

# Step 3: Apply LoRA
print("\n[3/6] Applying LoRA...")
model = FastLanguageModel.get_peft_model(
    model,
    r=8,  # Small rank for speed
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_alpha=8,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)
print("✓ LoRA applied")

# Step 4: Prepare Tiny Dataset
print("\n[4/6] Preparing dataset...")
from datasets import Dataset

# Create a tiny demo dataset
data = {
    "text": [
        "Explain AI in simple terms.\nAI is artificial intelligence, the simulation of human intelligence by machines.</s>",
        "What is Python?\nPython is a high-level programming language known for its simplicity.</s>",
        "How does machine learning work?\nMachine learning uses data to train models that can make predictions.</s>",
    ]
}
dataset = Dataset.from_dict(data)
print(f"✓ Created dataset with {len(dataset)} examples")

# Step 5: Train
print("\n[5/6] Training (this will be quick with only 10 steps)...")
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    tokenizer=tokenizer,
    args=SFTConfig(
        per_device_train_batch_size=1,
        gradient_accumulation_steps=1,
        warmup_steps=2,
        max_steps=10,  # Very short for demo
        learning_rate=2e-4,
        logging_steps=1,
        output_dir="./outputs/quickstart",
        optim="adamw_8bit",
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        max_seq_length=512,
        dataset_text_field="text",
    ),
)

trainer.train()
print("✓ Training complete")

# Step 6: Test
print("\n[6/6] Testing inference...")
FastLanguageModel.for_inference(model)

prompt = "What is machine learning?"
inputs = tokenizer([prompt], return_tensors="pt").to("cuda")
outputs = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    do_sample=True,
)

result = tokenizer.decode(outputs[0], skip_special_tokens=True)

print("\n" + "="*80)
print("TEST OUTPUT:")
print("="*80)
print(f"Prompt: {prompt}")
print(f"Response: {result[len(prompt):]}")
print("="*80)

print("\n✓ SUCCESS! Your model is trained and working.")
print("\nNext steps:")
print("1. Run full training: python train_qwen_1b.py")
print("2. Customize config: edit config.py")
print("3. Read docs: cat README.md")
