import Foundation
import SwiftUI

class CardStore: ObservableObject {
    @Published var cards: [InsuranceCard] = []

    private static let saveKey = "SavedInsuranceCards"

    init() {
        load()
    }

    func add(_ card: InsuranceCard) {
        cards.append(card)
        save()
    }

    func delete(at offsets: IndexSet) {
        cards.remove(atOffsets: offsets)
        save()
    }

    func update(_ card: InsuranceCard) {
        if let index = cards.firstIndex(where: { $0.id == card.id }) {
            cards[index] = card
            save()
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(cards) {
            UserDefaults.standard.set(data, forKey: Self.saveKey)
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: Self.saveKey),
              let decoded = try? JSONDecoder().decode([InsuranceCard].self, from: data) else {
            return
        }
        cards = decoded
    }
}
