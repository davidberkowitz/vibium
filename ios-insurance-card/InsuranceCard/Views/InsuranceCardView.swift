import SwiftUI

/// A visual representation of an insurance card, styled to look like a physical card.
struct InsuranceCardView: View {
    let card: InsuranceCard

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.insurerName)
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                    Text(card.planName)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.8))
                }
                Spacer()
                Image(systemName: "cross.case.fill")
                    .font(.title2)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding()
            .background(
                LinearGradient(
                    colors: [Color(red: 0, green: 0.39, blue: 0.71),
                             Color(red: 0, green: 0.55, blue: 0.85)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )

            // Member info
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("MEMBER")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(card.memberName)
                        .font(.headline)
                }

                HStack(spacing: 24) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("MEMBER ID")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(card.memberId)
                            .font(.subheadline.monospaced())
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("GROUP")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(card.groupNumber)
                            .font(.subheadline.monospaced())
                    }
                }

                Divider()

                // Copays
                HStack {
                    CopayBadge(label: "PCP", amount: card.copayPrimary)
                    Spacer()
                    CopayBadge(label: "Specialist", amount: card.copaySpecialist)
                    Spacer()
                    CopayBadge(label: "ER", amount: card.copayEmergency)
                }
            }
            .padding()
            .background(Color(.systemBackground))
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
    }
}

struct CopayBadge: View {
    let label: String
    let amount: String

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(amount)
                .font(.subheadline.bold())
                .foregroundStyle(Color(red: 0, green: 0.39, blue: 0.71))
        }
    }
}

#Preview {
    InsuranceCardView(card: .sample)
        .padding()
}
