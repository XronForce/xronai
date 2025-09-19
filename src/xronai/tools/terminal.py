import subprocess
import threading
import queue
from typing import Dict, Optional


def _enqueue_output(stream, q):

    for line in iter(stream.readline, ''):
        q.put(line)
    stream.close()


class TerminalTool:
    """
    A tool that provides access to a persistent, isolated terminal session.
    Each instance of this tool manages its own shell process.
    """

    @staticmethod
    def get_config_schema() -> dict:
        """Defines the configuration form for the Studio UI."""
        return {
            "type": "object",
            "properties": {
                "working_directory": {
                    "type":
                        "string",
                    "title":
                        "Working Directory",
                    "description":
                        "The directory where the terminal session will start. Defaults to the current directory.",
                }
            },
            "required": []
        }

    def __init__(self, working_directory: Optional[str] = None):
        """
        Initializes the tool and starts the persistent shell process.
        
        Args:
            working_directory (Optional[str]): The starting directory for the shell.
        """
        self.process = subprocess.Popen(['/bin/bash'],
                                        stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        cwd=working_directory,
                                        text=True,
                                        bufsize=1)

        self.stdout_queue = queue.Queue()
        self.stderr_queue = queue.Queue()

        self.stdout_thread = threading.Thread(target=_enqueue_output, args=(self.process.stdout, self.stdout_queue))
        self.stderr_thread = threading.Thread(target=_enqueue_output, args=(self.process.stderr, self.stderr_queue))

        self.stdout_thread.daemon = True
        self.stderr_thread.daemon = True
        self.stdout_thread.start()
        self.stderr_thread.start()

    def execute(self, command: str) -> Dict[str, str]:
        """
        Execute a command in the persistent terminal session.

        Args:
            command (str): The command to execute.

        Returns:
            A dictionary containing the standard output and standard error.
        """
        if self.process.poll() is not None:
            return {"status": "error", "output": "Terminal process has terminated."}

        while not self.stdout_queue.empty():
            self.stdout_queue.get()
        while not self.stderr_queue.empty():
            self.stderr_queue.get()

        end_marker = "END_OF_COMMAND_OUTPUT_MARKER_8c21a"
        full_command = f"{command}; echo {end_marker}\n"

        self.process.stdin.write(full_command)
        self.process.stdin.flush()

        stdout_output = ""
        while True:
            try:
                line = self.stdout_queue.get(timeout=2)
                if end_marker in line:
                    break
                stdout_output += line
            except queue.Empty:
                break

        stderr_output = ""
        while not self.stderr_queue.empty():
            stderr_output += self.stderr_queue.get()

        return {"stdout": stdout_output.strip(), "stderr": stderr_output.strip()}

    def get_metadata(self) -> dict:
        """Generates the metadata for the LLM for this specific tool instance."""
        return {
            "type": "function",
            "function": {
                "name":
                    "execute_terminal_command",
                "description":
                    "Executes a command in a persistent Linux shell session and returns the stdout and stderr.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The shell command to execute (e.g., 'ls -l', 'pwd')."
                        }
                    },
                    "required": ["command"]
                }
            }
        }

    def as_agent_tool(self) -> dict:
        """Bundles the tool's execution function and its metadata for agent consumption."""
        return {"tool": self.execute, "metadata": self.get_metadata()}

    def __del__(self):
        """Ensure the shell process is terminated when the tool instance is destroyed."""
        if hasattr(self, 'process') and self.process and self.process.poll() is None:
            self.process.terminate()
            self.process.wait()
