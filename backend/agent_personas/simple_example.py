# Adapted from src/app/agentConfigs/simpleExample.ts

# Define agents
haiku_writer = {
  "name": "haikuWriter",
  "publicDescription": "Agent that writes haikus.", # Context for the agent_transfer tool
  "instructions": "Ask the user for a topic, then reply with a haiku about that topic.",
  "tools": [],
}

greeter = {
  "name": "greeter",
  "publicDescription": "Agent that greets the user.",
  "instructions": "Please greet the user and ask them if they'd like a Haiku. If yes, transfer them to the 'haiku' agent.",
  "tools": [],
  "downstreamAgents": [haiku_writer["name"]], # Storing names for simplicity
}

# In the original TS, injectTransferTools would modify agents.
# For simplicity, we'll just define the agents here.
# If transfer tools are needed later, that logic can be added.
agents = {
    "greeter": greeter,
    "haikuWriter": haiku_writer,
}

default_agent_name = "greeter"

def get_agent_config(agent_name: str):
    return agents.get(agent_name)

def get_default_agent_config():
    return get_agent_config(default_agent_name)

if __name__ == '__main__':
    # Example usage
    print(get_default_agent_config())
    print(get_agent_config("haikuWriter"))
