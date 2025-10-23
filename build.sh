#!/bin/bash
set -e

echo "Installing server dependencies..."
cd server
npm install
cd ..

echo "Installing client dependencies and building..."
cd client
npm install
npm run build
cd ..

echo "Build completed successfully!"
