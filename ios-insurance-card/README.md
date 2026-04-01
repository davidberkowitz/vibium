# Insurance Card Wallet - iOS App

An iOS app that lets users store digital insurance cards and add them to Apple Wallet.

## Features

- **Add insurance cards** with member info, copays, Rx details, and coverage dates
- **Visual card preview** styled like a physical insurance card
- **Apple Wallet integration** — download your card as a wallet pass
- **Local persistence** via UserDefaults

## Architecture

```
InsuranceCard/
├── InsuranceCardApp.swift        # App entry point
├── ContentView.swift             # Root navigation
├── Models/
│   ├── InsuranceCard.swift       # Data model
│   └── CardStore.swift           # Persistence layer
├── Views/
│   ├── InsuranceCardView.swift   # Visual card component
│   ├── CardListView.swift        # Card list screen
│   ├── CardDetailView.swift      # Detail + Add to Wallet
│   └── AddCardView.swift         # Form to add a card
└── Services/
    └── WalletService.swift       # PassKit / Apple Wallet integration
```

## Requirements

- iOS 17.0+
- Xcode 15+
- Swift 5.9+

## Apple Wallet Setup

Apple Wallet passes must be **signed server-side**. To enable the "Add to Wallet" flow:

1. Register a **Pass Type ID** in your Apple Developer account
2. Generate a **Pass Signing Certificate**
3. Deploy a server endpoint that:
   - Receives card data as JSON
   - Builds `pass.json` using the generic pass style
   - Bundles icon/logo images
   - Creates `manifest.json` with SHA-1 hashes
   - Signs with your certificate
   - Returns the `.pkpass` ZIP archive
4. Update `WalletService.swift` with your server URL and Pass Type ID

See Apple's [Wallet Developer Guide](https://developer.apple.com/wallet/) for details.
