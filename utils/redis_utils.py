import json
import logging
import redis
from redis.exceptions import RedisError

from config import (
    REDIS_HOST, 
    REDIS_PORT, 
    REDIS_DB, 
    REDIS_PASSWORD,
    REDIS_PREFIX,
    REDIS_EXPIRATION
)

logger = logging.getLogger(__name__)

# Initialize Redis client with connection pooling
redis_pool = None
try:
    redis_pool = redis.ConnectionPool(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True,
        max_connections=10
    )
    # Test connection
    test_client = redis.Redis(connection_pool=redis_pool)
    test_client.ping()
    logger.info("Redis connection established successfully.")
except RedisError as e:
    logger.error(f"Failed to connect to Redis: {e}")
    redis_pool = None

def get_redis_client():
    """Get Redis client from connection pool"""
    if redis_pool:
        return redis.Redis(connection_pool=redis_pool)
    return None

def save_conversation_to_redis(conversation_id: str, messages: list):
    """Save conversation history to Redis"""
    redis_client = get_redis_client()
    if redis_client is None:
        logger.warning("Redis not available. Conversation not saved.")
        return False

    try:
        key = f"{REDIS_PREFIX}conversation:{conversation_id}"
        redis_client.set(key, json.dumps(messages), ex=REDIS_EXPIRATION)
        logger.info(f"Conversation {conversation_id} saved to Redis")
        return True
    except RedisError as e:
        logger.error(f"Redis error saving conversation {conversation_id}: {e}")
        return False


def get_conversation_from_redis(conversation_id: str):
    """Retrieve conversation history from Redis"""
    redis_client = get_redis_client()
    if redis_client is None:
        logger.warning("Redis not available. Cannot retrieve conversation.")
        return None

    try:
        key = f"{REDIS_PREFIX}conversation:{conversation_id}"
        data = redis_client.get(key)
        if data:
            # Reset expiration time on access
            redis_client.expire(key, REDIS_EXPIRATION)
            logger.info(f"Conversation {conversation_id} retrieved from Redis")
            return json.loads(data)
        return None
    except RedisError as e:
        logger.error(f"Redis error retrieving conversation {conversation_id}: {e}")
        return None


def delete_conversation_from_redis(conversation_id: str):
    """Delete conversation history from Redis"""
    redis_client = get_redis_client()
    if redis_client is None:
        logger.warning("Redis not available. Cannot delete conversation.")
        return False

    try:
        key = f"{REDIS_PREFIX}conversation:{conversation_id}"
        redis_client.delete(key)
        logger.info(f"Conversation {conversation_id} deleted from Redis")
        return True
    except RedisError as e:
        logger.error(f"Redis error deleting conversation {conversation_id}: {e}")
        return False


# Cache for system prompts
def get_cached_system_prompt(prompt_key: str = "default", language: str = "en"):
    """Get language-specific system prompt from cache"""
    redis_client = get_redis_client()
    if redis_client is None:
        return None
        
    try:
        key = f"{REDIS_PREFIX}system_prompt:{prompt_key}:{language}"
        return redis_client.get(key)
    except RedisError as e:
        logger.error(f"Redis error retrieving system prompt: {e}")
        return None


def cache_system_prompt(prompt: str, prompt_key: str = "default", language: str = "en"):
    """Cache language-specific system prompt for reuse"""
    redis_client = get_redis_client()
    if redis_client is None:
        return False
        
    try:
        key = f"{REDIS_PREFIX}system_prompt:{prompt_key}:{language}"
        redis_client.set(key, prompt, ex=REDIS_EXPIRATION * 2)  # Longer expiration for system prompts
        return True
    except RedisError as e:
        logger.error(f"Redis error caching system prompt: {e}")
        return False