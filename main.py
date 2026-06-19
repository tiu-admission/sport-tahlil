import os
import logging
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from config import REDIS_PREFIX
from models import ChatResponse, TextQuestion
from routes.chat_routes import router as chat_router
from routes.websocket_routes import router as websocket_router
from utils.rate_limiting import rate_limit_dependency
from utils.redis_utils import get_redis_client

from fastapi.responses import FileResponse
from fastapi.responses import HTMLResponse, JSONResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log")
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SportTahlil API",
    description="API for SportTahlil athletic performance analysis chatbot with text and voice capabilities",
    version="1.0.0"
)

# Add session middleware for cookie handling
SESSION_SECRET = os.getenv("SESSION_SECRET")
if not SESSION_SECRET:
    raise ValueError("SESSION_SECRET environment variable is required")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up templates and static files
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Upload directories
AUDIO_DIR = "audio_uploads"
DOCUMENT_DIR = "document_uploads"
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(DOCUMENT_DIR, exist_ok=True)

# Include routers
app.include_router(chat_router)
app.include_router(websocket_router)

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    """Serve the main HTML page"""
    return FileResponse("templates/index.html", media_type="text/html")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    from datetime import datetime
    import openai
    
    health_status = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "redis": "available" if get_redis_client() is not None else "unavailable"
    }
    
    # Check OpenAI API
    try:
        # Simple API call to check if OpenAI is working
        openai.models.list()
        health_status["openai"] = "available"
    except Exception:
        health_status["openai"] = "unavailable"
        health_status["status"] = "degraded"
    
    return health_status

# API endpoint to get performance disclaimers
@app.get("/api/legal-disclaimer")
async def get_legal_disclaimer():
    """Get performance/health disclaimers for SportTahlil"""
    disclaimer = {
        "title": "Performance Disclaimer",
        "content": "The information provided by SportTahlil is for general informational and educational purposes only and does not constitute medical, nutritional, or professional health advice. For guidance tailored to your situation — especially regarding injuries, medical symptoms, or significant changes to training or diet — please consult a qualified sports physician, physiotherapist, or registered dietitian. Individual physiology varies, and training and nutrition decisions carry inherent risk."
    }
    
    return disclaimer
        
@app.get("/sitemap.xml")
async def get_sitemap():
    return FileResponse("static/sitemap.xml", media_type="application/xml")

@app.get("/robots.txt")
async def get_robots():
    return FileResponse("static/robots.txt", media_type="text/plain")

@app.get("/privacy", response_class=HTMLResponse)
async def get_privacy_policy(request: Request):
    """Serve the privacy policy page"""
    return FileResponse("templates/privacy.html", media_type="text/html")

@app.get("/terms", response_class=HTMLResponse)
async def get_terms_of_use(request: Request):
    """Serve the terms of use page"""
    return FileResponse("templates/terms.html", media_type="text/html")

@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc):
    """
    Handle 404 errors by rendering a custom template
    """
    return FileResponse(
        "templates/404.html",
        media_type="text/html",
        status_code=404
    )
    
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )