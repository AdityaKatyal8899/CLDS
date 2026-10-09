"""Database and persistence layer for CLDS."""

from clds.database.mongodb import (
    MongoDBDatabase,
    MongoDBConfigurationError,
)
from clds.database.sqlite_legacy import SQLiteDatabase
from clds.database.migration import migrate_sqlite_to_mongodb

# Main database repository abstraction
Database = MongoDBDatabase


def get_database() -> MongoDBDatabase:
    """Convenience helper to obtain configured database repository instance."""
    return MongoDBDatabase()


__all__ = [
    "Database",
    "MongoDBDatabase",
    "MongoDBConfigurationError",
    "SQLiteDatabase",
    "migrate_sqlite_to_mongodb",
    "get_database",
]
