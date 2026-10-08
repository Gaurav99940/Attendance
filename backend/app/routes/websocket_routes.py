import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import get_ws_manager

logger = logging.getLogger("smartface.ws_route")
router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    manager = get_ws_manager()
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and receive client heartbeats/pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WS error: {e}")
        manager.disconnect(websocket)
