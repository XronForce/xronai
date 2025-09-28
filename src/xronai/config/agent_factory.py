"""
AgentFactory module for creating hierarchical structures of Supervisors and Agents.

This module provides a factory class that constructs a complete hierarchy of
Supervisors and Agents based on a configuration dictionary, typically loaded
from a YAML file.
"""

import importlib, uuid
from typing import Dict, Any, List, Optional, Union
from xronai.core import Supervisor, Agent
from .config_validator import ConfigValidator


class AgentFactory:
    """
    A factory class for creating hierarchical structures of Supervisors and Agents.

    This class provides static methods to create a complete hierarchy of
    Supervisors and Agents based on a configuration dictionary. It handles
    the creation of tools for Agents and ensures proper nesting of
    Supervisors and Agents.
    """

    @staticmethod
    async def create_from_config(config: Dict[str, Any],
                                 history_base_path: Optional[str] = None) -> Union[Supervisor, Agent]:
        """
        Create a Supervisor or a standalone Agent from a configuration dictionary.

        Args:
            config (Dict[str, Any]): The configuration dictionary containing
                the entire hierarchy structure.
            history_base_path (Optional[str]): The root directory for storing history logs.

        Returns:
            Union[Supervisor, Agent]: The root Supervisor or Agent of the created workflow.

        Raises:
            ConfigValidationError: If the configuration is invalid.
        """
        ConfigValidator.validate(config)
        workflow_id = config.get('workflow_id', str(uuid.uuid4()))

        if 'supervisor' in config:
            return await AgentFactory._create_supervisor(config['supervisor'],
                                                         is_root=True,
                                                         workflow_id=workflow_id,
                                                         history_base_path=history_base_path)
        elif 'agent' in config:
            return await AgentFactory._create_agent(config['agent'],
                                                    workflow_id=workflow_id,
                                                    history_base_path=history_base_path)

    @staticmethod
    async def _create_supervisor(supervisor_config: Dict[str, Any],
                                 is_root: bool = False,
                                 workflow_id: Optional[str] = None,
                                 history_base_path: Optional[str] = None) -> Supervisor:
        """
        Create a Supervisor instance and its children from a configuration dictionary.

        Args:
            supervisor_config (Dict[str, Any]): The configuration for this Supervisor.
            is_root (bool): Whether this Supervisor is the root of the hierarchy.
            workflow_id (Optional[str]): ID of the workflow (only for root supervisor).
            history_base_path (Optional[str]): The root directory for storing history logs.

        Returns:
            Supervisor: The created Supervisor instance with all its children.
        """
        supervisor = Supervisor(name=supervisor_config['name'],
                                llm_config=supervisor_config['llm_config'],
                                system_message=supervisor_config['system_message'],
                                workflow_id=workflow_id if is_root else None,
                                is_assistant=supervisor_config.get('is_assistant', False),
                                history_base_path=history_base_path)

        for child_config in supervisor_config.get('children', []):
            if child_config['type'] == 'supervisor':
                child = await AgentFactory._create_supervisor(child_config,
                                                              is_root=False,
                                                              workflow_id=None,
                                                              history_base_path=history_base_path)
            else:
                child = await AgentFactory._create_agent(child_config, history_base_path=history_base_path)
            supervisor.register_agent(child)

        return supervisor

    @staticmethod
    async def _create_agent(agent_config: Dict[str, Any],
                            workflow_id: Optional[str] = None,
                            history_base_path: Optional[str] = None) -> Agent:
        """
        Create an Agent instance from a configuration dictionary.

        Args:
            agent_config (Dict[str, Any]): The configuration for this Agent.
            workflow_id (Optional[str]): The ID for the workflow, if this is a root agent.
            history_base_path (Optional[str]): The root directory for storing history logs.

        Returns:
            Agent: The created Agent instance with its tools.
        """
        tools = AgentFactory._create_tools(agent_config.get('tools', []))

        agent_params = {
            'name': agent_config['name'],
            'llm_config': agent_config['llm_config'],
            'system_message': agent_config['system_message'],
            'workflow_id': workflow_id,
            'tools': tools,
            'use_tools': agent_config.get('use_tools',
                                          bool(tools) or bool(agent_config.get('mcp_servers'))),
            'keep_history': agent_config.get('keep_history', True),
            'output_schema': agent_config.get('output_schema'),
            'strict': agent_config.get('strict', False),
            'mcp_servers': agent_config.get('mcp_servers', []),
            'history_base_path': history_base_path
        }

        agent = Agent(**agent_params)
        await agent._load_mcp_tools()
        return agent

    @staticmethod
    def _create_tools(tools_config: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Create a list of tool configurations from the provided tool configs.

        Args:
            tools_config (List[Dict[str, Any]]): List of tool configurations.

        Returns:
            List[Dict[str, Any]]: List of created tool configurations.
        """
        tools = []
        for tool_config in tools_config:
            imported_obj = AgentFactory._import_function(tool_config['python_path'])
            tool_function = None

            if isinstance(imported_obj, type):
                tool_init_config = tool_config.get('config', {})
                tool_instance = imported_obj(**tool_init_config)
                tool_function = tool_instance.execute
            else:
                tool_function = imported_obj

            metadata = {
                "type": "function",
                "function": {
                    "name": tool_config['name'],
                    "description": tool_config.get('description', ''),
                    "parameters": {
                        "type": "object",
                        "properties": tool_config.get('parameters', {}),
                        "required": list(tool_config.get('parameters', {}).keys())
                    }
                }
            }
            tools.append({"tool": tool_function, "metadata": metadata})
        return tools

    @staticmethod
    def _import_function(python_path: str):
        """
        Import a function or class from a given Python path.

        Args:
            python_path (str): The full path to the object, including module.

        Returns:
            Callable or type: The imported function or class.

        Raises:
            ImportError: If the module or object cannot be imported.
            AttributeError: If the specified object is not found in the module.
        """
        module_name, object_name = python_path.rsplit('.', 1)
        module = importlib.import_module(module_name)
        return getattr(module, object_name)
