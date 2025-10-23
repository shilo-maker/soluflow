#!/bin/bash
set -e

echo "Starting server..."
cd server

echo "Current directory: $(pwd)"
echo "Installing server dependencies..."
npm install

echo "Checking if nodemailer was installed..."
ls -la node_modules/ | grep nodemailer || echo "nodemailer NOT found in node_modules"
npm list nodemailer || echo "nodemailer not in package list"

echo "Starting Node server..."
node server.js
