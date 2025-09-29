import os
import asyncio
import shutil
import uuid
import json
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Union
from dotenv import load_dotenv

from xronai.core import Supervisor, Agent
from xronai.config import load_yaml_config, AgentFactory
from xronai.history import HistoryManager, EntityType

load_dotenv()

main_workflow_config: Optional[Dict[str, Any]] = None
history_root_dir: Optional[str] = None
serve_ui_enabled: bool = False


class SessionResponse(BaseModel):
    session_id: str


class SessionListResponse(BaseModel):
    sessions: List[str]


def _history_log_to_event(log_entry: Dict[str, Any], all_logs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Translates a single raw history.jsonl entry into a structured event 
    that the frontend can render, using the full log for context.
    """
    role = log_entry.get("role")
    content = log_entry.get("content")
    tool_calls = log_entry.get("tool_calls")
    sender_name = log_entry.get("sender_name")
    sender_type = log_entry.get("sender_type")

    event = {"id": log_entry.get("message_id"), "timestamp": log_entry.get("timestamp"), "data": {}}

    if sender_type == EntityType.USER:
        event["type"] = "WORKFLOW_START"
        event["data"] = {"user_query": content}

    elif role == "assistant" and tool_calls:
        tool_call = tool_calls[0]['function']
        tool_name = tool_call['name']
        arguments = json.loads(tool_call.get('arguments', '{}'))

        if tool_name.startswith("delegate_to_"):
            event["type"] = "SUPERVISOR_DELEGATE"
            event["data"] = {
                "source": {
                    "name": sender_name
                },
                "target": {
                    "name": tool_name.replace("delegate_to_", "")
                },
                "reasoning": arguments.get('reasoning'),
                "query_for_agent": arguments.get('query')
            }
        else:
            event["type"] = "AGENT_TOOL_CALL"
            event["data"] = {"source": {"name": sender_name}, "tool_name": tool_name, "arguments": arguments}

    elif role == "tool":
        parent_id = log_entry.get("parent_id")
        if not parent_id:
            return None
        parent_msg = next((log for log in all_logs if log.get("message_id") == parent_id), None)
        if not parent_msg:
            return None

        parent_tool_calls = parent_msg.get("tool_calls")
        if parent_tool_calls and parent_tool_calls[0]['function']['name'].startswith("delegate_to_"):
            agent_name = parent_tool_calls[0]['function']['name'].replace("delegate_to_", "")
            event["type"] = "AGENT_RESPONSE"
            event["data"] = {"source": {"name": agent_name}, "content": content}
        else:
            event["type"] = "AGENT_TOOL_RESPONSE"
            event["data"] = {"source": {"name": sender_name}, "result": content}

    elif role == "assistant" and not tool_calls:
        event["type"] = "FINAL_RESPONSE"
        event["data"] = {"source": {"name": sender_name}, "content": content}

    else:
        return None

    return event


async def get_workflow_entry_point(session_id: str) -> Union[Supervisor, Agent]:
    """
    Factory function to build and configure a runnable workflow entry point (Supervisor or Agent)
    for a given session ID, loading its history.
    """
    if not main_workflow_config:
        raise HTTPException(status_code=503, detail="Server not ready: No workflow configuration loaded.")

    session_path = os.path.join(history_root_dir, session_id)
    os.makedirs(session_path, exist_ok=True)

    chat_entry_point = await AgentFactory.create_from_config(config=main_workflow_config,
                                                             history_base_path=history_root_dir)

    chat_entry_point.set_workflow_id(session_id, history_base_path=history_root_dir)

    async def load_history_for_node(node: Union[Supervisor, Agent]):
        if node.history_manager:
            node.chat_history = await asyncio.to_thread(node.history_manager.load_chat_history, node.name)
        if isinstance(node, Supervisor):
            for child in node.registered_agents:
                await load_history_for_node(child)

    await load_history_for_node(chat_entry_point)
    return chat_entry_point


@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_workflow_config, history_root_dir, serve_ui_enabled
    print("--- XronAI Server Lifespan: Startup ---")
    workflow_file, history_dir = os.getenv("XRONAI_WORKFLOW_FILE"), os.getenv("XRONAI_HISTORY_DIR", "xronai_sessions")
    serve_ui_enabled = os.getenv("XRONAI_SERVE_UI", "false").lower() == "true"

    if not workflow_file or not os.path.exists(workflow_file):
        print(f"FATAL: Workflow file not found at path: {workflow_file}.")
        yield
        return

    try:
        main_workflow_config = load_yaml_config(workflow_file)
        history_root_dir = os.path.abspath(history_dir)
        os.makedirs(history_root_dir, exist_ok=True)
        print(f"History root directory set to: {history_root_dir}")
        print("--- XronAI Server is running ---")
    except Exception as e:
        print(f"FATAL: Failed to load workflow. Error: {e}")

    yield
    print("--- XronAI Server Lifespan: Shutdown ---")


app = FastAPI(title="XronAI Workflow Server", lifespan=lifespan)


@app.get("/api/v1/status", tags=["Server"])
async def get_status():
    return {"status": "ok", "workflow_loaded": bool(main_workflow_config)}


@app.get("/api/v1/sessions", response_model=SessionListResponse, tags=["Sessions"])
async def list_sessions():
    if not history_root_dir:
        return {"sessions": []}
    return {"sessions": [d for d in os.listdir(history_root_dir) if os.path.isdir(os.path.join(history_root_dir, d))]}


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201, tags=["Sessions"])
async def create_session():
    session_id = str(uuid.uuid4())
    os.makedirs(os.path.join(history_root_dir, session_id), exist_ok=True)
    return {"session_id": session_id}


@app.delete("/api/v1/sessions/{session_id}", status_code=204, tags=["Sessions"])
async def delete_session(session_id: str):
    session_path = os.path.join(history_root_dir, session_id)
    if not os.path.isdir(session_path):
        raise HTTPException(status_code=404, detail="Session not found.")
    await asyncio.to_thread(shutil.rmtree, session_path)


@app.get("/api/v1/sessions/{session_id}/history", response_model=List[Dict[str, Any]], tags=["Chat"])
async def get_history_as_events(session_id: str):
    try:
        manager = HistoryManager(workflow_id=session_id, base_path=history_root_dir)
        history_path = manager.history_file
        if not os.path.exists(history_path):
            return []

        with open(history_path, 'r') as f:
            raw_logs = [json.loads(line) for line in f.readlines()]

        sorted_logs = sorted(raw_logs, key=lambda x: x['timestamp'])
        events = [_history_log_to_event(log, sorted_logs) for log in sorted_logs]
        return [event for event in events if event is not None]

    except ValueError:
        raise HTTPException(status_code=404, detail="Session history not found.")


@app.websocket("/ws/sessions/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if not os.path.isdir(os.path.join(history_root_dir, session_id)):
        await websocket.close(code=4000, reason="Session not found")
        return

    loop = asyncio.get_running_loop()

    def on_event_sync(event: dict):
        asyncio.run_coroutine_threadsafe(websocket.send_json(event), loop)

    try:
        while True:
            data = await websocket.receive_json()
            if query := data.get("query"):
                chat_entry_point = await get_workflow_entry_point(session_id)
                asyncio.create_task(asyncio.to_thread(chat_entry_point.chat, query=query, on_event=on_event_sync))
    except WebSocketDisconnect:
        print(f"WebSocket disconnected from session {session_id}")
    except Exception as e:
        print(f"Error in WebSocket for session {session_id}: {e}")


if os.getenv("XRONAI_SERVE_UI", "false").lower() == "true":
    app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "ui"), html=True), name="ui")
