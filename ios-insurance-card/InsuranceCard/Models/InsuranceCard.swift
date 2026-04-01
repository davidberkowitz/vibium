import Foundation

struct InsuranceCard: Identifiable, Codable, Hashable {
    let id: UUID
    var memberName: String
    var memberId: String
    var groupNumber: String
    var planName: String
    var insurerName: String
    var rxBin: String
    var rxPcn: String
    var rxGroup: String
    var copayPrimary: String
    var copaySpecialist: String
    var copayEmergency: String
    var effectiveDate: Date
    var expirationDate: Date

    init(
        id: UUID = UUID(),
        memberName: String = "",
        memberId: String = "",
        groupNumber: String = "",
        planName: String = "",
        insurerName: String = "",
        rxBin: String = "",
        rxPcn: String = "",
        rxGroup: String = "",
        copayPrimary: String = "",
        copaySpecialist: String = "",
        copayEmergency: String = "",
        effectiveDate: Date = Date(),
        expirationDate: Date = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
    ) {
        self.id = id
        self.memberName = memberName
        self.memberId = memberId
        self.groupNumber = groupNumber
        self.planName = planName
        self.insurerName = insurerName
        self.rxBin = rxBin
        self.rxPcn = rxPcn
        self.rxGroup = rxGroup
        self.copayPrimary = copayPrimary
        self.copaySpecialist = copaySpecialist
        self.copayEmergency = copayEmergency
        self.effectiveDate = effectiveDate
        self.expirationDate = expirationDate
    }

    static let sample = InsuranceCard(
        memberName: "Jane Doe",
        memberId: "XYZ123456789",
        groupNumber: "GRP-001234",
        planName: "Gold PPO Plan",
        insurerName: "Vibium Health",
        rxBin: "004336",
        rxPcn: "ADV",
        rxGroup: "RX9876",
        copayPrimary: "$25",
        copaySpecialist: "$50",
        copayEmergency: "$150",
        effectiveDate: Date(),
        expirationDate: Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
    )
}
