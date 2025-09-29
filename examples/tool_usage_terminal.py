import os
import sys
from pprint import pprint

# Add the project root to the Python path to allow importing from 'src'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import our new tool
from src.xronai.tools.terminal import TerminalTool


def main():
    """
    A simple script to test the functionality of the TerminalTool.
    """
    print("--- Initializing a new TerminalTool instance ---")
    terminal = TerminalTool()
    print("Instance created successfully.")

    # --- Test 1: Basic command execution ---
    print("\n--- Test 1: Executing a simple 'echo' command ---")
    result = terminal.execute("echo 'Hello from the persistent terminal!'")
    print("Result:")
    pprint(result)
    assert "Hello from the persistent terminal!" in result['stdout']

    # --- Test 2: Statefulness (the most important test) ---
    print("\n--- Test 2: Testing statefulness with 'cd' and 'pwd' ---")
    print("Executing: cd /tmp")
    result_cd = terminal.execute("cd /tmp")
    print("Result of 'cd':")
    pprint(result_cd)

    print("\nExecuting 'pwd' to verify the directory change...")
    result_pwd = terminal.execute("pwd")
    print("Result of 'pwd':")
    pprint(result_pwd)
    assert "/tmp" in result_pwd['stdout']
    print("\n✅ Statefulness confirmed! The terminal remembers the 'cd' command.")

    # --- Test 3: Capturing stderr ---
    print("\n--- Test 3: Testing stderr capture with an invalid command ---")
    result_error = terminal.execute("ls non_existent_directory_xyz")
    print("Result:")
    pprint(result_error)
    assert "No such file or directory" in result_error['stderr']
    print("\n✅ Stderr was captured successfully.")

    # --- Test 4: Tool Configuration ---
    print("\n--- Test 4: Testing instance configuration with 'working_directory' ---")
    home_directory = os.path.expanduser("~")
    print(f"Creating a new instance starting in: {home_directory}")

    # Create a new, separate terminal instance
    home_terminal = TerminalTool(working_directory=home_directory)

    print("Executing 'pwd' in the new instance...")
    result_home_pwd = home_terminal.execute("pwd")
    print("Result:")
    pprint(result_home_pwd)
    assert home_directory in result_home_pwd['stdout']
    print(f"\n✅ Configuration confirmed! New instance correctly started in {home_directory}.")

    print("\n--- Testing complete ---")
    # The __del__ method in TerminalTool will handle terminating the shell processes
    # when the script finishes and the objects are garbage collected.


if __name__ == "__main__":
    main()
