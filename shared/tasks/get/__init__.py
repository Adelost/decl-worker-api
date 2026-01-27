"""
Input/download tasks - get category.

Tasks for fetching external data: downloads, RSS, APIs, etc.
"""

from . import download
from . import rss

__all__ = [
    "download",
    "rss",
]
