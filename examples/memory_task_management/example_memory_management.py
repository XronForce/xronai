import os, sys
import asyncio
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.xronai.config import load_yaml_config, AgentFactory

# Load environment variables
load_dotenv()

# Load and process the YAML configuration
config = load_yaml_config('examples/memory_task_management/config.yaml')


async def main():
    # Create the agent structure from YAML
    context_manager = await AgentFactory.create_from_config(config)

    async def chat_with_agents(query: str):
        response = await asyncio.to_thread(context_manager.chat, query)
        print(f"Context Manager: {response}")

    print("Welcome to the Context-Aware Task Management System!")
    print("\nThis example demonstrates the difference between stateful and stateless agents:")
    print("- StatefulTaskManager: Remembers context from previous interactions")
    print("- StatelessContextViewer: Treats each interaction independently")
    print("\nAvailable agents:")
    context_manager.display_agent_graph()
    print("\nTry these example interactions:")
    print("1. 'Add a task about documentation to the dev context'")
    print("2. 'What tasks are in that context?'")
    print("3. 'Show me all contexts'")
    print("\nType 'exit' to quit.")

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
