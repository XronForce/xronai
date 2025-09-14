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
    
    This class is responsible for loading a workflow from a configuration file
    or initializing a default, empty state if no configuration is provided.
    """

    def __init__(self):
        self.root_node: Optional[Union[Supervisor, Agent]] = None
        self.config_path: Optional[str] = os.getenv("XRONAI_CONFIG_PATH")

    async def load_workflow(self):
        """
        Loads the workflow into memory.
        
        If a config path is provided, it loads from the YAML file.
        Otherwise, it creates a default, single-agent setup for a blank canvas experience.
        """
        if self.config_path and os.path.exists(self.config_path):
            try:
                logger.info(f"Loading workflow from configuration: {self.config_path}")
                config = load_yaml_config(self.config_path)
                self.root_node = await AgentFactory.create_from_config(config)
                logger.info(f"Successfully loaded supervisor: {self.root_node.name}")
            except Exception as e:
                logger.error(f"Failed to load workflow from {self.config_path}: {e}", exc_info=True)
                # Fallback to a default state on error
                await self._load_default_workflow()
        else:
            logger.info("No configuration file provided. Loading default blank canvas workflow.")
            await self._load_default_workflow()

    async def _load_default_workflow(self):
        """
        Creates a simple, single-agent workflow as a default.
        This represents the "blank canvas" for the user to start building.
        """
        # For a truly blank canvas, the UI would be responsible for creation.
        # For now, we'll create a placeholder agent so the chat is functional.
        # In a future step, the root_node might start as None.
        self.root_node = Agent(
            name="DefaultAgent",
            llm_config={
                "model": os.getenv("LLM_MODEL", "default-model"),
                "api_key": os.getenv("LLM_API_KEY", "default-key"),
                "base_url": os.getenv("LLM_BASE_URL", "default-url"),
            },
            system_message="You are a helpful assistant. You are the starting point for a new workflow.")

        await self.root_node._load_mcp_tools()
        logger.info("Loaded default single-agent workflow.")

    def get_root_node(self) -> Optional[Union[Supervisor, Agent]]:
        """
        Returns the root node of the loaded workflow.
        This is the entry point for any chat interaction.
        """
        return self.root_node
