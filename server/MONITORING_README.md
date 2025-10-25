# Solu Flow - Monitoring & Performance Guide

## Overview

This monitoring system tracks key metrics to help you understand your application's performance and capacity on Render.com's infrastructure.

## API Endpoints

### 1. Health Check (Public)
```
GET /api/monitoring/health
```

Returns basic health status including uptime and resource usage.

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-25T10:30:00.000Z",
  "uptime": "2d 5h 30m 15s",
  "activeConnections": 12,
  "memoryUsagePercent": 45
}
```

**Status Codes:**
- `200`: Healthy
- `503`: Degraded (high memory usage or too many connections)

### 2. Full Metrics (Admin Only)
```
GET /api/monitoring/metrics
```

Requires admin authentication. Returns comprehensive system metrics.

**Response Example:**
```json
{
  "timestamp": "2025-10-25T10:30:00.000Z",
  "server": {
    "uptime": "2d 5h 30m 15s",
    "uptimeSeconds": 192615
  },
  "connections": {
    "active": 12,
    "peak": 45
  },
  "requests": {
    "total": 15234,
    "byEndpoint": {
      "/api/songs": 3421,
      "/api/services": 2156,
      "/api/notes": 1890
    },
    "errors": 23
  },
  "memory": {
    "current": {
      "rss": 256,
      "heapTotal": 180,
      "heapUsed": 120,
      "external": 15
    },
    "peak": 145,
    "percentUsed": 67
  },
  "system": {
    "platform": "linux",
    "cpus": 1,
    "totalMemoryMB": 2048,
    "freeMemoryMB": 512,
    "loadAverage": [0.5, 0.4, 0.3]
  },
  "database": {
    "totalSize": "45 MB",
    "totalSizeMB": 45,
    "storageLimit": 1024,
    "percentUsed": 4,
    "tables": [
      {
        "schemaname": "public",
        "tablename": "Songs",
        "size": "25 MB",
        "size_bytes": 26214400
      }
    ]
  }
}
```

## Console Logging

The system automatically logs metrics every minute to the console:

```
========== SYSTEM METRICS ==========
Uptime: 2d 5h 30m 15s
Active Connections: 12 (Peak: 45)
Total Requests: 15234 (Errors: 23)
Memory Used: 120 MB / 180 MB (67%)
Peak Memory: 145 MB
Free System Memory: 512 MB / 2048 MB
====================================
```

## Understanding the Metrics

### Active Connections
- **What it means**: Number of WebSocket connections (users viewing services in real-time)
- **Warning threshold**: > 100 concurrent connections
- **Your capacity**: ~100-150 concurrent users with current setup

### Memory Usage
- **Heap Used**: Memory actively used by your application
- **Total Heap**: Memory allocated by Node.js
- **Warning threshold**: > 85% usage
- **Your capacity**: 2 GB total RAM, ~1.5 GB usable for connections

### Database Storage
- **Current limit**: 1 GB
- **Warning threshold**: > 800 MB (80%)
- **Recommended action**: Upgrade when approaching 800 MB

### Request Counts
- Tracks total HTTP requests and counts by endpoint
- Helps identify most-used features
- Error count helps track stability

## Monitoring Checklist

### Daily
- ✅ Check console logs for memory warnings
- ✅ Monitor peak connection count

### Weekly
- ✅ Review `/api/monitoring/metrics` for trends
- ✅ Check database storage usage
- ✅ Review error counts

### When to Scale Up

**Web Server (1 CPU, 2 GB RAM):**
- Consistently >40 concurrent connections
- Memory usage >85%
- Response times degrading
- Frequent WebSocket disconnections

**Database (0.5 CPU, 1 GB RAM, 1 GB Storage):**
- Storage >800 MB
- Query times >100ms consistently
- Multiple services experiencing lag

**Storage (1 GB):**
- Database size >800 MB
- Plan for growth: ~10,000 songs = ~20 MB

## Optimization Tips

### Current Implementation
1. ✅ Request tracking middleware
2. ✅ WebSocket connection monitoring
3. ✅ Memory usage tracking
4. ✅ Database metrics
5. ✅ Automatic periodic logging

### Future Optimizations
- [ ] Add Redis for session management (reduces memory usage)
- [ ] Implement database query caching
- [ ] Add connection pooling configuration
- [ ] Implement rate limiting for API endpoints

## Quick Access Commands

### View metrics locally (as admin):
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5002/api/monitoring/metrics
```

### View health status:
```bash
curl http://localhost:5002/api/monitoring/health
```

### View metrics in production:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://soluflow.onrender.com/api/monitoring/metrics
```

## Render.com Dashboard Integration

You can also monitor through Render's built-in metrics:
1. Go to your Render dashboard
2. Select your web service
3. Click "Metrics" tab
4. View CPU, Memory, and Network usage graphs

## Alert Thresholds

The monitoring system logs warnings for:
- 🔴 Memory usage >85%
- 🔴 Active connections >100
- 🟡 Slow requests >1000ms
- 🟡 Database size >800 MB (80% of limit)

## Support

For questions about monitoring or scaling, check:
- Render documentation: https://render.com/docs
- Monitor your application at: `/api/monitoring/metrics`
