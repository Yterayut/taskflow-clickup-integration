#!/bin/bash
# Setup PostgreSQL Database

echo "🔧 Setting up PostgreSQL..."

# Create database as postgres user
sudo -u postgres createdb taskflow 2>/dev/null || echo "Database taskflow already exists"

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taskflow TO postgres;"

# Create extensions
sudo -u postgres psql -d taskflow -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

echo "✅ PostgreSQL setup completed"