import SwiftUI

@main
struct InsuranceCardApp: App {
    @StateObject private var cardStore = CardStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(cardStore)
        }
    }
}
