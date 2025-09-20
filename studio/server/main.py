import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Any, Dict

from studio.server.state import StateManager
from xronai.tools import TOOL_REGISTRY
from studio.server.export_utils import generate_yaml_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

state_manager = StateManager()


class CompileRequest(BaseModel):
    drawflow: Dict[str, Any]


class ExportRequest(BaseModel):
    drawflow: Dict[str, Any]
    format: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Server is starting up.")
    yield
    logger.info("Server is shutting down.")


app = FastAPI(title="XronAI Studio Server", version="0.1.0", lifespan=lifespan)


@app.get("/api/v1/tools/schemas")
async def get_available_tool_schemas():
    """
    Returns a mapping of available tool names to their configuration schemas.
    The frontend uses this to dynamically build configuration forms.
    """
    schemas = {}
    for name, tool_class in TOOL_REGISTRY.items():
        if hasattr(tool_class, 'get_config_schema'):
            schemas[name] = tool_class.get_config_schema()
    return schemas


@app.get("/api/v1/nodes/{node_id}")
async def get_node_details(node_id: str):
    node = state_manager.find_node_by_id(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in compiled workflow.")
    return {"name": node.name, "system_message": node.system_message}


@app.post("/api/v1/workflow/compile")
async def compile_workflow(request: CompileRequest):
    """
    Receives a Drawflow graph from the frontend and builds a runnable workflow.
    """
    try:
        await state_manager.compile_workflow_from_json(request.model_dump())
        return {"status": "ok", "message": "Workflow compiled successfully."}
    except Exception as e:
        logger.error(f"Workflow compilation failed: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Compilation Error: {str(e)}")


@app.post("/api/v1/workflow/export")
async def export_workflow(request: ExportRequest):
    """
    Receives a Drawflow graph and returns it in the specified format (e.g., YAML).
    """
    if request.format == "yaml":
        try:
            yaml_content = generate_yaml_config(request.drawflow)
            return {"status": "ok", "format": "yaml", "content": yaml_content}
        except Exception as e:
            logger.error(f"YAML export failed: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Export Error: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Format '{request.format}' not supported.")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established.")

    chat_entry_point = state_manager.get_root_node()
    if not chat_entry_point:
        logger.warning("Chat initiated but no workflow is compiled. Closing connection.")
        await websocket.close(code=1011,
                              reason="No workflow compiled. Please design a workflow and start the chat again.")
        return

    loop = asyncio.get_running_loop()

    def on_event_sync(event: dict):
        asyncio.run_coroutine_threadsafe(websocket.send_json(event), loop)

    try:
        while True:
            user_query = await websocket.receive_text()
            logger.info(f"Received query for entry point '{chat_entry_point.name}': {user_query}")
            asyncio.create_task(asyncio.to_thread(chat_entry_point.chat, query=user_query, on_event=on_event_sync))
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        if not websocket.client_state.DISCONNECTED:
            await websocket.close()


app.mount("/", StaticFiles(directory="studio/ui", html=True), name="ui")
