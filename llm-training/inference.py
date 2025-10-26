#!/usr/bin/env python3
"""
Inference with Trained Qwen Models
===================================

Load and run inference with your fine-tuned models.

Usage:
  python inference.py --model ./outputs/qwen-finetuned/merged_model
  python inference.py --model unsloth/Qwen2.5-0.5B-bnb-4bit --interactive
"""

import argparse
import torch
from unsloth import FastLanguageModel


def load_model(model_path, max_seq_length=2048, load_in_4bit=True):
    """Load model for inference"""
    print(f"Loading model from: {model_path}")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_path,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=load_in_4bit,
    )

    # Enable fast inference
    FastLanguageModel.for_inference(model)

    print(f"✓ Model loaded successfully")
    return model, tokenizer


def generate_response(
    model,
    tokenizer,
    prompt,
    max_new_tokens=256,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
):
    """Generate response for a prompt"""
    inputs = tokenizer([prompt], return_tensors="pt").to("cuda")

    outputs = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_p=top_p,
        do_sample=do_sample,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return response


def interactive_mode(model, tokenizer):
    """Interactive chat with the model"""
    print("\n" + "="*80)
    print("INTERACTIVE MODE")
    print("="*80)
    print("Type your prompts below. Commands:")
    print("  /exit - Exit interactive mode")
    print("  /clear - Clear conversation")
    print("  /params - Change generation parameters")
    print("="*80 + "\n")

    # Generation parameters
    params = {
        "max_new_tokens": 256,
        "temperature": 0.7,
        "top_p": 0.9,
    }

    conversation_history = []

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            # Commands
            if user_input == "/exit":
                print("Goodbye!")
                break

            elif user_input == "/clear":
                conversation_history = []
                print("Conversation cleared.")
                continue

            elif user_input == "/params":
                print(f"\nCurrent parameters:")
                print(f"  max_new_tokens: {params['max_new_tokens']}")
                print(f"  temperature: {params['temperature']}")
                print(f"  top_p: {params['top_p']}")

                try:
                    params['max_new_tokens'] = int(input("max_new_tokens (64-512): ") or params['max_new_tokens'])
                    params['temperature'] = float(input("temperature (0.1-2.0): ") or params['temperature'])
                    params['top_p'] = float(input("top_p (0.1-1.0): ") or params['top_p'])
                    print("✓ Parameters updated")
                except:
                    print("Invalid input, keeping current parameters")
                continue

            # Generate response
            conversation_history.append(f"User: {user_input}")
            prompt = "\n".join(conversation_history) + "\nAssistant:"

            response = generate_response(
                model, tokenizer, prompt,
                max_new_tokens=params['max_new_tokens'],
                temperature=params['temperature'],
                top_p=params['top_p'],
            )

            # Extract assistant's response
            assistant_response = response[len(prompt):].strip()
            conversation_history.append(f"Assistant: {assistant_response}")

            print(f"Assistant: {assistant_response}\n")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break


def batch_mode(model, tokenizer, prompts_file):
    """Process multiple prompts from a file"""
    print(f"Processing prompts from: {prompts_file}")

    with open(prompts_file, 'r') as f:
        prompts = [line.strip() for line in f if line.strip()]

    results = []
    for i, prompt in enumerate(prompts, 1):
        print(f"\n[{i}/{len(prompts)}] Processing: {prompt[:50]}...")
        response = generate_response(model, tokenizer, prompt)
        results.append({"prompt": prompt, "response": response})

    # Save results
    output_file = prompts_file.replace(".txt", "_responses.txt")
    with open(output_file, 'w') as f:
        for result in results:
            f.write(f"PROMPT: {result['prompt']}\n")
            f.write(f"RESPONSE: {result['response']}\n")
            f.write("-" * 80 + "\n")

    print(f"\n✓ Results saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Inference with Qwen models")
    parser.add_argument(
        "--model",
        type=str,
        default="./outputs/qwen-finetuned/merged_model",
        help="Path to model or Hugging Face model name"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        help="Single prompt to generate response for"
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Launch interactive chat mode"
    )
    parser.add_argument(
        "--batch",
        type=str,
        help="Path to file with prompts (one per line)"
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=256,
        help="Maximum tokens to generate"
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Sampling temperature"
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=0.9,
        help="Top-p sampling"
    )
    parser.add_argument(
        "--4bit",
        dest="load_in_4bit",
        action="store_true",
        default=True,
        help="Load in 4-bit mode (default)"
    )

    args = parser.parse_args()

    # Check GPU
    if not torch.cuda.is_available():
        print("WARNING: No GPU detected. Inference will be very slow.")

    # Load model
    model, tokenizer = load_model(
        args.model,
        load_in_4bit=args.load_in_4bit
    )

    # Run appropriate mode
    if args.interactive:
        interactive_mode(model, tokenizer)

    elif args.batch:
        batch_mode(model, tokenizer, args.batch)

    elif args.prompt:
        print(f"\nPrompt: {args.prompt}\n")
        response = generate_response(
            model, tokenizer, args.prompt,
            max_new_tokens=args.max_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
        )
        print(f"Response:\n{response}\n")

    else:
        # Default: single example
        example_prompt = "Write a Python function to calculate Fibonacci numbers."
        print(f"\nExample prompt: {example_prompt}\n")
        response = generate_response(
            model, tokenizer, example_prompt,
            max_new_tokens=args.max_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
        )
        print(f"Response:\n{response}\n")
        print("Tip: Use --interactive for chat mode or --prompt for custom prompts")


if __name__ == "__main__":
    main()
