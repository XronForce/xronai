import os, sys
import asyncio
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.xronai.config import load_yaml_config, AgentFactory

# Load environment variables
load_dotenv()

# Load and process the YAML configuration
config = load_yaml_config('examples/task_management_with_yaml/config.yaml')


async def main():
    # Create the agent structure from YAML
    task_manager = await AgentFactory.create_from_config(config)

    # Function to handle user input and agent responses
    async def chat_with_agents(query: str):
        response = await asyncio.to_thread(task_manager.chat, query)
        print(f"Task Manager: {response}")

    # Main interaction loop
    print("Welcome to the Task Management System!")
    print("You can interact with the following agents:")
    task_manager.display_agent_graph()
    print("Type 'exit' to quit.")

    while True:
        user_input = await asyncio.to_thread(input, "\nYou: ")
        if user_input.lower() == 'exit':
            break
        await chat_with_agents(user_input)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSession ended.")
