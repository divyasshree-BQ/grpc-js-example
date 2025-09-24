# gRPC CoreCast Stream Client

This is a sample Node.js client for listening to CoreCast gRPC streams, specifically designed for Solana DEX trade data.

## Features

- Connects to Bitquery gRPC service
- Supports multiple stream types (dex_trades, dex_orders, dex_pools, transactions, transfers, balances)
- Configurable filters for programs, pools, and traders
- Real-time streaming of blockchain data
- Comprehensive error handling and logging

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your connection in `config.yaml`:
```yaml
server:
  address: "corecast.bitquery.io"
  authorization: "your_auth_token_here"
  insecure: false

stream:
  type: "dex_trades"
  
filters:
  programs:
    - "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" # jupiter
  # pool: # Market.MarketAddress
  #   - "5tUu7bX8d8Zz1v3v4Y9H9F6J7K8L9M0N1O2P3Q4R5S6T"
  # traders: # Trade.Buy.Account / Trade.Sell.Account
  #   - "7GJz9X7b1G9Nf1d5uQq2Z3B4nPq6F8d9LmNoPQrsTUV"
```

## Usage

Start the stream listener:
```bash
npm start
```

The client will connect to the CoreCast service and start streaming data based on your configuration. You'll see real-time updates for:

- **DEX Trades**: Trade events with buy/sell amounts, fees, and market information
- **DEX Orders**: Order events with order details and status changes
- **Pool Events**: Liquidity change events
- **Transfers**: Token transfer events
- **Balance Updates**: Account balance changes
- **Transactions**: Parsed transaction data

## Configuration Options

### Server Configuration
- `address`: CoreCast server address
- `authorization`: Your authentication token
- `insecure`: Set to `true` for insecure connections (not recommended for production)

### Stream Types
- `dex_trades`: DEX trade events
- `dex_orders`: DEX order events  
- `dex_pools`: Pool liquidity change events
- `transactions`: Parsed transaction events
- `transfers`: Token transfer events
- `balances`: Balance update events

### Filters Examples
- `programs`: Array of program addresses to filter by
- `pool`: Array of market/pool addresses to filter by
- `traders`: Array of trader addresses to filter by
- `signers`: Array of signer addresses to filter by (for transactions stream)

## Example Output

```
Connecting to CoreCast stream...
Server: corecast.bitquery.io
Stream type: dex_trades
Filters: {
  "programs": [
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
  ]
}

=== New Message ===
Block Slot: 123456789
Transaction Index: 0
Transaction Signature: abc123def456...
Transaction Status: SUCCESS
Trade Event:
  Instruction Index: 0
  DEX Program: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
  Protocol: Jupiter
  Market: 5tUu7bX8d8Zz1v3v4Y9H9F6J7K8L9M0N1O2P3Q4R5S6T
  Buy Amount: 1000000
  Sell Amount: 500000
  Fee: 2500
  Royalty: 0
```

## Error Handling

The client includes comprehensive error handling for:
- Connection failures
- Authentication errors
- Stream interruptions
- Invalid configurations

## Stopping the Client

Use `Ctrl+C` to gracefully stop the client.

## Dependencies

- `@grpc/grpc-js`: gRPC client library for Node.js
- `@grpc/proto-loader`: Protocol buffer loader
- `js-yaml`: YAML configuration parser
- `grpc-web`: gRPC-Web support

## Protocol Buffers

The client uses the provided `.proto` files to generate the necessary gRPC client code. The proto files define:

- Service definitions (`corecast.proto`)
- Request/response messages (`request.proto`)
- Stream message formats (`stream_message.proto`)
- Data structures for DEX events (`dex_block_message.proto`)
