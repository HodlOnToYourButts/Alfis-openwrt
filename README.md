# Alfis OpenWrt Package Repository

This repository contains pre-built Alfis packages for OpenWrt 24.10.3.

## Installation

Add this repository to your OpenWrt device:

```sh
# Determine your architecture
ARCH=$(opkg print-architecture | awk '{print $2}' | tail -1)

# Add the repository
echo "src/gz alfis https://hodlontoyourbutts.github.io/Alfis-openwrt/$ARCH" >> /etc/opkg/customfeeds.conf

# Update package lists
opkg update

# Install packages
opkg install alfis
opkg install luci-app-alfis
```

## Supported Architectures

- [aarch64_cortex-a53](aarch64_cortex-a53/)
- [arm_cortex-a7_neon-vfpv4](arm_cortex-a7_neon-vfpv4/)
- [mipsel_24kc](mipsel_24kc/)
- [x86_64](x86_64/)

## Manual Installation

Download the appropriate `.ipk` files for your architecture and install:

```sh
opkg install alfis_*.ipk
opkg install luci-app-alfis_*.ipk
```

## Build Information

- OpenWrt Version: 24.10.3
- Build Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- Commit: aa39baa169e3d3e8728b72a062116f8b06769a6e
