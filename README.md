# Alfis OpenWRT Packages

This repository contains OpenWRT packages for Alfis - the Alternative Free Identity System.

## Packages

### alfis
The main Alfis DNS server package that provides blockchain-based domain resolution for alternative TLDs like `.anon`, `.btn`, `.conf`, etc.

**Features:**
- DNS server with blockchain domain resolution
- P2P network synchronization
- Support for 10 alternative domain zones
- Configurable via UCI

**Dependencies:**
- Rust compiler (build-time)
- ca-certificates

### luci-app-alfis
Web interface for managing and monitoring the Alfis DNS service through LuCI.

**Features:**
- Enable/disable Alfis service
- Configure DNS and API ports
- Set logging levels
- Manage bootstrap nodes
- View service status

**Dependencies:**
- alfis package
- luci-base

## Building

First, compile the required toolchain and tools:
```bash
make toolchain/compile V=s
make tools/libdeflate/compile V=s
```

### Build both packages:
```bash
make package/alfis/compile V=s
make package/luci-app-alfis/compile V=s
```

### Build only the base service:
```bash
make package/alfis/compile V=s
```

### Build only the web interface:
```bash
make package/luci-app-alfis/compile V=s
```

## Installation

1. Install the base package: `opkg install alfis_*.ipk`
2. Optionally install the web interface: `opkg install luci-app-alfis_*.ipk`
3. Configure via UCI or LuCI web interface
4. Enable and start the service: `/etc/init.d/alfis enable && /etc/init.d/alfis start`

## Configuration

### UCI Configuration (`/etc/config/alfis`):
- `enabled`: Enable/disable service (0/1)
- `listen_dns`: DNS server port (default: 53)
- `listen_http`: HTTP API port (default: 8080)  
- `max_peers`: Maximum P2P peers (default: 32)
- `debug_level`: Log level (error/warn/info/debug/trace)
- `bootstrap_nodes`: List of initial nodes to connect to
- `zones`: Supported blockchain DNS zones

### File Locations:
- Configuration: `/etc/alfis/alfis.toml`
- Database: `/var/lib/alfis/`
- Logs: System journal/syslog

## Source

The packages download and build Alfis from: https://github.com/Revertron/Alfis

Source code is downloaded to `/tmp` during build process and cleaned up automatically.

## Maintainer

HodlOnToYourButts