import sys
from loguru import logger


def setup_logger(log_level: str = "INFO", log_file: str = "logs/jobradar.log") -> "logger":
    logger.remove()
    logger.add(
        sys.stdout,
        level=log_level,
        colorize=True,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
    )
    logger.add(
        log_file,
        rotation="10 MB",
        retention="7 days",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    )
    return logger
