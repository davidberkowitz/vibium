import SwiftUI

struct AddCardView: View {
    @EnvironmentObject var cardStore: CardStore
    @Binding var isPresented: Bool

    @State private var card = InsuranceCard()

    var body: some View {
        NavigationStack {
            Form {
                Section("Insurance Company") {
                    TextField("Insurer Name", text: $card.insurerName)
                    TextField("Plan Name", text: $card.planName)
                }

                Section("Member Information") {
                    TextField("Member Name", text: $card.memberName)
                    TextField("Member ID", text: $card.memberId)
                    TextField("Group Number", text: $card.groupNumber)
                }

                Section("Copays") {
                    TextField("Primary Care (e.g. $25)", text: $card.copayPrimary)
                    TextField("Specialist (e.g. $50)", text: $card.copaySpecialist)
                    TextField("Emergency Room (e.g. $150)", text: $card.copayEmergency)
                }

                Section("Prescription (Rx)") {
                    TextField("RX BIN", text: $card.rxBin)
                    TextField("RX PCN", text: $card.rxPcn)
                    TextField("RX Group", text: $card.rxGroup)
                }

                Section("Coverage Period") {
                    DatePicker("Effective Date", selection: $card.effectiveDate, displayedComponents: .date)
                    DatePicker("Expiration Date", selection: $card.expirationDate, displayedComponents: .date)
                }

                Section {
                    // Preview
                    InsuranceCardView(card: card)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                } header: {
                    Text("Preview")
                }
            }
            .navigationTitle("Add Insurance Card")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        cardStore.add(card)
                        isPresented = false
                    }
                    .disabled(card.memberName.isEmpty || card.memberId.isEmpty)
                }
            }
        }
    }
}

#Preview {
    AddCardView(isPresented: .constant(true))
        .environmentObject(CardStore())
}
