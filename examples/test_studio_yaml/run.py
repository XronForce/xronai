import os
import sys
import asyncio
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.xronai.config import load_yaml_config, AgentFactory

# Load environment variables
load_dotenv()


async def main():
    """Main asynchronous function to load and run the workflow."""
    # Load and process the YAML configuration
    config = load_yaml_config('examples/test_studio_yaml/workflow.yaml')

    # Create the agent structure from YAML
    print("Loading workflow from YAML...")
    task_manager = await AgentFactory.create_from_config(config)
    print("Workflow loaded successfully.")

    task_manager.display_agent_graph()
    print("\nStarting interactive session...")
    print("Type 'exit' to quit.")

    while True:
        try:
            # Use asyncio.to_thread to run blocking input() in a separate thread
            user_input = await asyncio.to_thread(input, "\nYou: ")

            if user_input.lower() == 'exit':
                print("Exiting session.")
                break

            # Also run the potentially blocking chat method in a thread
            response = await asyncio.to_thread(task_manager.chat, user_input)
            print(f"Supervisor: {response}")

        except (KeyboardInterrupt, EOFError):
            print("\nExiting session.")
            break
        except Exception as e:
            print(f"\nAn error occurred: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
