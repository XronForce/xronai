import os
import typer
import uvicorn
import webbrowser
import asyncio
from typing_extensions import Annotated
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv


app = typer.Typer(name="xronai", help="The command-line interface for the XronAI SDK.", add_completion=False)


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        print("Welcome to XronAI CLI. Please specify a command, e.g., 'studio' or 'serve'.")
        print(ctx.get_help())


@app.command()
def studio(config: Annotated[Optional[str],
                             typer.Option(help="Path to a workflow YAML configuration file to load.")] = None,
           host: Annotated[str, typer.Option(help="The host address to run the server on.")] = "127.0.0.1",
           port: Annotated[int, typer.Option(help="The port number to run the server on.")] = 8000,
           no_browser: Annotated[bool,
                                 typer.Option("--no-browser", help="Do not automatically open a web browser.")] = False,
           reload: Annotated[bool, typer.Option("--reload", help="Enable auto-reloading for development.")] = False):
    """
    Launches the XronAI Studio, a web-based UI for building and managing agentic workflows.
    """
    current_working_directory = Path.cwd()
    dotenv_path = current_working_directory / ".env"

    if dotenv_path.is_file():
        print(f"INFO:     Loading environment variables from: {dotenv_path}")
        load_dotenv(dotenv_path=dotenv_path)
    else:
        print(f"INFO:     No .env file found in {current_working_directory}. Using system environment variables.")

    os.environ["XRONAI_STUDIO_LLM_MODEL"] = os.getenv("LLM_MODEL", "default-model")
    os.environ["XRONAI_STUDIO_LLM_API_KEY"] = os.getenv("LLM_API_KEY", "default-key")
    os.environ["XRONAI_STUDIO_LLM_BASE_URL"] = os.getenv("LLM_BASE_URL", "default-url")
    
    asyncio.run(start_studio_server(config=config, host=host, port=port, no_browser=no_browser, reload=reload))


async def start_studio_server(config, host, port, no_browser, reload):
    """
    The core async function to configure and run the Uvicorn server for the Studio.
    """
    if config:
        os.environ["XRONAI_CONFIG_PATH"] = config
        print(f"INFO:     Will load configuration from: {config}")
    else:
        if "XRONAI_CONFIG_PATH" in os.environ:
            del os.environ["XRONAI_CONFIG_PATH"]

    print(f"INFO:     Starting XronAI Studio server...")
    base_url = f"http://{host}:{port}"
    print(f"INFO:     Studio will be available at {base_url}")

    uv_config = uvicorn.Config("studio.server.main:app", host=host, port=port, reload=reload, log_level="info")

    server = uvicorn.Server(uv_config)

    if not no_browser and not reload:

        async def open_browser_after_delay():
            await asyncio.sleep(5)
            webbrowser.open_new_tab(base_url)

        asyncio.create_task(open_browser_after_delay())

    await server.serve()


@app.command()
def serve(
    workflow_file: Annotated[
        Path,
        typer.Argument(
            exists=True, file_okay=True, dir_okay=False, readable=True, help="Path to the exported workflow.yaml file."
        )],
    host: Annotated[str, typer.Option(help="The host address to run the server on.")] = "127.0.0.1",
    port: Annotated[int, typer.Option(help="The port number to run the server on.")] = 8001,
    history_dir: Annotated[
        Optional[Path],
        typer.
        Option(file_okay=False, dir_okay=True, writable=True, help="Directory to store conversation session histories."
              )] = None,
    ui: Annotated[bool, typer.Option("--ui", help="Serve a simple web-based chat UI.")] = False,
):
    """
    Loads and serves a XronAI workflow for production or testing.
    """
    current_working_directory = Path.cwd()
    dotenv_path = current_working_directory / ".env"

    if dotenv_path.is_file():
        print(f"INFO:     Loading environment variables from: {dotenv_path}")
        load_dotenv(dotenv_path=dotenv_path)
    else:
        print(f"INFO:     No .env file found in {current_working_directory}. Using system environment variables.")
        
    print(f"INFO:     Preparing to serve workflow: {workflow_file}")

    os.environ["XRONAI_WORKFLOW_FILE"] = str(workflow_file.resolve())

    if history_dir:
        history_dir.mkdir(parents=True, exist_ok=True)
        os.environ["XRONAI_HISTORY_DIR"] = str(history_dir.resolve())
    elif "XRONAI_HISTORY_DIR" in os.environ:
        del os.environ["XRONAI_HISTORY_DIR"]

    if ui:
        print("INFO:     --ui flag detected. Chat UI will be enabled.")
        os.environ["XRONAI_SERVE_UI"] = "true"
    elif "XRONAI_SERVE_UI" in os.environ:
        del os.environ["XRONAI_SERVE_UI"]

    uvicorn.run("xronai.server.main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    app()
