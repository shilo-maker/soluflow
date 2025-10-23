#!/bin/bash
set -e

echo "Installing server dependencies..."
cd server
npm ci
cd ..

echo "Installing client dependencies and building..."
cd client
npm ci
npm run build
cd ..

echo "Build completed successfully!"
