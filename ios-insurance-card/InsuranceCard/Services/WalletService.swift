import PassKit
import UIKit

/// Service responsible for creating Apple Wallet passes from insurance card data.
///
/// ## Apple Wallet Pass Requirements
///
/// To generate valid `.pkpass` files that Apple Wallet accepts, you need:
///
/// 1. **Apple Developer Account** — Enroll at developer.apple.com
/// 2. **Pass Type ID** — Register under Certificates, Identifiers & Profiles
/// 3. **Pass Signing Certificate** — Generate a certificate for your Pass Type ID
/// 4. **Server-side signing** — Passes must be signed with your certificate.
///    Apple does NOT allow on-device pass signing for security reasons.
///
/// ### Recommended Architecture
///
/// ```
/// iOS App  -->  Your Server  -->  Signed .pkpass  -->  iOS App  -->  Apple Wallet
///           (POST card data)   (sign with cert)     (PKAddPassesVC)
/// ```
///
/// The server creates the pass.json, adds images (icon, logo, strip),
/// generates the manifest, signs it, and returns the .pkpass bundle.
///
/// ### pass.json Structure for Insurance Cards
///
/// Insurance cards map well to the **generic** pass style:
/// ```json
/// {
///   "formatVersion": 1,
///   "passTypeIdentifier": "pass.com.vibium.insurance",
///   "teamIdentifier": "YOUR_TEAM_ID",
///   "organizationName": "Vibium Health",
///   "serialNumber": "<unique>",
///   "description": "Insurance Card",
///   "generic": {
///     "primaryFields": [...],
///     "secondaryFields": [...],
///     "auxiliaryFields": [...],
///     "backFields": [...]
///   }
/// }
/// ```
class WalletService {

    /// Check if the device supports adding passes to Apple Wallet.
    static var isWalletAvailable: Bool {
        PKAddPassesViewController.canAddPasses()
    }

    /// Build a `PKPass` from insurance card data.
    ///
    /// In production, this would call your backend to sign the pass.
    /// The backend creates pass.json, bundles assets, generates a
    /// manifest.json, signs it with your Pass Type ID certificate,
    /// and returns the `.pkpass` ZIP archive.
    ///
    /// - Parameter card: The insurance card to convert to a wallet pass.
    /// - Returns: A signed `PKPass` ready to present via `PKAddPassesViewController`.
    static func createPass(for card: InsuranceCard) async throws -> PKPass {
        let passData = try await fetchSignedPass(for: card)
        let pass = try PKPass(data: passData)
        return pass
    }

    /// Present the Apple Wallet "Add Pass" dialog.
    ///
    /// - Parameters:
    ///   - pass: The `PKPass` to add.
    ///   - viewController: The presenting view controller.
    static func presentAddToWallet(_ pass: PKPass, from viewController: UIViewController) {
        guard let addPassVC = PKAddPassesViewController(pass: pass) else { return }
        viewController.present(addPassVC, animated: true)
    }

    // MARK: - Server Communication

    /// Fetch a signed `.pkpass` from the backend server.
    ///
    /// Replace the URL and request body with your actual server endpoint.
    /// The server should:
    /// 1. Receive the card data
    /// 2. Build pass.json with the generic pass structure
    /// 3. Include icon.png, icon@2x.png, logo.png, logo@2x.png
    /// 4. Create manifest.json (SHA-1 hashes of all files)
    /// 5. Sign with your Pass Type ID certificate
    /// 6. ZIP everything into a .pkpass bundle
    /// 7. Return the binary data
    private static func fetchSignedPass(for card: InsuranceCard) async throws -> Data {
        // --- Replace with your actual server endpoint ---
        guard let url = URL(string: "https://api.example.com/passes/insurance") else {
            throw WalletError.invalidURL
        }

        let dateFormatter = ISO8601DateFormatter()
        let payload: [String: Any] = [
            "memberName": card.memberName,
            "memberId": card.memberId,
            "groupNumber": card.groupNumber,
            "planName": card.planName,
            "insurerName": card.insurerName,
            "rxBin": card.rxBin,
            "rxPcn": card.rxPcn,
            "rxGroup": card.rxGroup,
            "copayPrimary": card.copayPrimary,
            "copaySpecialist": card.copaySpecialist,
            "copayEmergency": card.copayEmergency,
            "effectiveDate": dateFormatter.string(from: card.effectiveDate),
            "expirationDate": dateFormatter.string(from: card.expirationDate)
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw WalletError.serverError
        }

        return data
    }

    /// Build the pass.json dictionary structure for reference / local preview.
    /// This is what the server should produce before signing.
    static func buildPassJSON(for card: InsuranceCard) -> [String: Any] {
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium

        return [
            "formatVersion": 1,
            "passTypeIdentifier": "pass.com.vibium.insurance",
            "teamIdentifier": "REPLACE_WITH_TEAM_ID",
            "organizationName": card.insurerName,
            "serialNumber": card.id.uuidString,
            "description": "Insurance Card - \(card.insurerName)",
            "foregroundColor": "rgb(255, 255, 255)",
            "backgroundColor": "rgb(0, 100, 180)",
            "labelColor": "rgb(200, 220, 255)",
            "generic": [
                "headerFields": [
                    [
                        "key": "plan",
                        "label": "PLAN",
                        "value": card.planName
                    ]
                ],
                "primaryFields": [
                    [
                        "key": "memberName",
                        "label": "MEMBER",
                        "value": card.memberName
                    ]
                ],
                "secondaryFields": [
                    [
                        "key": "memberId",
                        "label": "MEMBER ID",
                        "value": card.memberId
                    ],
                    [
                        "key": "groupNumber",
                        "label": "GROUP",
                        "value": card.groupNumber
                    ]
                ],
                "auxiliaryFields": [
                    [
                        "key": "copayPrimary",
                        "label": "PCP COPAY",
                        "value": card.copayPrimary
                    ],
                    [
                        "key": "copaySpecialist",
                        "label": "SPECIALIST",
                        "value": card.copaySpecialist
                    ],
                    [
                        "key": "copayER",
                        "label": "ER COPAY",
                        "value": card.copayEmergency
                    ]
                ],
                "backFields": [
                    [
                        "key": "rxBin",
                        "label": "RX BIN",
                        "value": card.rxBin
                    ],
                    [
                        "key": "rxPcn",
                        "label": "RX PCN",
                        "value": card.rxPcn
                    ],
                    [
                        "key": "rxGroup",
                        "label": "RX GROUP",
                        "value": card.rxGroup
                    ],
                    [
                        "key": "effectiveDate",
                        "label": "EFFECTIVE DATE",
                        "value": dateFormatter.string(from: card.effectiveDate)
                    ],
                    [
                        "key": "expirationDate",
                        "label": "EXPIRATION DATE",
                        "value": dateFormatter.string(from: card.expirationDate)
                    ],
                    [
                        "key": "insurer",
                        "label": "INSURANCE COMPANY",
                        "value": card.insurerName
                    ]
                ]
            ]
        ]
    }
}

enum WalletError: LocalizedError {
    case invalidURL
    case serverError
    case passCreationFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL configuration."
        case .serverError:
            return "Failed to retrieve pass from server. Please try again."
        case .passCreationFailed:
            return "Could not create the wallet pass."
        }
    }
}
