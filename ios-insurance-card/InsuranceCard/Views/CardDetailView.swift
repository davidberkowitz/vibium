import SwiftUI
import PassKit

struct CardDetailView: View {
    let card: InsuranceCard
    @EnvironmentObject var cardStore: CardStore
    @State private var showingWalletError = false
    @State private var walletErrorMessage = ""
    @State private var isAddingToWallet = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                InsuranceCardView(card: card)

                // Add to Wallet button
                if WalletService.isWalletAvailable {
                    AddToWalletButton(isLoading: isAddingToWallet) {
                        addToWallet()
                    }
                }

                // Prescription details
                GroupBox("Prescription (Rx) Details") {
                    VStack(spacing: 12) {
                        DetailRow(label: "RX BIN", value: card.rxBin)
                        DetailRow(label: "RX PCN", value: card.rxPcn)
                        DetailRow(label: "RX GROUP", value: card.rxGroup)
                    }
                }

                // Dates
                GroupBox("Coverage Period") {
                    VStack(spacing: 12) {
                        DetailRow(label: "Effective", value: card.effectiveDate.formatted(date: .long, time: .omitted))
                        DetailRow(label: "Expires", value: card.expirationDate.formatted(date: .long, time: .omitted))
                    }
                }
            }
            .padding()
        }
        .navigationTitle(card.insurerName)
        .navigationBarTitleDisplayMode(.inline)
        .alert("Wallet Error", isPresented: $showingWalletError) {
            Button("OK") {}
        } message: {
            Text(walletErrorMessage)
        }
    }

    private func addToWallet() {
        isAddingToWallet = true
        Task {
            do {
                let pass = try await WalletService.createPass(for: card)
                await MainActor.run {
                    isAddingToWallet = false
                    guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                          let rootVC = windowScene.windows.first?.rootViewController else {
                        return
                    }
                    // Walk to the topmost presented VC
                    var topVC = rootVC
                    while let presented = topVC.presentedViewController {
                        topVC = presented
                    }
                    WalletService.presentAddToWallet(pass, from: topVC)
                }
            } catch {
                await MainActor.run {
                    isAddingToWallet = false
                    walletErrorMessage = error.localizedDescription
                    showingWalletError = true
                }
            }
        }
    }
}

/// A styled "Add to Apple Wallet" button matching Apple's design guidelines.
struct AddToWalletButton: View {
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "wallet.pass")
                        .font(.title3)
                }
                Text("Add to Apple Wallet")
                    .fontWeight(.semibold)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(.black, in: RoundedRectangle(cornerRadius: 12))
        }
        .disabled(isLoading)
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(.subheadline.monospaced())
            Spacer()
        }
    }
}

#Preview {
    NavigationStack {
        CardDetailView(card: .sample)
            .environmentObject(CardStore())
    }
}
