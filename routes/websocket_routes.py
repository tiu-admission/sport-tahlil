import json
import logging
import asyncio
from typing import Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks
from starlette.websockets import WebSocketState

from models import TextQuestion
from routes.chat_routes import chat

logger = logging.getLogger(__name__)

router = APIRouter()

# WebSocket connection manager with rate limiting
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.message_counts: Dict[str, int] = {}
        self.rate_limit = 20  # Max messages per minute
        self.rate_window = 60  # Window in seconds
        
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.message_counts[client_id] = 0
        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")
        
        # Schedule rate limit reset
        asyncio.create_task(self._reset_rate_limit(client_id))

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            
        if client_id in self.message_counts:
            del self.message_counts[client_id]
            
        logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: Dict[str, Any], client_id: str):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to client {client_id}: {e}")
                    self.disconnect(client_id)
            else:
                self.disconnect(client_id)

    async def broadcast(self, message: Dict[str, Any]):
        disconnected_clients = []
        for client_id, websocket in self.active_connections.items():
            if websocket.client_state == WebSocketState.CONNECTED:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to client {client_id}: {e}")
                    disconnected_clients.append(client_id)
            else:
                disconnected_clients.append(client_id)

        # Remove disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
    
    def check_rate_limit(self, client_id: str) -> bool:
        """Check if client has exceeded rate limit"""
        if client_id not in self.message_counts:
            return True
            
        if self.message_counts[client_id] >= self.rate_limit:
            return False
            
        self.message_counts[client_id] += 1
        return True
    
    async def _reset_rate_limit(self, client_id: str):
        """Reset rate limit after window expires"""
        await asyncio.sleep(self.rate_window)
        if client_id in self.message_counts:
            self.message_counts[client_id] = 0

# Create a manager instance
manager = ConnectionManager()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            message_type = message.get("type")
            message_data = message.get("data", {})

            if message_type == "ping":
                # Simple ping-pong for connection keep-alive
                await manager.send_personal_message({"type": "pong"}, client_id)

            elif message_type == "chat_message":
                # Check rate limit
                if not manager.check_rate_limit(client_id):
                    await manager.send_personal_message(
                        {"type": "error", "data": {"message": "Rate limit exceeded. Please slow down."}},
                        client_id
                    )
                    continue

                # Process chat message
                conversation_id = message_data.get("conversation_id")
                user_message = message_data.get("message")

                if not user_message:
                    await manager.send_personal_message(
                        {"type": "error", "data": {"message": "Message content is required"}},
                        client_id
                    )
                    continue

                # Notify client that message is being processed
                await manager.send_personal_message(
                    {"type": "processing", "data": {"message": "Processing your message..."}},
                    client_id
                )

                try:
                    # Create background tasks
                    background_tasks = BackgroundTasks()
                    
                    # Process the message
                    regenerate = message_data.get("regenerate", False)
                    question = TextQuestion(
                        message=user_message,
                        conversation_id=conversation_id,
                        regenerate=regenerate
                    )
                    response = await chat(question, background_tasks)

                    # Send response back to client
                    await manager.send_personal_message(
                        {
                            "type": "chat_response",
                            "data": {
                                "answer": response.answer,
                                "conversation_id": response.conversation_id
                            }
                        },
                        client_id
                    )
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {e}")
                    
                    await manager.send_personal_message(
                        {"type": "error", "data": {"message": "An error occurred while processing your message. Please try again."}},
                        client_id
                    )

            else:
                # Unknown message type
                await manager.send_personal_message(
                    {"type": "error", "data": {"message": f"Unknown message type: {message_type}"}},
                    client_id
                )

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON received from client {client_id}")
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)