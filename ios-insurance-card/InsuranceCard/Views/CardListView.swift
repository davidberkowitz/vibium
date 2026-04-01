import SwiftUI

struct CardListView: View {
    @EnvironmentObject var cardStore: CardStore

    var body: some View {
        Group {
            if cardStore.cards.isEmpty {
                emptyState
            } else {
                cardList
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Insurance Cards", systemImage: "creditcard")
        } description: {
            Text("Tap + to add your insurance card and save it to Apple Wallet.")
        }
    }

    private var cardList: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                ForEach(cardStore.cards) { card in
                    NavigationLink(value: card) {
                        InsuranceCardView(card: card)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .navigationDestination(for: InsuranceCard.self) { card in
            CardDetailView(card: card)
        }
    }
}

#Preview {
    NavigationStack {
        CardListView()
            .environmentObject({
                let store = CardStore()
                store.add(.sample)
                return store
            }())
    }
}
