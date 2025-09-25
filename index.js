const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const yaml = require('js-yaml');
const bs58 = require('bs58');

// Performance optimization: Cache for base58 conversions
const base58Cache = new Map();
const MAX_CACHE_SIZE = 10000;

// Performance optimization: Batch console output
let logBuffer = [];
let logFlushInterval = null;
const LOG_FLUSH_INTERVAL_MS = 100; // Flush logs every 100ms
const MAX_LOG_BUFFER_SIZE = 1000; // Prevent memory buildup

// Performance optimization: Message processing stats
let messageCount = 0;
let lastStatsTime = Date.now();
const STATS_INTERVAL_MS = 30000; // Log stats every 30 seconds

// Load configuration
const config = yaml.load(fs.readFileSync('./config.yaml', 'utf8'));

// Optimized helper function to convert bytes to base58 with caching
function toBase58(bytes) {
  if (!bytes || bytes.length === 0) return 'undefined';
  
  // Create cache key from bytes
  const cacheKey = Buffer.from(bytes).toString('hex');
  
  // Check cache first
  if (base58Cache.has(cacheKey)) {
    return base58Cache.get(cacheKey);
  }
  
  try {
    const result = bs58.encode(bytes);
    
    // Cache the result (with size limit)
    if (base58Cache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries (simple LRU approximation)
      const firstKey = base58Cache.keys().next().value;
      base58Cache.delete(firstKey);
    }
    base58Cache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    return 'invalid_address';
  }
}

// Optimized logging system with batching and memory management
function bufferedLog(message) {
  logBuffer.push(message);
  
  // Prevent memory buildup by forcing flush if buffer gets too large
  if (logBuffer.length >= MAX_LOG_BUFFER_SIZE) {
    flushLogs();
  }
  
  // Start flush interval if not already running
  if (!logFlushInterval) {
    logFlushInterval = setInterval(() => {
      if (logBuffer.length > 0) {
        console.log(logBuffer.join('\n'));
        logBuffer = [];
      }
    }, LOG_FLUSH_INTERVAL_MS);
  }
}

// Force flush logs immediately (for critical messages)
function flushLogs() {
  if (logBuffer.length > 0) {
    console.log(logBuffer.join('\n'));
    logBuffer = [];
  }
}

// Load proto files with optimized options
const packageDefinition = protoLoader.loadSync([
  './solana/corecast/corecast.proto',
  './solana/corecast/request.proto',
  './solana/corecast/stream_message.proto',
  './solana/dex_block_message.proto',
  './solana/block_message.proto',
  './solana/token_block_message.proto',
  './solana/parsed_idl_block_message.proto'
], {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: ['.'],
  // Performance optimizations
  bytes: Buffer,
  arrays: true,
  objects: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const solanaCorecast = protoDescriptor.solana_corecast;

// Create gRPC client with optimized options
const client = new solanaCorecast.CoreCast(
  config.server.address,
  config.server.insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl(),
  {
    // Performance optimizations
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.keepalive_permit_without_calls': true,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 10000,
    'grpc.http2.min_ping_interval_without_data_ms': 300000,
    // Buffer optimizations
    'grpc.max_receive_message_length': 4 * 1024 * 1024, // 4MB
    'grpc.max_send_message_length': 4 * 1024 * 1024,    // 4MB
    // Connection optimizations
    'grpc.enable_retries': 1,
    'grpc.max_connection_idle_ms': 30000,
    'grpc.max_connection_age_ms': 300000,
    'grpc.max_connection_age_grace_ms': 5000
  }
);

// Create metadata with authorization
const metadata = new grpc.Metadata();
metadata.add('authorization', config.server.authorization);

// Create request based on configuration
function createRequest() {
  const request = {};
  
  if (config.filters.programs && config.filters.programs.length > 0) {
    request.program = {
      addresses: config.filters.programs
    };
  }
  
  if (config.filters.pool && config.filters.pool.length > 0) {
    request.pool = {
      addresses: config.filters.pool
    };
  }
  
  if (config.filters.traders && config.filters.traders.length > 0) {
    request.trader = {
      addresses: config.filters.traders
    };
  }
  
  if (config.filters.signers && config.filters.signers.length > 0) {
    request.signer = {
      addresses: config.filters.signers
    };
  }
  
  return request;
}

// Stream listener function
function listenToStream() {
  // Use immediate console.log for startup messages
  console.log('Connecting to CoreCast stream...');
  console.log('Server:', config.server.address);
  console.log('Stream type:', config.stream.type);
  console.log('Filters:', JSON.stringify(config.filters, null, 2));
  
  const request = createRequest();
  
  // Create stream based on type
  let stream;
  switch (config.stream.type) {
    case 'dex_trades':
      stream = client.DexTrades(request, metadata);
      break;
    case 'dex_orders':
      stream = client.DexOrders(request, metadata);
      break;
    case 'dex_pools':
      stream = client.DexPools(request, metadata);
      break;
    case 'transactions':
      stream = client.Transactions(request, metadata);
      break;
    case 'transfers':
      stream = client.Transfers(request, metadata);
      break;
    case 'balances':
      stream = client.Balances(request, metadata);
      break;
    default:
      throw new Error(`Unsupported stream type: ${config.stream.type}`);
  }
  
  // Handle stream events with optimized logging
  stream.on('data', (message) => {
    const receivedTimestamp = Date.now();
    messageCount++;
    
    // Log performance stats periodically
    const now = Date.now();
    if (now - lastStatsTime >= STATS_INTERVAL_MS) {
      const messagesPerSecond = (messageCount * 1000) / (now - lastStatsTime);
      bufferedLog(`\n=== Performance Stats ===\nMessages processed: ${messageCount}\nRate: ${messagesPerSecond.toFixed(2)} msg/sec\nCache size: ${base58Cache.size}\nLog buffer size: ${logBuffer.length}`);
      messageCount = 0;
      lastStatsTime = now;
    }
    
    // Build log message efficiently
    const logLines = [
      '\n=== New Message ===',
      `Block Slot: ${message.Block?.Slot}`,
      `Received Timestamp: ${new Date(receivedTimestamp).toISOString()}`
    ];
    
    // Handle different message types efficiently
    if (message.Trade) {
      logLines.push(
        'Trade Event:',
        `  Instruction Index: ${message.Trade.InstructionIndex}`,
        `  DEX Program: ${toBase58(message.Trade.Dex?.ProgramAddress)}`,
        `  Protocol: ${message.Trade.Dex?.ProtocolName}`,
        `  Market: ${toBase58(message.Trade.Market?.MarketAddress)}`,
        `  Buy Amount: ${message.Trade.Buy?.Amount}`,
        `  Sell Amount: ${message.Trade.Sell?.Amount}`,
        `  Fee: ${message.Trade.Fee}`,
        `  Royalty: ${message.Trade.Royalty}`
      );
    }
    
    if (message.Order) {
      logLines.push(
        'Order Event:',
        `  Order ID: ${toBase58(message.Order.Order?.OrderId)}`,
        `  Buy Side: ${message.Order.Order?.BuySide}`,
        `  Limit Price: ${message.Order.Order?.LimitPrice}`,
        `  Limit Amount: ${message.Order.Order?.LimitAmount}`
      );
    }
    
    if (message.PoolEvent) {
      logLines.push(
        'Pool Event:',
        `  Market: ${toBase58(message.PoolEvent.Market?.MarketAddress)}`,
        `  Base Currency Change: ${message.PoolEvent.BaseCurrency?.ChangeAmount}`,
        `  Quote Currency Change: ${message.PoolEvent.QuoteCurrency?.ChangeAmount}`
      );
    }
    
    if (message.Transfer) {
      logLines.push(
        'Transfer Event:',
        `  Amount: ${message.Transfer.Amount}`,
        `  From: ${toBase58(message.Transfer.From)}`,
        `  To: ${toBase58(message.Transfer.To)}`
      );
    }
    
    if (message.BalanceUpdate) {
      logLines.push(
        'Balance Update:',
        `  Address: ${toBase58(message.BalanceUpdate.Address)}`,
        `  Change: ${message.BalanceUpdate.Change}`,
        `  New Balance: ${message.BalanceUpdate.NewBalance}`
      );
    }
    
    if (message.Transaction) {
      logLines.push(
        'Parsed Transaction:',
        `  Signature: ${toBase58(message.Transaction.Signature)}`,
        `  Status: ${message.Transaction.Status}`
      );
      
      const instructions = message.Transaction.ParsedIdlInstructions || [];
      logLines.push(`  ParsedIdlInstructions count: ${instructions.length}`);
      
      // Optimize instruction processing
      const instructionDetails = instructions.map(ix => {
        const programAddr = ix.Program ? toBase58(ix.Program.Address) : 'unknown';
        const programName = ix.Program?.Name || '';
        const method = ix.Program?.Method || '';
        const accountsCount = (ix.Accounts || []).length;
        return `    #${ix.Index} program=${programAddr} name=${programName} method=${method} accounts=${accountsCount}`;
      });
      
      logLines.push(...instructionDetails);
    }
    
    // Output all log lines at once using buffered logging
    bufferedLog(logLines.join('\n'));
  });
  
  stream.on('error', (error) => {
    // Flush any pending logs before showing error
    flushLogs();
    console.error('Stream error:', error);
    console.error('Error details:', error.details);
    console.error('Error code:', error.code);
  });
  
  stream.on('end', () => {
    flushLogs();
    console.log('Stream ended');
  });
  
  stream.on('status', (status) => {
    // Use buffered log for status updates
    bufferedLog(`Stream status: ${JSON.stringify(status)}`);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  flushLogs();
  if (logFlushInterval) {
    clearInterval(logFlushInterval);
  }
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  flushLogs();
  if (logFlushInterval) {
    clearInterval(logFlushInterval);
  }
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

// Start listening
try {
  listenToStream();
} catch (error) {
  console.error('Failed to start stream:', error);
  process.exit(1);
}
