import SwiftUI

struct ContentView: View {
    @EnvironmentObject var cardStore: CardStore
    @State private var showingAddCard = false

    var body: some View {
        NavigationStack {
            CardListView()
                .navigationTitle("Insurance Cards")
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            showingAddCard = true
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
                .sheet(isPresented: $showingAddCard) {
                    AddCardView(isPresented: $showingAddCard)
                }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(CardStore())
}
