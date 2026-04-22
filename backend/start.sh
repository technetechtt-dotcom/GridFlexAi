#!/bin/sh
# Fallback start script for Railway (Backend)
npx prisma migrate deploy && npm run start
