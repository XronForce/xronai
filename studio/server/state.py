import os
import logging
from typing import Optional, Union
from dotenv import load_dotenv

from xronai.core import Supervisor, Agent
from xronai.config import AgentFactory, load_yaml_config

load_dotenv()

logger = logging.getLogger(__name__)


class StateManager:
    """
    Manages the in-memory state of the XronAI workflow for the studio server.
    """

    def __init__(self):
        self.root_node: Optional[Union[Supervisor, Agent]] = None
        self.is_default: bool = False
        self.config_path: Optional[str] = os.getenv("XRONAI_CONFIG_PATH")

    async def load_workflow(self):
        """
        Loads the workflow into memory from a config file or creates a default.
        """
        if self.config_path and os.path.exists(self.config_path):
            try:
                logger.info(f"Loading workflow from configuration: {self.config_path}")
                config = load_yaml_config(self.config_path)
                self.root_node = await AgentFactory.create_from_config(config)
                self.is_default = False
                logger.info(f"Successfully loaded supervisor: {self.root_node.name}")
            except Exception as e:
                logger.error(f"Failed to load workflow from {self.config_path}: {e}", exc_info=True)
                await self._load_default_workflow()
        else:
            logger.info("No configuration file provided. Loading default blank canvas workflow.")
            await self._load_default_workflow()

    async def _load_default_workflow(self):
        """
        Creates a simple, single-agent workflow as a default starter template.
        """
        self.root_node = Agent(
            name="DefaultAgent",
            llm_config={
                "model": os.getenv("LLM_MODEL", "default-model"),
                "api_key": os.getenv("LLM_API_KEY", "default-key"),
                "base_url": os.getenv("LLM_BASE_URL", "default-url"),
            },
            workflow_id="blank-canvas-session",
            system_message="You are a helpful assistant. You are the starting point for a new workflow.")
        self.is_default = True
        await self.root_node._load_mcp_tools()
        logger.info("Loaded default single-agent workflow.")

    def get_root_node(self) -> Optional[Union[Supervisor, Agent]]:
        return self.root_node

    def find_node_by_id(self, node_id: str) -> Optional[Union[Supervisor, Agent]]:
        """
        Finds a node (Agent or Supervisor) within the loaded workflow by its unique ID (name).
        
        Args:
            node_id: The unique name of the node to find.

        Returns:
            The Agent or Supervisor object if found, otherwise None.
        """
        if not self.root_node:
            return None

        # Use a queue for a breadth-first search through the graph
        q = [self.root_node]
        visited = {self.root_node.name}

        while q:
            current_node = q.pop(0)
            if current_node.name == node_id:
                return current_node  # Node found

            if isinstance(current_node, Supervisor):
                for child in current_node.registered_agents:
                    if child.name not in visited:
                        visited.add(child.name)
                        q.append(child)

        return None  # Node not found in the entire graph

    def is_default_workflow(self) -> bool:
        return self.is_default
