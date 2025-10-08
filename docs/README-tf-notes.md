TensorFlow/Gym logs and how to avoid them

Why you see them
- The optional openai-agents SDK can pull transitive ML packages (e.g., TensorFlow, Gym) depending on your environment. When imported, those packages print startup messages like oneDNN and Gym deprecation notes.
- Our server used to import the Agents SDK at module import time, so you saw those logs even if you never used the SDK path.

What changed
- We now lazy-load the Agents SDK only when explicitly enabled and needed. By default, the environment variable DISABLE_AGENTS_SDK=1 prevents importing it. The app uses the standard OpenAI Responses API path instead, so the chat works without the SDK and without TensorFlow/Gym logs.

How to keep the SDK disabled (default)
- Ensure the env variable is set (default is 1):
  - Windows PowerShell
    $env:DISABLE_AGENTS_SDK="1"

How to enable the SDK (optional)
- If you want SDK features (function_tool wrapping, SQLiteSession, etc.), clear or set the flag to 0 and restart the server:
  - Windows PowerShell
    $env:DISABLE_AGENTS_SDK="0"

No functional loss (outdated - now cmplete split between agent sdk and Responses API implemented)
- Even with the SDK disabled, the app routes agent replies through the /responses API and you still get assistant messages, tokenized streaming (simulated), tool events, usage, and orchestration. 
