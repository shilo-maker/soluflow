#!/bin/bash
set -e

echo "Starting server..."
cd server

echo "Installing server dependencies..."
npm install

echo "Starting Node server..."
node server.js
