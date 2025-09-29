# Reconnection Testing Guide

## Overview
The gRPC client has been enhanced with automatic reconnection capabilities to handle connection drops gracefully.

## New Features Added

### 1. Automatic Reconnection Logic
- Detects gRPC error code 14 (UNAVAILABLE) and "Connection dropped" errors
- Automatically attempts to reconnect with exponential backoff
- Maximum of 10 reconnection attempts before giving up

### 2. Exponential Backoff Strategy
- Initial delay: 1 second
- Maximum delay: 60 seconds
- Includes jitter to prevent thundering herd problems
- Formula: `min(initial_delay * 2^attempt, max_delay) + random(0-1000ms)`

### 3. Connection State Tracking
- Tracks connection uptime
- Monitors reconnection attempts
- Provides detailed logging for connection events

### 4. Graceful Cleanup
- Properly cancels existing streams before reconnecting
- Cleans up timers and resources on process termination
- Prevents memory leaks during reconnection cycles

## Testing the Reconnection

### Scenario 1: Network Interruption
1. Start the application: `node index.js`
2. Simulate network interruption (disable network interface temporarily)
3. Observe the reconnection attempts in the logs
4. Re-enable network and verify successful reconnection

### Scenario 2: Server Restart
1. Start the application: `node index.js`
2. Restart the gRPC server
3. Verify the client automatically reconnects when server comes back online

### Expected Log Output
```
Connecting to CoreCast stream...
Server: your-server-address
Stream type: dex_trades
Filters: {...}

# When connection drops:
Stream error: Error: 14 UNAVAILABLE: Connection dropped
Connection dropped detected, attempting to reconnect...
Attempting to reconnect in 1234ms (attempt 1/10)...

# On successful reconnection:
Reconnecting to CoreCast stream... (attempt 1)
Successfully reconnected to stream

# Performance stats now include:
Connection uptime: 45s
Reconnect attempts: 1
```

## Configuration Options

The reconnection behavior can be adjusted by modifying these constants in `index.js`:

```javascript
const MAX_RECONNECT_ATTEMPTS = 10;        // Maximum reconnection attempts
const INITIAL_RECONNECT_DELAY = 1000;     // Initial delay in milliseconds
const MAX_RECONNECT_DELAY = 60000;        // Maximum delay in milliseconds
```

## Error Handling

The system handles different types of errors:

1. **Connection Drops (Code 14)**: Automatic reconnection
2. **Other gRPC Errors**: Process exits with error details
3. **Max Attempts Reached**: Process exits with failure message
4. **Graceful Shutdown**: SIGINT/SIGTERM properly clean up resources

## Monitoring

The enhanced stats output includes:
- Connection uptime tracking
- Reconnection attempt counter
- Memory usage monitoring
- Stream status information
