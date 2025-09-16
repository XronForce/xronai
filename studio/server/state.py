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

    def is_default_workflow(self) -> bool:
        return self.is_default
