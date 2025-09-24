const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const yaml = require('js-yaml');

// Load configuration
const config = yaml.load(fs.readFileSync('./config.yaml', 'utf8'));

// Load proto files
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
  includeDirs: ['.']
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const solanaCorecast = protoDescriptor.solana_corecast;

// Create gRPC client
const client = new solanaCorecast.CoreCast(
  config.server.address,
  config.server.insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl()
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
  
  return request;
}

// Stream listener function
function listenToStream() {
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
  
  // Handle stream events
  stream.on('data', (message) => {
    console.log('\n=== New Message ===');
    console.log('Block Slot:', message.Block?.Slot);
    console.log('Transaction Index:', message.Transaction?.Index);
    console.log('Transaction Signature:', message.Transaction?.Signature?.toString('hex'));
    console.log('Transaction Status:', message.Transaction?.Status);
    
    // Handle different message types
    if (message.Trade) {
      console.log('Trade Event:');
      console.log('  Instruction Index:', message.Trade.InstructionIndex);
      console.log('  DEX Program:', message.Trade.Dex?.ProgramAddress?.toString('hex'));
      console.log('  Protocol:', message.Trade.Dex?.ProtocolName);
      console.log('  Market:', message.Trade.Market?.MarketAddress?.toString('hex'));
      console.log('  Buy Amount:', message.Trade.Buy?.Amount);
      console.log('  Sell Amount:', message.Trade.Sell?.Amount);
      console.log('  Fee:', message.Trade.Fee);
      console.log('  Royalty:', message.Trade.Royalty);
    }
    
    if (message.Order) {
      console.log('Order Event:');
      console.log('  Order ID:', message.Order.Order?.OrderId?.toString('hex'));
      console.log('  Buy Side:', message.Order.Order?.BuySide);
      console.log('  Limit Price:', message.Order.Order?.LimitPrice);
      console.log('  Limit Amount:', message.Order.Order?.LimitAmount);
    }
    
    if (message.PoolEvent) {
      console.log('Pool Event:');
      console.log('  Market:', message.PoolEvent.Market?.MarketAddress?.toString('hex'));
      console.log('  Base Currency Change:', message.PoolEvent.BaseCurrency?.ChangeAmount);
      console.log('  Quote Currency Change:', message.PoolEvent.QuoteCurrency?.ChangeAmount);
    }
    
    if (message.Transfer) {
      console.log('Transfer Event:');
      console.log('  Amount:', message.Transfer.Amount);
      console.log('  From:', message.Transfer.From?.toString('hex'));
      console.log('  To:', message.Transfer.To?.toString('hex'));
    }
    
    if (message.BalanceUpdate) {
      console.log('Balance Update:');
      console.log('  Address:', message.BalanceUpdate.Address?.toString('hex'));
      console.log('  Change:', message.BalanceUpdate.Change);
      console.log('  New Balance:', message.BalanceUpdate.NewBalance);
    }
    
    if (message.Transaction) {
      console.log('Parsed Transaction:');
      console.log('  Signature:', message.Transaction.Signature?.toString('hex'));
      console.log('  Status:', message.Transaction.Status);
    }
  });
  
  stream.on('error', (error) => {
    console.error('Stream error:', error);
    console.error('Error details:', error.details);
    console.error('Error code:', error.code);
  });
  
  stream.on('end', () => {
    console.log('Stream ended');
  });
  
  stream.on('status', (status) => {
    console.log('Stream status:', status);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
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
