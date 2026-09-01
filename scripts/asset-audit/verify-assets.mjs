import { createHash } from "node:crypto";
import console from "node:console";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "../..");

const expected = [
  {
    path: "public/images/showroom-fallback.webp",
    width: 1600,
    height: 900,
    maxBytes: 180_000,
    sha256: "05c73904dcca2354819f33f21fa775c1763047bae2ef44ddcedf3695db89f520",
  },
  {
    path: "public/images/vehicle-side.webp",
    width: 1600,
    height: 900,
    maxBytes: 220_000,
    sha256: "477295f238b4c5c657276ae7ded9d0e02465d4184006930d27489763b3fa70f9",
  },
  {
    path: "public/images/vehicle-side-blueprint.webp",
    width: 1600,
    height: 900,
    maxBytes: 420_000,
    sha256: "057c09e9fa39cfbea07d3894136e7469dd13800fce103e4df3dcd144b8583c80",
  },
  {
    path: "public/images/vehicle-scan-mask.webp",
    width: 1600,
    height: 900,
    maxBytes: 30_000,
    sha256: "4f9cabec2f1f1ad9c5ab6d473b4f8b96114484b88aa112398023f9cea44aa1d0",
  },
  {
    path: "public/images/vehicle-paint-mask.webp",
    width: 1600,
    height: 900,
    maxBytes: 50_000,
    sha256: "f1c57ed4f573af14f17ef7b60641a2afcf99af52c995f5644809a86b0b599057",
  },
  {
    path: "public/images/representative-wheel-inset.webp",
    width: 512,
    height: 512,
    maxBytes: 120_000,
    sha256: "392b1cbfc2659665bd0a53067110e41a34f98eb7c06abd43fb142cd6eb9828d5",
  },
];

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("not a WebP RIFF file");
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }

  if (chunk === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }

  throw new Error(`unsupported WebP chunk ${chunk}`);
}

let failed = false;
let totalBytes = 0;

for (const asset of expected) {
  const absolutePath = resolve(root, asset.path);
  try {
    const [buffer, metadata] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ]);
    const digest = createHash("sha256").update(buffer).digest("hex");
    const dimensions = webpDimensions(buffer);
    const checks = [
      [digest === asset.sha256, `hash ${digest}`],
      [metadata.size <= asset.maxBytes, `${metadata.size} bytes`],
      [
        dimensions.width === asset.width && dimensions.height === asset.height,
        `${dimensions.width}x${dimensions.height}`,
      ],
    ];
    const errors = checks.filter(([ok]) => !ok).map(([, message]) => message);
    if (errors.length > 0) {
      failed = true;
      console.error(`FAIL ${asset.path}: ${errors.join(", ")}`);
      continue;
    }
    totalBytes += metadata.size;
    console.log(`PASS ${asset.path} · ${dimensions.width}x${dimensions.height} · ${metadata.size} bytes`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${asset.path}: ${error.message}`);
  }
}

console.log(`Approved public safety-pack payload: ${totalBytes} bytes`);
console.log("Live 3D asset: intentionally not bundled; runtime mode is authored_2_5d.");

if (failed) {
  process.exitCode = 1;
}
