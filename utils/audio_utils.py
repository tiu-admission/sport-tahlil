import os
import tempfile
import logging
import asyncio
import subprocess

logger = logging.getLogger(__name__)

def convert_audio_format_basic(input_file_path, target_format="mp3"):
    """
    Basic audio format conversion without FFmpeg
    This is a fallback when FFmpeg isn't available
    """
    try:
        # Create temp file with specified extension
        suffix = f".{target_format}"
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        temp_file.close()
        
        # Read original file content
        with open(input_file_path, "rb") as f:
            content = f.read()
        
        # Write to new file with different extension
        # This doesn't actually convert the format but might help with some files
        # where the format is good but the extension is wrong
        with open(temp_file.name, "wb") as f:
            f.write(content)
        
        logger.info(f"Created file with new extension: {input_file_path} -> {temp_file.name}")
        return temp_file.name
    except Exception as e:
        logger.error(f"Error in basic audio conversion: {e}")
        return None
    
    
def is_ffmpeg_available():
    """Check if FFmpeg is installed on the system"""
    try:
        # Try to run ffmpeg -version
        result = subprocess.run(["ffmpeg", "-version"], 
                               stdout=subprocess.PIPE, 
                               stderr=subprocess.PIPE,
                               timeout=5)  # Add timeout to prevent hanging
        return result.returncode == 0
    except Exception as e:
        logger.warning(f"FFmpeg check failed: {e}")
        return False


def convert_audio_to_mp3(input_file_path):
    """
    Convert any audio format to MP3 using FFmpeg for OpenAI compatibility
    Returns path to converted file
    """
    try:
        # Create temp file with .mp3 extension
        temp_mp3 = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
        temp_mp3.close()
        
        # Run FFmpeg to convert the file
        # -y: Overwrite output file without asking
        # -i: Input file
        # -vn: Disable video (if any)
        # -ar 44100: Set audio sampling rate to 44100 Hz
        # -ac 2: Set 2 audio channels (stereo)
        # -b:a 192k: Set audio bitrate to 192 kbps
        ffmpeg_cmd = [
            "ffmpeg", "-y", 
            "-i", input_file_path, 
            "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k",
            temp_mp3.name
        ]
        
        # Execute conversion process
        process = subprocess.run(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Check if conversion was successful
        if process.returncode != 0:
            logger.error(f"FFmpeg conversion failed: {process.stderr.decode()}")
            return None
            
        return temp_mp3.name
        
    except Exception as e:
        logger.error(f"Error converting audio: {e}")
        return None


async def cleanup_audio_file(file_path: str, delay: int = 300):
    """Delete audio file after specified delay (in seconds)"""
    await asyncio.sleep(delay)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up audio file: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up audio file {file_path}: {e}")