import os
import asyncio
import shutil
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from xronai.core import Supervisor, Agent
from xronai.config import load_yaml_config, AgentFactory
from xronai.history import HistoryManager

load_dotenv()

main_supervisor_config: Optional[Dict[str, Any]] = None
history_root_dir: Optional[str] = None
serve_ui_enabled: bool = False


class ChatRequest(BaseModel):
    query: str


class ChatResponse(BaseModel):
    response: str


class SessionResponse(BaseModel):
    session_id: str


class SessionListResponse(BaseModel):
    sessions: List[str]


def flatten_history_thread(threaded_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Recursively flattens the nested conversation tree into a single chronological list.
    """
    flat_list = []
    for message in threaded_history:
        flat_list.append({k: v for k, v in message.items() if k != 'responses'})

        if 'responses' in message and message['responses']:
            flat_list.extend(flatten_history_thread(message['responses']))

    return flat_list


async def load_history_for_workflow(node: Supervisor | Agent):
    """
    Recursively traverses the workflow and loads the chat history for each node.
    This is the "rehydration" step.
    """
    if node.history_manager:
        node.chat_history = await asyncio.to_thread(node.history_manager.load_chat_history, node.name)

    if isinstance(node, Supervisor):
        for child in node.registered_agents:
            await load_history_for_workflow(child)


async def run_chat_logic(session_id: str, query: str) -> str:
    """
    Core logic to instantiate a workflow for a session and process a query.
    """
    if not main_supervisor_config:
        raise HTTPException(status_code=503, detail="Server is not ready. Workflow not loaded.")

    session_path = os.path.join(history_root_dir, session_id)
    if not os.path.exists(session_path):
        os.makedirs(session_path, exist_ok=True)

    supervisor = await AgentFactory.create_from_config(config=main_supervisor_config,
                                                       history_base_path=history_root_dir)

    supervisor.set_workflow_id(session_id, history_base_path=history_root_dir)

    await load_history_for_workflow(supervisor)

    response = await asyncio.to_thread(supervisor.chat, query)
    return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles application startup logic."""
    global main_supervisor_config, history_root_dir, serve_ui_enabled
    print("--- XronAI Server Lifespan: Startup ---")

    workflow_file = os.getenv("XRONAI_WORKFLOW_FILE")
    history_dir = os.getenv("XRONAI_HISTORY_DIR", "xronai_sessions")
    serve_ui_enabled = os.getenv("XRONAI_SERVE_UI", "false").lower() == "true"

    if not workflow_file or not os.path.exists(workflow_file):
        print(f"FATAL: Workflow file not found at path: {workflow_file}. Server cannot start.")
        yield
        return

    try:
        print(f"Loading workflow configuration from: {workflow_file}")
        main_supervisor_config = load_yaml_config(workflow_file)

        history_root_dir = os.path.abspath(history_dir)
        os.makedirs(history_root_dir, exist_ok=True)
        print(f"History root directory set to: {history_root_dir}")

        print(f"UI Serving is {'ENABLED' if serve_ui_enabled else 'DISABLED'}.")
        print("--- XronAI Server is running ---")
    except Exception as e:
        print(f"FATAL: Failed to load workflow. Error: {e}")
        main_supervisor_config = None

    yield
    print("--- XronAI Server Lifespan: Shutdown ---")


app = FastAPI(title="XronAI Workflow Server",
              description="Serves a XronAI agentic workflow for interaction via API.",
              version="0.1.0",
              lifespan=lifespan)


@app.get("/api/v1/status", tags=["Server"])
async def get_status() -> Dict[str, Any]:
    if main_supervisor_config:
        return {"status": "ok", "workflow_loaded": True}
    else:
        return {"status": "error", "workflow_loaded": False}


@app.get("/api/v1/sessions", response_model=SessionListResponse, tags=["Sessions"])
async def list_sessions():
    if not history_root_dir:
        return {"sessions": []}
    sessions = [d for d in os.listdir(history_root_dir) if os.path.isdir(os.path.join(history_root_dir, d))]
    return {"sessions": sessions}


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201, tags=["Sessions"])
async def create_session():
    session_id = str(uuid.uuid4())
    os.makedirs(os.path.join(history_root_dir, session_id), exist_ok=True)
    return {"session_id": session_id}


@app.post("/api/v1/sessions/{session_id}/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_handler(session_id: str, request: ChatRequest):
    response_content = await run_chat_logic(session_id, request.query)
    return {"response": response_content}


@app.get("/api/v1/sessions/{session_id}/history", response_model=List[Dict[str, Any]], tags=["Chat"])
async def get_history(session_id: str):
    """
    Retrieves the full, flattened, and chronologically sorted history for a session.
    """
    try:
        manager = HistoryManager(workflow_id=session_id, base_path=history_root_dir)

        threaded_history = await asyncio.to_thread(manager.get_frontend_history)

        flat_history = flatten_history_thread(threaded_history)
        sorted_history = sorted(flat_history, key=lambda x: x['timestamp'])

        return sorted_history
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found.")


@app.delete("/api/v1/sessions/{session_id}", status_code=204, tags=["Sessions"])
async def delete_session(session_id: str):
    session_path = os.path.join(history_root_dir, session_id)
    if not os.path.isdir(session_path):
        raise HTTPException(status_code=404, detail="Session not found.")
    await asyncio.to_thread(shutil.rmtree, session_path)
    return {}


@app.websocket("/ws/sessions/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session_path = os.path.join(history_root_dir, session_id)
    if not os.path.isdir(session_path):
        await websocket.close(code=4000, reason="Session not found")
        return

    try:
        while True:
            data = await websocket.receive_json()
            query = data.get("query")
            if query:
                response = await run_chat_logic(session_id, query)
                await websocket.send_json({"response": response, "timestamp": datetime.utcnow().isoformat() + "Z"})
    except WebSocketDisconnect:
        print(f"WebSocket disconnected from session {session_id}")
    except Exception as e:
        print(f"Error in WebSocket for session {session_id}: {e}")
        await websocket.send_json({
            "error": f"An internal error occurred: {e}",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        await websocket.close(code=1011)


if os.getenv("XRONAI_SERVE_UI", "false").lower() == "true":
    ui_path = os.path.join(os.path.dirname(__file__), "ui")
    app.mount("/", StaticFiles(directory=ui_path, html=True), name="ui")
