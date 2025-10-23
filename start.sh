#!/bin/bash
set -e

echo "Starting server..."
cd server

echo "Current directory: $(pwd)"
echo "Contents of server directory:"
ls -la

echo "Checking package.json..."
cat package.json | grep nodemailer

echo "Installing server dependencies..."
npm install --verbose 2>&1 | tail -20

echo "Checking installation..."
echo "Does node_modules exist?"
ls -la | grep node_modules || echo "NO node_modules directory!"
if [ -d "node_modules" ]; then
  echo "node_modules count:"
  ls node_modules | wc -l
  echo "Looking for nodemailer:"
  ls node_modules | grep nodemailer || echo "nodemailer NOT in node_modules"
fi

echo "Starting Node server..."
node server.js
