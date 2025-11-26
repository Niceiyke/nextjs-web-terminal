import { NextRequest, NextResponse } from "next/server";
import { generateKeyPairSync } from "crypto";
import sshpk from "sshpk";

export async function POST(request: NextRequest) {
  try {
    const { type = "rsa", bits = 4096, passphrase } = await request.json();

    // Generate SSH key pair (use PKCS1 so ssh2 accepts the private key)
    const { publicKey, privateKey } = generateKeyPairSync(type, {
      modulusLength: bits,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs1", // ssh2 rejects PKCS8 ("BEGIN PRIVATE KEY"), so emit PKCS1 RSA format
        format: "pem",
        ...(passphrase && {
          cipher: "aes-256-cbc",
          passphrase: passphrase,
        }),
      },
    });

    // Convert public key to OpenSSH format using sshpk
    const publicKeySSH = sshpk.parseKey(publicKey, "pem").toString("ssh");

    // Calculate fingerprint
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(publicKey).digest("base64");
    const fingerprint = `SHA256:${hash}`;

    return NextResponse.json({
      publicKey,
      privateKey,
      publicKeySSH: `${publicKeySSH}`,
      fingerprint,
    });
  } catch (error: any) {
    console.error("Key generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate SSH key pair: " + error.message },
      { status: 500 }
    );
  }
}
