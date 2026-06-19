import logging
from redis.exceptions import RedisError
from fastapi import Request, HTTPException, Depends

from config import REDIS_PREFIX
from utils.redis_utils import get_redis_client

logger = logging.getLogger(__name__)

def check_api_rate_limit(client_ip: str, limit: int = 100, window: int = 3600) -> bool:
    """Check if client IP has exceeded API rate limit"""
    redis_client = get_redis_client()
    if redis_client is None:
        return True  # Allow if Redis is not available
        
    try:
        key = f"{REDIS_PREFIX}ratelimit:{client_ip}"
        current = redis_client.get(key)
        
        if current is None:
            redis_client.set(key, 1, ex=window)
            return True
            
        count = int(current)
        if count >= limit:
            return False
            
        redis_client.incr(key)
        return True
    except RedisError as e:
        logger.error(f"Redis error in rate limiting: {e}")
        return True  # Allow if there's an error


def get_client_ip(request: Request) -> str:
    """Get client IP address considering proxy headers"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return request.client.host


async def rate_limit_dependency(request: Request):
    """FastAPI dependency for rate limiting"""
    client_ip = get_client_ip(request)
    if not check_api_rate_limit(client_ip):
        raise HTTPException(
            status_code=429, 
            detail="Rate limit exceeded. Please try again later."
        )
    return client_ip