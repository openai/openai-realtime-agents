"""
Training Configuration Template
================================

Copy this file and modify for your use case:
  cp config.py my_config.py

Then import in your training script:
  from my_config import TrainingConfig
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class TrainingConfig:
    """Configuration for LLM fine-tuning with Unsloth"""

    # =========================================================================
    # Model Configuration
    # =========================================================================

    # Model to fine-tune
    model_name: str = "unsloth/Qwen2.5-0.5B-bnb-4bit"

    # Available Qwen models:
    # - "unsloth/Qwen2.5-0.5B-bnb-4bit"     (0.5B, 4-bit quantized)
    # - "unsloth/Qwen2.5-1.5B-bnb-4bit"     (1.5B, 4-bit quantized)
    # - "Qwen/Qwen2.5-0.5B-Instruct"        (0.5B, base)
    # - "Qwen/Qwen2.5-1.5B-Instruct"        (1.5B, base)
    # - "Qwen/Qwen2.5-3B-Instruct"          (3B, base)
    # - "Qwen/Qwen2.5-7B-Instruct"          (7B, base)

    max_seq_length: int = 2048  # Max context window (up to 32K for Qwen)
    dtype: Optional[str] = None  # Auto-detect optimal dtype
    load_in_4bit: bool = True    # 4-bit quantization (recommended)
    load_in_8bit: bool = False   # 8-bit quantization
    full_finetuning: bool = False  # Full parameter fine-tuning

    # =========================================================================
    # LoRA Configuration
    # =========================================================================

    lora_r: int = 16  # LoRA rank (8, 16, 32, 64)
    lora_alpha: int = 16  # LoRA alpha (typically = lora_r)
    lora_dropout: float = 0.0  # Dropout (0 is optimized)

    target_modules: List[str] = None  # Will be set in __post_init__

    def __post_init__(self):
        if self.target_modules is None:
            self.target_modules = [
                "q_proj", "k_proj", "v_proj", "o_proj",
                "gate_proj", "up_proj", "down_proj",
            ]

    # =========================================================================
    # Training Hyperparameters
    # =========================================================================

    # Batch size and gradient accumulation
    per_device_train_batch_size: int = 2
    gradient_accumulation_steps: int = 4
    # Effective batch size = per_device_train_batch_size * gradient_accumulation_steps
    # = 2 * 4 = 8

    # Optimization
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    warmup_steps: int = 10
    max_steps: int = 500  # -1 for full dataset
    lr_scheduler_type: str = "linear"  # or "cosine", "constant"
    optim: str = "adamw_8bit"  # or "adamw_torch", "sgd"

    # Precision
    # fp16/bf16 will be auto-detected based on GPU capability

    # =========================================================================
    # Dataset Configuration
    # =========================================================================

    dataset_name: str = "yahma/alpaca-cleaned"

    # Popular datasets:
    # - "yahma/alpaca-cleaned"                           (General instruction)
    # - "iamtarun/python_code_instructions_18k_alpaca"   (Python code)
    # - "OpenAssistant/oasst1"                           (Chat)
    # - "timdettmers/openassistant-guanaco"              (Chat)
    # - "medalpaca/medical_meadow_medical_flashcards"    (Medical)
    # - "databricks/databricks-dolly-15k"                (General)

    dataset_split: str = "train"
    dataset_text_field: str = "text"

    # =========================================================================
    # Logging and Checkpointing
    # =========================================================================

    output_dir: str = "./outputs/qwen-finetuned"
    logging_steps: int = 1
    save_steps: int = 100
    save_total_limit: int = 3  # Keep only last 3 checkpoints

    # Experiment tracking
    report_to: List[str] = None  # ["tensorboard"] or ["wandb"]

    # =========================================================================
    # Other Settings
    # =========================================================================

    seed: int = 3407
    packing: bool = False  # Pack short sequences for efficiency

    # Gradient checkpointing (memory saving)
    use_gradient_checkpointing: str = "unsloth"  # or True, False


# ============================================================================
# Preset Configurations
# ============================================================================

class FastTrainingConfig(TrainingConfig):
    """Fast training for testing/prototyping"""
    model_name: str = "unsloth/Qwen2.5-0.5B-bnb-4bit"
    max_steps: int = 100
    save_steps: int = 50
    lora_r: int = 8


class BalancedConfig(TrainingConfig):
    """Balanced speed/quality for general use"""
    model_name: str = "unsloth/Qwen2.5-1.5B-bnb-4bit"
    max_steps: int = 500
    lora_r: int = 16
    max_seq_length: int = 2048


class QualityConfig(TrainingConfig):
    """Higher quality training (slower, more VRAM)"""
    model_name: str = "unsloth/Qwen2.5-1.5B-bnb-4bit"
    max_steps: int = 1000
    lora_r: int = 32
    max_seq_length: int = 4096
    per_device_train_batch_size: int = 1
    gradient_accumulation_steps: int = 8


class CodeTrainingConfig(TrainingConfig):
    """Optimized for code generation"""
    model_name: str = "unsloth/Qwen2.5-1.5B-bnb-4bit"
    dataset_name: str = "iamtarun/python_code_instructions_18k_alpaca"
    max_seq_length: int = 4096
    max_steps: int = 1000
    lora_r: int = 32


class ChatConfig(TrainingConfig):
    """Optimized for conversational AI"""
    model_name: str = "unsloth/Qwen2.5-1.5B-bnb-4bit"
    dataset_name: str = "OpenAssistant/oasst1"
    max_seq_length: int = 2048
    max_steps: int = 1000


# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    # Default config
    config = TrainingConfig()
    print("Default Config:")
    print(f"  Model: {config.model_name}")
    print(f"  Steps: {config.max_steps}")
    print(f"  LoRA rank: {config.lora_r}")
    print()

    # Fast training config
    fast_config = FastTrainingConfig()
    print("Fast Config:")
    print(f"  Model: {fast_config.model_name}")
    print(f"  Steps: {fast_config.max_steps}")
    print(f"  LoRA rank: {fast_config.lora_r}")
    print()

    # Code training config
    code_config = CodeTrainingConfig()
    print("Code Config:")
    print(f"  Model: {code_config.model_name}")
    print(f"  Dataset: {code_config.dataset_name}")
    print(f"  Context: {code_config.max_seq_length}")
